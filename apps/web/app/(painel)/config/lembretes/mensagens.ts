/** Configuração de lembretes como a API devolve (RN-56, RN-57, RN-59). */
export interface ConfigLembretes {
  lembretesPendenciaDias: number[];
  maxLembretesPendencia: number;
  lembretesCompromissoHoras: number[];
  janelaEnvioInicio: string;
  janelaEnvioFim: string;
  diasEnvioPermitidos: number[];
}

/** "1, 3, 5" → [1, 3, 5]. `null` se algum item não for um número inteiro positivo. */
export function lerLista(texto: string): number[] | null {
  const itens = texto
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (itens.some((s) => !/^\d+$/.test(s) || Number(s) < 1)) return null;
  return itens.map(Number);
}

export const escreverLista = (valores: readonly number[]): string => valores.join(', ');

const MOTIVOS: Record<string, string> = {
  hora_invalida: 'Confira os horários de envio.',
  fim_antes_do_inicio: 'O horário final precisa ser depois do inicial.',
  sem_dias: 'Marque pelo menos um dia para envio.',
  dia_invalido: 'Dia da semana inválido.',
};

export const mensagemDoMotivo = (motivo: string): string =>
  MOTIVOS[motivo] ?? 'Algum valor está fora do permitido.';
