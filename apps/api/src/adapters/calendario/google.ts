import {
  FalhaCalendarioError,
  type Calendario,
  type EventoCalendario,
  type EventoCriado,
} from '@convergia/core/calendario';
import { randomUUID } from 'node:crypto';

export interface OpcoesCalendarioGoogle {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Token de renovação da conta Google da agência, com permissão para o Google Calendar. */
  readonly refreshToken: string;
  /** Calendário onde os eventos são criados; `primary` é o principal da conta. */
  readonly calendarioId?: string;
  readonly fetcher?: typeof fetch;
  readonly agora?: () => Date;
}

const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_CALENDARIO = 'https://www.googleapis.com/calendar/v3/calendars';
/** O token de acesso vale 1 hora; renova um pouco antes para não usar um que venceu no caminho. */
const MARGEM_DO_TOKEN_MS = 60 * 1000;
const MOTIVOS_DE_LIMITE = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'backendError',
]);

/**
 * Adaptador do Google Calendar (D-12, RN-34, RN-67) falando direto com a API REST, sem SDK. Cria
 * o evento com convite aos participantes e link do Meet, atualiza e remove. Erros do Google viram
 * `FalhaCalendarioError`, que diz se vale tentar de novo.
 */
export function criarCalendarioGoogle(opcoes: OpcoesCalendarioGoogle): Calendario {
  const fetcher = opcoes.fetcher ?? ((...args) => fetch(...args));
  const agora = opcoes.agora ?? (() => new Date());
  const base = `${URL_CALENDARIO}/${encodeURIComponent(opcoes.calendarioId ?? 'primary')}/events`;
  let acesso: { token: string; venceEm: number } | null = null;

  async function chamar(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetcher(url, init);
    } catch {
      // A mensagem original pode citar a URL ou cabeçalhos; devolve só o que ajuda a diagnosticar.
      throw new FalhaCalendarioError('Sem conexão com o Google Calendar', true);
    }
  }

  async function tokenDeAcesso(): Promise<string> {
    if (acesso && acesso.venceEm - MARGEM_DO_TOKEN_MS > agora().getTime()) return acesso.token;
    const resposta = await chamar(URL_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: opcoes.clientId,
        client_secret: opcoes.clientSecret,
        refresh_token: opcoes.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (resposta.status >= 500 || resposta.status === 429) {
      throw new FalhaCalendarioError(
        `Google indisponível ao autenticar (${String(resposta.status)})`,
        true,
      );
    }
    const corpo = (await resposta.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (!resposta.ok || !corpo?.access_token) {
      // invalid_grant e semelhantes: a credencial foi revogada ou está errada. Repetir não resolve.
      throw new FalhaCalendarioError(
        'Credencial do Google recusada. Reconecte a conta da agência.',
        false,
      );
    }
    acesso = {
      token: corpo.access_token,
      venceEm: agora().getTime() + (corpo.expires_in ?? 3600) * 1000,
    };
    return acesso.token;
  }

  async function erroDaResposta(resposta: Response): Promise<FalhaCalendarioError> {
    const corpo = (await resposta.json().catch(() => null)) as {
      error?: { errors?: { reason?: string }[] };
    } | null;
    const motivo = corpo?.error?.errors?.[0]?.reason;
    const transitoria =
      resposta.status >= 500 ||
      resposta.status === 429 ||
      (resposta.status === 403 && motivo !== undefined && MOTIVOS_DE_LIMITE.has(motivo));
    return new FalhaCalendarioError(
      `Google Calendar respondeu ${String(resposta.status)}`,
      transitoria,
    );
  }

  function corpoDoEvento(evento: EventoCalendario) {
    return {
      summary: evento.titulo,
      ...(evento.descricao === undefined ? {} : { description: evento.descricao }),
      start: { dateTime: evento.inicio.toISOString(), timeZone: 'UTC' },
      end: { dateTime: evento.fim.toISOString(), timeZone: 'UTC' },
      ...(evento.convidados.length === 0
        ? {}
        : { attendees: evento.convidados.map((email) => ({ email })) }),
      ...(evento.comVideochamada
        ? {
            conferenceData: {
              createRequest: {
                requestId: randomUUID(),
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }
        : {}),
    };
  }

  async function enviar(
    metodo: 'POST' | 'PATCH',
    caminho: string,
    evento: EventoCalendario,
  ): Promise<Response> {
    const consulta = new URLSearchParams({ sendUpdates: 'all' });
    if (evento.comVideochamada) consulta.set('conferenceDataVersion', '1');
    const resposta = await chamar(`${base}${caminho}?${consulta.toString()}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${await tokenDeAcesso()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(corpoDoEvento(evento)),
    });
    if (!resposta.ok) throw await erroDaResposta(resposta);
    return resposta;
  }

  return {
    async criarEvento(evento): Promise<EventoCriado> {
      const resposta = await enviar('POST', '', evento);
      const criado = (await resposta.json().catch(() => null)) as {
        id?: string;
        hangoutLink?: string;
      } | null;
      if (!criado?.id)
        throw new FalhaCalendarioError('Resposta do Google sem identificador do evento', true);
      return {
        id: criado.id,
        ...(criado.hangoutLink === undefined ? {} : { linkVideochamada: criado.hangoutLink }),
      };
    },

    async atualizarEvento(id, evento) {
      await enviar('PATCH', `/${encodeURIComponent(id)}`, evento);
    },

    async cancelarEvento(id) {
      const resposta = await chamar(`${base}/${encodeURIComponent(id)}?sendUpdates=all`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${await tokenDeAcesso()}` },
      });
      // Evento já removido (404 ou 410): o resultado desejado já aconteceu.
      if (!resposta.ok && resposta.status !== 404 && resposta.status !== 410)
        throw await erroDaResposta(resposta);
    },
  };
}
