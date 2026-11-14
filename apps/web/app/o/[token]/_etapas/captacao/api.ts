import { z } from 'zod';

// Situação da etapa "captação" (GET /publico/onboardings/:token/captacao), validada porque a
// página do cliente não confia no formato que chega pela rede.
const esquemaSituacao = z.object({
  situacao: z.enum(['bloqueada', 'pendente', 'agendada', 'realizada']),
  motivoBloqueio: z.string().optional(),
  intervaloDiasMin: z.number(),
  agendamento: z
    .object({
      id: z.string(),
      inicio: z.string(),
      fim: z.string(),
      status: z.string(),
      dados: z
        .object({
          presencial: z.boolean(),
          local: z.string().nullable(),
          contatoLocal: z.string().nullable(),
          observacoes: z.string().nullable(),
        })
        .nullable(),
    })
    .optional(),
});

export type SituacaoCaptacao = z.infer<typeof esquemaSituacao>;

export type ResultadoSituacao =
  | { readonly tipo: 'ok'; readonly situacao: SituacaoCaptacao }
  | { readonly tipo: 'expirado' }
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'falha'; readonly mensagem: string };

export async function buscarSituacaoCaptacao(
  baseUrl: string,
  token: string,
  fetcher: typeof fetch,
): Promise<ResultadoSituacao> {
  try {
    const resposta = await fetcher(
      `${baseUrl}/publico/onboardings/${encodeURIComponent(token)}/captacao`,
      { cache: 'no-store' },
    );
    if (resposta.status === 410) return { tipo: 'expirado' };
    if (resposta.status === 404) return { tipo: 'invalido' };
    const corpo = esquemaSituacao.safeParse(await resposta.json().catch(() => null));
    return resposta.status === 200 && corpo.success
      ? { tipo: 'ok', situacao: corpo.data }
      : { tipo: 'falha', mensagem: 'Não foi possível carregar a captação.' };
  } catch {
    return { tipo: 'falha', mensagem: 'Não foi possível falar com o servidor.' };
  }
}

const esquemaPrazo = z.union([
  z.object({ definido: z.literal(true), data: z.string() }),
  z.object({ definido: z.literal(false) }),
]);

export type PrazoDoCliente = z.infer<typeof esquemaPrazo>;

/** Prazo de liberação dos primeiros conteúdos (RN-45). Falha vira "a definir": não trava a etapa. */
export async function buscarPrazo(
  baseUrl: string,
  token: string,
  fetcher: typeof fetch,
): Promise<PrazoDoCliente> {
  try {
    const resposta = await fetcher(
      `${baseUrl}/publico/onboardings/${encodeURIComponent(token)}/prazo`,
      { cache: 'no-store' },
    );
    const corpo = esquemaPrazo.safeParse(await resposta.json().catch(() => null));
    return resposta.status === 200 && corpo.success ? corpo.data : { definido: false };
  } catch {
    return { definido: false };
  }
}
