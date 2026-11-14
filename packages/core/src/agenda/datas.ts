// Datas de calendário como texto `YYYY-MM-DD`, sem fuso: "o dia 15 de novembro" é o mesmo dia
// para a agência inteira. Dias úteis são calculados no fuso da agência (D-14), então a conversão
// de instantes (UTC) para data acontece na borda, não aqui.

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraUtc(data: string): Date {
  const partes = FORMATO.exec(data);
  if (!partes) throw new Error(`Data inválida: ${data}`);
  return new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
}

function paraTexto(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Data real do calendário: recusa 30 de fevereiro, mês 13 e formatos soltos. */
export function dataValida(data: string): boolean {
  if (!FORMATO.test(data)) return false;
  return paraTexto(paraUtc(data)) === data;
}

/** Dia da semana de uma data: 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: string): number {
  return paraUtc(data).getUTCDay();
}

export function adicionarDias(data: string, dias: number): string {
  return paraTexto(new Date(paraUtc(data).getTime() + dias * MS_POR_DIA));
}
