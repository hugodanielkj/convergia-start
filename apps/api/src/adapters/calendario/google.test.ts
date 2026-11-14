import { FalhaCalendarioError, type EventoCalendario } from '@convergia/core/calendario';
import { describe, expect, it, vi } from 'vitest';
import { criarCalendarioGoogle } from './google.js';

const EVENTO: EventoCalendario = {
  titulo: 'Reunião de onboarding: Padaria',
  descricao: 'Alinhamento',
  inicio: new Date('2026-11-17T12:00:00.000Z'),
  fim: new Date('2026-11-17T13:00:00.000Z'),
  convidados: ['maria@padaria.com.br'],
  comVideochamada: true,
};

type Resposta = { status: number; corpo?: unknown };

/** O que o `fetch` recebeu, como texto: a URL pode vir como `string` ou `URL`, o corpo como `BodyInit`. */
const texto = (valor: unknown): string =>
  typeof valor === 'string'
    ? valor
    : valor instanceof URL
      ? valor.href
      : valor instanceof URLSearchParams
        ? valor.toString()
        : '';

/** `fetch` simulado: o primeiro item de cada URL é o token OAuth, os demais são chamadas do calendário. */
function google(...respostas: Resposta[]) {
  const fila = [...respostas];
  const fetcher = vi.fn<typeof fetch>(() => {
    const proxima = fila.shift() ?? { status: 200, corpo: {} };
    return Promise.resolve(
      new Response(proxima.corpo === undefined ? null : JSON.stringify(proxima.corpo), {
        status: proxima.status,
      }),
    );
  });
  const calendario = criarCalendarioGoogle({
    clientId: 'id',
    clientSecret: 'segredo',
    refreshToken: 'refresh',
    calendarioId: 'agencia@exemplo.com',
    fetcher,
    agora: () => new Date('2026-11-16T12:00:00.000Z'),
  });
  return { calendario, fetcher, chamada: (n: number) => fetcher.mock.calls[n] };
}
const token: Resposta = { status: 200, corpo: { access_token: 'acesso-1', expires_in: 3600 } };
const corpoDe = (init?: RequestInit) =>
  JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;

describe('RN-34 criar evento no Google Calendar', () => {
  it('cria com convite e Meet, e devolve o id e o link da videochamada', async () => {
    const g = google(token, {
      status: 200,
      corpo: { id: 'ev1', hangoutLink: 'https://meet.google.com/abc' },
    });
    expect(await g.calendario.criarEvento(EVENTO)).toEqual({
      id: 'ev1',
      linkVideochamada: 'https://meet.google.com/abc',
    });

    const [urlToken, initToken] = g.chamada(0) ?? [];
    expect(urlToken).toBe('https://oauth2.googleapis.com/token');
    expect(texto(initToken?.body)).toContain('grant_type=refresh_token');

    const [url, init] = g.chamada(1) ?? [];
    expect(texto(url)).toContain('/calendars/agencia%40exemplo.com/events');
    expect(texto(url)).toContain('conferenceDataVersion=1');
    expect(texto(url)).toContain('sendUpdates=all');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['authorization']).toBe('Bearer acesso-1');
    expect(corpoDe(init)).toMatchObject({
      summary: EVENTO.titulo,
      description: 'Alinhamento',
      start: { dateTime: '2026-11-17T12:00:00.000Z', timeZone: 'UTC' },
      end: { dateTime: '2026-11-17T13:00:00.000Z', timeZone: 'UTC' },
      attendees: [{ email: 'maria@padaria.com.br' }],
      conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    });
  });

  it('sem videochamada, não pede o Meet; sem convidados, não manda lista', async () => {
    const g = google(token, { status: 200, corpo: { id: 'ev2' } });
    expect(
      await g.calendario.criarEvento({ ...EVENTO, comVideochamada: false, convidados: [] }),
    ).toEqual({ id: 'ev2' });
    const corpo = corpoDe(g.chamada(1)?.[1]);
    expect(corpo).not.toHaveProperty('conferenceData');
    expect(corpo).not.toHaveProperty('attendees');
    expect(texto(g.chamada(1)?.[0])).not.toContain('conferenceDataVersion');
  });

  it('reaproveita o token de acesso enquanto vale e pede outro depois que vence', async () => {
    const g = google(
      token,
      { status: 200, corpo: { id: 'a' } },
      { status: 200, corpo: { id: 'b' } },
    );
    await g.calendario.criarEvento(EVENTO);
    await g.calendario.criarEvento(EVENTO);
    expect(g.fetcher.mock.calls.filter(([u]) => texto(u).includes('oauth2')).length).toBe(1);
  });
});

