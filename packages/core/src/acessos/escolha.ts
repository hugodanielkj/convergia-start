import {
  ehPlataformaAcesso,
  PLATAFORMAS_ACESSO,
  type PlataformaAcesso,
  type SituacaoAcesso,
} from './plataformas.js';

export type ResultadoEscolha =
  | { readonly ok: true; readonly plataformas: PlataformaAcesso[] }
  | { readonly ok: false; readonly erro: 'nenhuma_plataforma' | 'plataforma_desconhecida' };

/**
 * RN-27 (revisada com o PO em 2026-11-14): a agência escolhe as plataformas de cada cliente e pode
 * desmarcar qualquer uma, mas precisa ficar com pelo menos uma.
 */
export function validarEscolha(plataformas: readonly string[]): ResultadoEscolha {
  if (!plataformas.every(ehPlataformaAcesso)) return { ok: false, erro: 'plataforma_desconhecida' };
  const escolhidas = PLATAFORMAS_ACESSO.filter((p) => plataformas.includes(p));
  if (escolhidas.length === 0) return { ok: false, erro: 'nenhuma_plataforma' };
  return { ok: true, plataformas: escolhidas };
}

/**
 * RN-27: a escolha trava quando a etapa começa: o cliente avisou em alguma plataforma ou a agência
 * já marcou alguma como concedida ou inválida.
 */
export const escolhaTravada = (situacoes: readonly SituacaoAcesso[]): boolean =>
  situacoes.some((s) => s.informado || s.status !== 'pendente');
