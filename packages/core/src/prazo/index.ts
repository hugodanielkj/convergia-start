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
