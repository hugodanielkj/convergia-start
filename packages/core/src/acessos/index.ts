import type { Plataforma } from '../base/config.js';

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

export type StatusEtapaAcessos = 'pendente' | 'em_andamento' | 'concluida';

/**
 * RN-27: a etapa conclui quando todas as plataformas obrigatórias estão `concedido`.
 * Antes disso, qualquer movimento (cliente avisou, agência confirmou ou invalidou) é "em andamento".
 */
export function etapaAcessos(
  situacoes: Readonly<Partial<Record<Plataforma, SituacaoAcesso>>>,
  obrigatorias: readonly Plataforma[],
): StatusEtapaAcessos {
  if (obrigatorias.every((p) => situacoes[p]?.status === 'concedido')) return 'concluida';
  const houveMovimento = Object.values(situacoes).some(
    (x) => x.informado || x.status !== 'pendente',
  );
  return houveMovimento ? 'em_andamento' : 'pendente';
}

export type ResultadoMarcacao =
  | { readonly ok: true; readonly motivo: string | null }
  | { readonly ok: false; readonly erro: 'motivo_obrigatorio' | 'motivo_longo' };

/** RN-28: a agência marca `concedido` ou `invalido`; o inválido precisa de motivo. */
export function validarMarcacao(
  status: 'concedido' | 'invalido',
  motivo: string | undefined,
): ResultadoMarcacao {
  if (status === 'concedido') return { ok: true, motivo: null };
  const texto = (motivo ?? '').trim();
  if (texto === '') return { ok: false, erro: 'motivo_obrigatorio' };
  if (texto.length > LIMITE_MOTIVO) return { ok: false, erro: 'motivo_longo' };
  return { ok: true, motivo: texto };
}

interface Instrucao {
  readonly nome: string;
  readonly passos: readonly string[];
}

const PEDIR = 'peça à agência o e-mail ou ID para convidar';
const alvo = (identificador: string | null): string =>
  identificador ?? `o identificador da agência (${PEDIR})`;

/**
 * RN-22: passo a passo por parceiro/permissão, sem senha (D-05, RN-29).
 * Instagram e Facebook usam o mesmo Meta Business Manager.
 */
export function instrucoesDe(
  plataforma: PlataformaAcesso,
  identificador: string | null,
): Instrucao {
  const id = alvo(identificador);
  switch (plataforma) {
    case 'instagram':
      return {
        nome: 'Instagram',
        passos: [
          'Abra o Meta Business Suite (business.facebook.com) e entre com a conta da sua empresa.',
          'Vá em Configurações > Pessoas e adicione um novo parceiro ou pessoa.',
          `Informe ${id} e dê acesso ao perfil do Instagram.`,
          'Confirme e volte aqui para avisar que já adicionou.',
        ],
      };
    case 'facebook':
      return {
        nome: 'Facebook',
        passos: [
          'Abra o Meta Business Suite (business.facebook.com) e entre com a conta da sua empresa.',
          'Vá em Configurações > Parceiros e escolha "Dar acesso a um parceiro".',
          `Informe ${id} e dê acesso à Página do Facebook.`,
          'Confirme e volte aqui para avisar que já adicionou.',
        ],
      };
    case 'tiktok':
      return {
        nome: 'TikTok',
        passos: [
          'Abra o TikTok Business Center (business.tiktok.com) e entre com a conta da empresa.',
          'Vá em Membros e convide um novo membro ou parceiro.',
          `Informe ${id} e dê acesso à conta do TikTok.`,
          'Confirme e volte aqui para avisar que já adicionou.',
        ],
      };
    case 'google':
      return {
        nome: 'Google (Perfil da Empresa)',
        passos: [
          'Abra o Perfil da Empresa no Google (business.google.com).',
          'Vá em Configurações do perfil > Gerentes e convide um gerente.',
          `Informe ${id} com a função de gerente.`,
          'Confirme e volte aqui para avisar que já adicionou.',
        ],
      };
  }
}
