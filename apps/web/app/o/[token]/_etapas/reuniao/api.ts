import { z } from 'zod';

// Respostas das rotas públicas de agenda (apps/api/src/modulos/agenda), validadas porque a página
// do cliente não confia no formato que chega pela rede. O token só aparece no caminho da URL.
const esquemaSlot = z.object({ inicio: z.string(), fim: z.string(), hora: z.string() });
const esquemaLista = z.object({
  fuso: z.string(),
  dias: z.array(z.object({ data: z.string(), slots: z.array(esquemaSlot) })),
});
const esquemaAgendamento = z.object({
  id: z.string(),
  tipo: z.enum(['reuniao', 'captacao']),
  inicio: z.string(),
  fim: z.string(),
  status: z.string(),
  reagendamentosRestantes: z.number(),
  podeReagendar: z.boolean(),
  motivoNegado: z.string().optional(),
});
const esquemaNegado = z.object({ mensagem: z.string() });

export type ListaDeHorarios = z.infer<typeof esquemaLista>;
export type AgendamentoDoCliente = z.infer<typeof esquemaAgendamento>;

type SituacaoDoLink = { readonly tipo: 'expirado' } | { readonly tipo: 'invalido' };
type Falha = { readonly tipo: 'falha'; readonly mensagem: string };

export type ResultadoHorarios =
  { readonly tipo: 'ok'; readonly lista: ListaDeHorarios } | SituacaoDoLink | Falha;
export type ResultadoAgendamentos =
  { readonly tipo: 'ok'; readonly agendamentos: AgendamentoDoCliente[] } | SituacaoDoLink | Falha;
export type ResultadoEscolha =
  | { readonly tipo: 'ok' }
  | { readonly tipo: 'indisponivel'; readonly lista: ListaDeHorarios }
  | { readonly tipo: 'ja_agendado' }
  | { readonly tipo: 'negado'; readonly mensagem: string }
  | SituacaoDoLink
  | Falha;

export interface ApiReuniao {
  listarHorarios(token: string, fuso: string): Promise<ResultadoHorarios>;
  listarAgendamentos(token: string): Promise<ResultadoAgendamentos>;
  reservar(token: string, inicio: string, fuso: string): Promise<ResultadoEscolha>;
  reagendar(
    token: string,
    agendamentoId: string,
    inicio: string,
    fuso: string,
  ): Promise<ResultadoEscolha>;
}

export interface OpcoesApiReuniao {
  /** `/api` no navegador (rewrite da web) ou a URL interna da API no servidor. */
  readonly baseUrl: string;
  readonly fetcher: typeof fetch;
}

const FALHA_DE_REDE =
  'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.';
const FALHA: Falha = { tipo: 'falha', mensagem: 'Algo deu errado. Tente de novo em instantes.' };

export function criarApiReuniao({ baseUrl, fetcher }: OpcoesApiReuniao): ApiReuniao {
  const base = (token: string) => `${baseUrl}/publico/onboardings/${encodeURIComponent(token)}`;

  async function chamar(url: string, corpo?: unknown) {
    try {
      const resposta = await fetcher(url, {
        method: corpo === undefined ? 'GET' : 'POST',
        cache: 'no-store',
        ...(corpo === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }),
      });
      return {
        status: resposta.status,
        json: (await resposta.json().catch(() => null)) as unknown,
      };
    } catch {
      return null;
    }
  }

  const doLink = (status: number): SituacaoDoLink | null =>
    status === 410 ? { tipo: 'expirado' } : status === 404 ? { tipo: 'invalido' } : null;

  /** Interpreta a resposta de reservar ou reagendar, que têm os mesmos desfechos. */
  function desfecho(
    resposta: { status: number; json: unknown } | null,
    aoNegar: boolean,
  ): ResultadoEscolha {
    if (resposta === null) return { tipo: 'falha', mensagem: FALHA_DE_REDE };
    const { status, json } = resposta;
    if (status === 200 || status === 201) return { tipo: 'ok' };
    if (status === 409) {
      const lista = esquemaLista.safeParse(json);
      if (lista.success) return { tipo: 'indisponivel', lista: lista.data };
      return { tipo: 'ja_agendado' };
    }
    if (status === 422 && aoNegar) {
      const negado = esquemaNegado.safeParse(json);
      return negado.success ? { tipo: 'negado', mensagem: negado.data.mensagem } : FALHA;
    }
    return FALHA;
  }

  return {
    async listarHorarios(token, fuso) {
      const consulta = new URLSearchParams({ tipo: 'reuniao', fuso });
      const resposta = await chamar(`${base(token)}/slots?${consulta.toString()}`);
      if (resposta === null) return { tipo: 'falha', mensagem: FALHA_DE_REDE };
      const link = doLink(resposta.status);
      if (link) return link;
      const lista = esquemaLista.safeParse(resposta.json);
      return resposta.status === 200 && lista.success ? { tipo: 'ok', lista: lista.data } : FALHA;
    },

    async listarAgendamentos(token) {
      const resposta = await chamar(`${base(token)}/agendamentos`);
      if (resposta === null) return { tipo: 'falha', mensagem: FALHA_DE_REDE };
      const link = doLink(resposta.status);
      if (link) return link;
      const corpo = z
        .object({ agendamentos: z.array(esquemaAgendamento) })
        .safeParse(resposta.json);
      return resposta.status === 200 && corpo.success
        ? { tipo: 'ok', agendamentos: corpo.data.agendamentos }
        : FALHA;
    },

    async reservar(token, inicio, fuso) {
      const resposta = await chamar(`${base(token)}/agendamentos`, {
        tipo: 'reuniao',
        inicio,
        fuso,
      });
      const link = resposta === null ? null : doLink(resposta.status);
      return link ?? desfecho(resposta, false);
    },

    async reagendar(token, agendamentoId, inicio, fuso) {
      const resposta = await chamar(
        `${base(token)}/agendamentos/${encodeURIComponent(agendamentoId)}/reagendar`,
        {
          inicio,
          fuso,
        },
      );
      if (resposta !== null && resposta.status === 404) {
        const erro = z.object({ erro: z.string() }).safeParse(resposta.json);
        // Link inválido e agendamento inexistente são 404 diferentes: só o primeiro é do link.
        return erro.success && erro.data.erro === 'AGENDAMENTO_NAO_ENCONTRADO'
          ? FALHA
          : { tipo: 'invalido' };
      }
      const link = resposta === null ? null : doLink(resposta.status);
      return link ?? desfecho(resposta, true);
    },
  };
}
