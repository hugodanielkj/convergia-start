/** Plataformas da etapa de acessos (D-05, D-06). "outro" fica fora do MVP. */
export const PLATAFORMAS_ACESSO = ['instagram', 'facebook', 'tiktok', 'google'] as const;
export type PlataformaAcesso = (typeof PLATAFORMAS_ACESSO)[number];

export const STATUS_ACESSO = ['pendente', 'concedido', 'invalido'] as const;
export type StatusAcesso = (typeof STATUS_ACESSO)[number];

export const LIMITE_MOTIVO = 500;

export const ehPlataformaAcesso = (valor: string): valor is PlataformaAcesso =>
  (PLATAFORMAS_ACESSO as readonly string[]).includes(valor);

export interface SituacaoAcesso {
  readonly status: StatusAcesso;
  /** O cliente avisou que já adicionou a agência (ainda falta a agência confirmar). */
  readonly informado: boolean;
}
