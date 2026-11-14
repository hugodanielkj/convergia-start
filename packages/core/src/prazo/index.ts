import { adicionarDias, dataValida } from '../agenda/datas.js';
import { diaUtil, type Bloqueio } from '../agenda/dias.js';

/** Quantos dias de calendário o cálculo percorre antes de desistir (bloqueio sem fim, por engano). */
const LIMITE_DE_DIAS = 3 * 366;

/**
 * RN-43 e RN-44: data de liberação dos primeiros conteúdos = data da captação + N dias úteis.
 * O dia da captação não conta; o primeiro dia útil depois dele é o dia 1. Dias úteis excluem
 * sábado, domingo, feriado nacional e os bloqueios da agência. Datas `YYYY-MM-DD` no fuso da
 * agência (D-14).
 */
export function calcularPrazoLiberacao(
  dataCaptacao: string,
  diasUteis: number,
  bloqueios: readonly Bloqueio[],
): string {
  if (!dataValida(dataCaptacao)) throw new Error(`Data da captação inválida: ${dataCaptacao}`);
  if (!Number.isInteger(diasUteis) || diasUteis < 0) {
    throw new Error(`Prazo de produção inválido: ${String(diasUteis)}`);
  }
  let data = dataCaptacao;
  let contados = 0;
  for (let passos = 0; contados < diasUteis; passos += 1) {
    if (passos >= LIMITE_DE_DIAS) {
      throw new Error('Nenhum dia útil encontrado: confira os bloqueios da agência');
    }
    data = adicionarDias(data, 1);
    if (diaUtil(data, bloqueios)) contados += 1;
  }
  return data;
}

/** RN-46: o cliente só é avisado quando a data muda (trocar o horário no mesmo dia não muda). */
export function prazoMudou(anterior: string | null, novo: string | null): boolean {
  return anterior !== novo;
}

export type IndicadorPrazo = 'no_prazo' | 'atencao' | 'atrasado';

/** RN-48: com até este número de dias úteis restantes o prazo entra em atenção. */
export const DIAS_UTEIS_ATENCAO = 2;

/** Dias úteis entre `hoje` (exclusive) e `prazo` (inclusive); zero se o prazo já chegou ou passou. */
export function diasUteisAte(hoje: string, prazo: string, bloqueios: readonly Bloqueio[]): number {
  let contados = 0;
  for (let data = adicionarDias(hoje, 1); data <= prazo; data = adicionarDias(data, 1)) {
    if (diaUtil(data, bloqueios)) contados += 1;
  }
  return contados;
}

export interface EntradaIndicador {
  /** Data do prazo, `YYYY-MM-DD`. */
  readonly prazo: string;
  /** Hoje no fuso da agência (D-14). */
  readonly hoje: string;
  readonly bloqueios: readonly Bloqueio[];
  /** Primeiros conteúdos já entregues: o prazo foi cumprido e não há o que acompanhar. */
  readonly entregue: boolean;
}

/** RN-48: `atrasado` depois do dia do prazo; `atencao` com até 2 dias úteis; senão `no_prazo`. */
export function indicadorPrazo(entrada: EntradaIndicador): IndicadorPrazo | null {
  if (entrada.entregue) return null;
  if (entrada.hoje > entrada.prazo) return 'atrasado';
  return diasUteisAte(entrada.hoje, entrada.prazo, entrada.bloqueios) <= DIAS_UTEIS_ATENCAO
    ? 'atencao'
    : 'no_prazo';
}

/** Tamanho máximo da justificativa do ajuste manual (RN-47). */
export const JUSTIFICATIVA_AJUSTE_MAX = 500;

export type ErroAjustePrazo =
  'data_invalida' | 'data_no_passado' | 'justificativa_obrigatoria' | 'justificativa_invalida';

export type ResultadoAjustePrazo =
  | { readonly ok: true; readonly data: string; readonly justificativa: string }
  | { readonly ok: false; readonly erro: ErroAjustePrazo };

/** RN-47: o responsável muda o prazo com justificativa obrigatória; não se promete data passada. */
export function validarAjustePrazo(entrada: {
  readonly data: string;
  readonly justificativa: string;
  readonly hoje: string;
}): ResultadoAjustePrazo {
  if (!dataValida(entrada.data)) return { ok: false, erro: 'data_invalida' };
  if (entrada.data < entrada.hoje) return { ok: false, erro: 'data_no_passado' };
  const justificativa = entrada.justificativa.trim();
  if (justificativa === '') return { ok: false, erro: 'justificativa_obrigatoria' };
  if (justificativa.length > JUSTIFICATIVA_AJUSTE_MAX) {
    return { ok: false, erro: 'justificativa_invalida' };
  }
  return { ok: true, data: entrada.data, justificativa };
}
