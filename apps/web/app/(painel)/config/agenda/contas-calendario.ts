// Contas do calendário da agenda. Datas são texto `YYYY-MM-DD` sem fuso (o "hoje" vem da API, no
// fuso da agência); a conta usa UTC só para somar dias, nunca o relógio do navegador.

export type Visao = 'semana' | 'mes';
export type Tipo = 'reuniao' | 'captacao';

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 24 * 60 * 60 * 1000;

const paraUtc = (data: string): Date => {
  const partes = FORMATO.exec(data);
  if (!partes) throw new Error(`Data inválida: ${data}`);
  return new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
};
const paraTexto = (d: Date): string => d.toISOString().slice(0, 10);

export function dataValida(data: string): boolean {
  return FORMATO.test(data) && paraTexto(paraUtc(data)) === data;
}

export const adicionarDias = (data: string, dias: number): string =>
  paraTexto(new Date(paraUtc(data).getTime() + dias * MS_DIA));

/** 0 = domingo ... 6 = sábado. */
export const diaDaSemana = (data: string): number => paraUtc(data).getUTCDay();

/** Segunda-feira da semana da data (a agência pensa a semana de segunda a domingo). */
export function inicioDaSemana(data: string): string {
  return adicionarDias(data, -((diaDaSemana(data) + 6) % 7));
}

export const diasDaSemana = (data: string): string[] => {
  const inicio = inicioDaSemana(data);
  return Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
};

export const primeiroDoMes = (data: string): string => `${data.slice(0, 7)}-01`;

/** Semanas (segunda a domingo) que cobrem o mês da data, com os dias vizinhos nas pontas. */
export function semanasDoMes(data: string): string[][] {
  const primeiro = primeiroDoMes(data);
  const proximoMes = paraTexto(
    new Date(Date.UTC(paraUtc(primeiro).getUTCFullYear(), paraUtc(primeiro).getUTCMonth() + 1, 1)),
  );
  const ultimo = adicionarDias(proximoMes, -1);
  const semanas: string[][] = [];
  for (let inicio = inicioDaSemana(primeiro); inicio <= ultimo; inicio = adicionarDias(inicio, 7)) {
    semanas.push(diasDaSemana(inicio));
  }
  return semanas;
}

/** Mesmo dia do mês anterior/seguinte, limitado ao último dia do mês de chegada. */
export function somarMeses(data: string, meses: number): string {
  const base = paraUtc(data);
  const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(base.getUTCDate(), ultimoDia));
  return paraTexto(alvo);
}

/** Primeiro e último dia exibidos pela visão (inclui os dias vizinhos do mês). */
export function periodoVisivel(visao: Visao, data: string): { de: string; ate: string } {
  if (visao === 'semana') {
    const dias = diasDaSemana(data);
    return { de: dias[0] ?? data, ate: dias[6] ?? data };
  }
  const semanas = semanasDoMes(data);
  return { de: semanas[0]?.[0] ?? data, ate: semanas.at(-1)?.[6] ?? data };
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

export const nomeDoMes = (data: string): string => {
  const mes = MESES[Number(data.slice(5, 7)) - 1] ?? '';
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${data.slice(0, 4)}`;
};

export const numeroDoDia = (data: string): number => Number(data.slice(8, 10));

/** "26 de novembro" para o título do painel do dia. */
export const diaPorExtenso = (data: string): string =>
  `${String(numeroDoDia(data))} de ${MESES[Number(data.slice(5, 7)) - 1] ?? ''}`;

export const rotuloMesCurto = (data: string): string =>
  `${String(numeroDoDia(data))}/${data.slice(5, 7)}`;

/** Título da semana: "23/11 a 29/11/2026". */
export function nomeDaSemana(data: string): string {
  const dias = diasDaSemana(data);
  const [ini, fim] = [dias[0] ?? data, dias[6] ?? data];
  return `${rotuloMesCurto(ini)} a ${rotuloMesCurto(fim)}/${fim.slice(0, 4)}`;
}

export interface HorarioDeTipo {
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos: number | null;
}

interface Janela extends HorarioDeTipo {
  readonly tipo: Tipo;
  readonly diaSemana: number;
}
interface Excecao extends HorarioDeTipo {
  readonly tipo: Tipo;
  readonly data: string;
}

/**
 * Horário que vale numa data para um tipo: as exceções do dia, se houver, no lugar das janelas
 * semanais (a mesma regra do `gerarSlots`, no core). `personalizado` diz se veio de exceção.
 */
export function horarioDoDia(
  data: string,
  tipo: Tipo,
  janelas: readonly Janela[],
  excecoes: readonly Excecao[],
): { horarios: HorarioDeTipo[]; personalizado: boolean } {
  const ordenar = (a: HorarioDeTipo, b: HorarioDeTipo) => a.horaInicio.localeCompare(b.horaInicio);
  const doDia = excecoes.filter((e) => e.tipo === tipo && e.data === data);
  if (doDia.length > 0) return { horarios: [...doDia].sort(ordenar), personalizado: true };
  const semana = diaDaSemana(data);
  return {
    horarios: janelas.filter((j) => j.tipo === tipo && j.diaSemana === semana).sort(ordenar),
    personalizado: false,
  };
}

export interface ParametrosDaTela {
  readonly visao: Visao;
  readonly data: string;
  readonly dia: string | null;
}

type Param = string | string[] | undefined;
const primeiro = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

/** Lê `?visao=&data=&dia=` da URL; qualquer valor estranho cai no padrão (semana de hoje). */
export function lerParametros(
  busca: Readonly<Record<string, Param>>,
  hoje: string,
): ParametrosDaTela {
  const visao: Visao = primeiro(busca.visao) === 'mes' ? 'mes' : 'semana';
  const dia = primeiro(busca.dia);
  const data = primeiro(busca.data);
  const diaOk = dia !== undefined && dataValida(dia) ? dia : null;
  const dataOk = data !== undefined && dataValida(data) ? data : (diaOk ?? hoje);
  return { visao, data: dataOk, dia: diaOk };
}

export function enderecoDoCalendario(p: {
  visao: Visao;
  data: string;
  dia?: string | null | undefined;
}): string {
  const busca = new URLSearchParams({ visao: p.visao, data: p.data });
  if (p.dia) busca.set('dia', p.dia);
  return `/config/agenda?${busca.toString()}`;
}
