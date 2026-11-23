import type { Plataforma } from '../base/config.js';
import { LIMITE_MOTIVO, type PlataformaAcesso, type SituacaoAcesso } from './plataformas.js';

export * from './plataformas.js';
export * from './escolha.js';

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
  /** Texto exibido antes do passo a passo (ex.: pedido de login no grupo e aviso). */
  readonly antes?: readonly string[];
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
        antes: [
          'Passo 1: envie o @ e a senha do Instagram no grupo do WhatsApp.',
          'Se você tem acesso ao Meta Business Suite, faça o passo a passo abaixo. Se não tem, avise no grupo.',
        ],
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