describe('atualizar e cancelar', () => {
  it('atualiza o mesmo evento por PATCH', async () => {
    const g = google(token, { status: 200, corpo: { id: 'ev1' } });
    await g.calendario.atualizarEvento('ev/1', EVENTO);
    const [url, init] = g.chamada(1) ?? [];
    expect(texto(url)).toContain('/events/ev%2F1?');
    expect(init?.method).toBe('PATCH');
  });

  it('cancela por DELETE, avisando os convidados', async () => {
    const g = google(token, { status: 204 });
    await g.calendario.cancelarEvento('ev1');
    const [url, init] = g.chamada(1) ?? [];
    expect(init?.method).toBe('DELETE');
    expect(texto(url)).toContain('sendUpdates=all');
  });

  it('cancelar um evento que já não existe conta como feito', async () => {
    for (const status of [404, 410]) {
      await expect(
        google(token, { status }).calendario.cancelarEvento('ev1'),
      ).resolves.toBeUndefined();
    }
  });
});

describe('RN-67 quais erros valem repetir', () => {
  const falhaDe = async (resposta: Resposta, ...antes: Resposta[]) => {
    const g = google(...antes, resposta);
    return g.calendario.criarEvento(EVENTO).catch((e: unknown) => e);
  };

  it.each([500, 502, 503, 429])('%i do Google é transitório', async (status) => {
    const erro = await falhaDe({ status }, token);
    expect(erro).toBeInstanceOf(FalhaCalendarioError);
    expect((erro as FalhaCalendarioError).transitoria).toBe(true);
  });

  it('403 por limite de uso é transitório; 403 por falta de permissão não', async () => {
    const limite = await falhaDe(
      { status: 403, corpo: { error: { errors: [{ reason: 'rateLimitExceeded' }] } } },
      token,
    );
    expect((limite as FalhaCalendarioError).transitoria).toBe(true);
    const permissao = await falhaDe(
      { status: 403, corpo: { error: { errors: [{ reason: 'forbidden' }] } } },
      token,
    );
    expect((permissao as FalhaCalendarioError).transitoria).toBe(false);
  });

  it.each([400, 401, 404])('%i é definitivo: repetir não adianta', async (status) => {
    expect(((await falhaDe({ status }, token)) as FalhaCalendarioError).transitoria).toBe(false);
  });

  it('credencial recusada ao pedir o token de acesso é definitiva', async () => {
    const erro = await falhaDe({ status: 400 }, { status: 400, corpo: { error: 'invalid_grant' } });
    expect(erro).toBeInstanceOf(FalhaCalendarioError);
    expect((erro as FalhaCalendarioError).transitoria).toBe(false);
  });

  it('o Google fora do ar ao pedir o token é transitório', async () => {
    expect(
      ((await falhaDe({ status: 200 }, { status: 503 })) as FalhaCalendarioError).transitoria,
    ).toBe(true);
  });

  it('queda de rede é transitória e a mensagem não vaza segredo', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new Error('ECONNRESET')));
    const calendario = criarCalendarioGoogle({
      clientId: 'id',
      clientSecret: 'segredo-super',
      refreshToken: 'refresh-super',
      fetcher,
    });
    const erro = (await calendario
      .criarEvento(EVENTO)
      .catch((e: unknown) => e)) as FalhaCalendarioError;
    expect(erro.transitoria).toBe(true);
    expect(erro.message).not.toContain('segredo-super');
    expect(erro.message).not.toContain('refresh-super');
  });
});
