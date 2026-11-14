import { describe, expect, it, vi } from 'vitest';
import { criarApiReuniao } from './api';

const lista = {
  fuso: 'America/Sao_Paulo',
  dias: [
    {
      data: '2026-11-17',
      slots: [
        { inicio: '2026-11-17T12:00:00.000Z', fim: '2026-11-17T13:00:00.000Z', hora: '09:00' },
      ],
    },
  ],
};
const agendamento = {
  id: 'a1',
  tipo: 'reuniao',
  inicio: '2026-11-17T12:00:00.000Z',
  fim: '2026-11-17T13:00:00.000Z',
  status: 'agendado',
  reagendamentosRestantes: 2,
  podeReagendar: true,
};

function api(status: number, corpo?: unknown) {
  const fetcher = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })),
  );
  return {
    fetcher,
    api: criarApiReuniao({ baseUrl: '/api', fetcher }),
    url: () => fetcher.mock.calls[0]?.[0],
  };
}

describe('RN-30 e RN-32 lista de horários', () => {
  it('pede os horários de reunião no fuso do cliente, com o token só no caminho', async () => {
    const a = api(200, lista);
    expect(await a.api.listarHorarios('tok/1', 'Asia/Tokyo')).toEqual({ tipo: 'ok', lista });
    expect(a.url()).toBe('/api/publico/onboardings/tok%2F1/slots?tipo=reuniao&fuso=Asia%2FTokyo');
  });

  it('link expirado ou inválido são situações próprias, não falhas', async () => {
    expect(await api(410, { erro: 'LINK_EXPIRADO' }).api.listarHorarios('t', 'UTC')).toEqual({
      tipo: 'expirado',
    });
    expect(await api(404, { erro: 'LINK_INVALIDO' }).api.listarHorarios('t', 'UTC')).toEqual({
      tipo: 'invalido',
    });
  });

  it('resposta fora do formato ou erro do servidor é falha', async () => {
    expect(await api(200, { dias: 'x' }).api.listarHorarios('t', 'UTC')).toMatchObject({
      tipo: 'falha',
    });
    expect(await api(500).api.listarHorarios('t', 'UTC')).toMatchObject({ tipo: 'falha' });
  });

  it('queda de rede é falha com mensagem amigável', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new Error('rede')));
    expect(
      await criarApiReuniao({ baseUrl: '/api', fetcher }).listarHorarios('t', 'UTC'),
    ).toMatchObject({
      tipo: 'falha',
      mensagem: expect.stringMatching(/conexão|servidor/i) as string,
    });
  });
});

describe('RN-33 reservar', () => {
  it('confirma o horário', async () => {
    const a = api(201, {
      agendamento: {
        id: 'a1',
        tipo: 'reuniao',
        inicio: agendamento.inicio,
        fim: agendamento.fim,
        status: 'agendado',
      },
    });
    expect(await a.api.reservar('tok', agendamento.inicio, 'UTC')).toEqual({ tipo: 'ok' });
    const init = a.fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      tipo: 'reuniao',
      inicio: agendamento.inicio,
      fuso: 'UTC',
    });
  });

  it('horário perdido devolve a lista atualizada para a tela', async () => {
    const a = api(409, { erro: 'SLOT_INDISPONIVEL', mensagem: 'x', ...lista });
    expect(await a.api.reservar('tok', agendamento.inicio, 'UTC')).toEqual({
      tipo: 'indisponivel',
      lista,
    });
  });

  it('já agendado, link expirado e inválido', async () => {
    expect(
      await api(409, { erro: 'JA_AGENDADO' }).api.reservar('t', agendamento.inicio, 'UTC'),
    ).toEqual({ tipo: 'ja_agendado' });
    expect(await api(410).api.reservar('t', agendamento.inicio, 'UTC')).toEqual({
      tipo: 'expirado',
    });
    expect(await api(404).api.reservar('t', agendamento.inicio, 'UTC')).toEqual({
      tipo: 'invalido',
    });
  });

  it('erro de validação ou do servidor vira falha', async () => {
    expect(await api(400, { erro: 'VALIDACAO' }).api.reservar('t', 'x', 'UTC')).toMatchObject({
      tipo: 'falha',
    });
    expect(await api(500).api.reservar('t', agendamento.inicio, 'UTC')).toMatchObject({
      tipo: 'falha',
    });
  });
});

describe('RN-35 agendamentos e reagendar', () => {
  it('lê os agendamentos do cliente com o que ele pode fazer', async () => {
    expect(await api(200, { agendamentos: [agendamento] }).api.listarAgendamentos('t')).toEqual({
      tipo: 'ok',
      agendamentos: [agendamento],
    });
  });

  it('reagenda no caminho do agendamento', async () => {
    const a = api(200, { agendamento: { ...agendamento, status: 'reagendado' } });
    expect(await a.api.reagendar('tok', 'a/1', agendamento.inicio, 'UTC')).toEqual({ tipo: 'ok' });
    expect(a.url()).toBe('/api/publico/onboardings/tok/agendamentos/a%2F1/reagendar');
  });

  it('negado traz o texto que manda falar com a agência', async () => {
    const a = api(422, {
      erro: 'REAGENDAMENTO_NEGADO',
      motivo: 'limite_atingido',
      mensagem: 'Entre em contato com a agência.',
    });
    expect(await a.api.reagendar('t', 'a1', agendamento.inicio, 'UTC')).toEqual({
      tipo: 'negado',
      mensagem: 'Entre em contato com a agência.',
    });
  });

  it('horário perdido no reagendamento devolve a lista; agendamento inexistente é falha', async () => {
    expect(
      await api(409, { erro: 'SLOT_INDISPONIVEL', mensagem: 'x', ...lista }).api.reagendar(
        't',
        'a1',
        agendamento.inicio,
        'UTC',
      ),
    ).toEqual({ tipo: 'indisponivel', lista });
    expect(
      await api(404, { erro: 'AGENDAMENTO_NAO_ENCONTRADO' }).api.reagendar(
        't',
        'a1',
        agendamento.inicio,
        'UTC',
      ),
    ).toMatchObject({ tipo: 'falha' });
  });
});
