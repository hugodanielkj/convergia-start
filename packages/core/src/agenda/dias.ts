import { dataValida, diaDaSemana } from './datas.js';
import { feriadoNacional } from './feriados.js';

export interface Bloqueio {
  /** Primeiro dia bloqueado, `YYYY-MM-DD`. */
  readonly dataInicio: string;
  /** Último dia bloqueado (inclusive). Igual ao início para um dia só. */
  readonly dataFim: string;
  readonly motivo: string;
}

export type ErroBloqueio =
  'data_invalida' | 'intervalo_invalido' | 'motivo_obrigatorio' | 'motivo_invalido';

export type ResultadoBloqueio =
  | { readonly ok: true; readonly bloqueio: Bloqueio }
  | { readonly ok: false; readonly erro: ErroBloqueio };

/** Tamanho máximo do motivo de um bloqueio. */
export const MOTIVO_BLOQUEIO_MAX = 200;

/** Valida um bloqueio de período (RN-44) e devolve o motivo sem espaços nas pontas. */
export function validarBloqueio(bloqueio: Bloqueio): ResultadoBloqueio {
  const { dataInicio, dataFim } = bloqueio;
  if (!dataValida(dataInicio) || !dataValida(dataFim)) return { ok: false, erro: 'data_invalida' };
  if (dataFim < dataInicio) return { ok: false, erro: 'intervalo_invalido' };

  const motivo = bloqueio.motivo.trim();
  if (motivo === '') return { ok: false, erro: 'motivo_obrigatorio' };
  if (motivo.length > MOTIVO_BLOQUEIO_MAX) return { ok: false, erro: 'motivo_invalido' };
  return { ok: true, bloqueio: { dataInicio, dataFim, motivo } };
}

/** O dia cai dentro de algum bloqueio cadastrado pela agência. */
export function diaBloqueado(data: string, bloqueios: readonly Bloqueio[]): boolean {
  return bloqueios.some((b) => b.dataInicio <= data && data <= b.dataFim);
}

/**
 * Dia útil (RN-44): não é sábado nem domingo, nem feriado nacional, nem está bloqueado.
 * O prazo de produção (S4-5) e os slots (S2-6) usam esta regra.
 */
export function diaUtil(data: string, bloqueios: readonly Bloqueio[]): boolean {
  const semana = diaDaSemana(data);
  if (semana === 0 || semana === 6) return false;
  return feriadoNacional(data) === undefined && !diaBloqueado(data, bloqueios);
}
