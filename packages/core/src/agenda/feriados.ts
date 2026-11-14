import { adicionarDias } from './datas.js';

export interface Feriado {
  readonly data: string;
  readonly nome: string;
}

/** Desde 2024 o Dia da Consciência Negra é feriado nacional (Lei 14.759/2023). */
const ANO_CONSCIENCIA_NEGRA = 2024;

const FIXOS: readonly { mes: string; dia: string; nome: string }[] = [
  { mes: '01', dia: '01', nome: 'Confraternização Universal' },
  { mes: '04', dia: '21', nome: 'Tiradentes' },
  { mes: '05', dia: '01', nome: 'Dia do Trabalho' },
  { mes: '09', dia: '07', nome: 'Independência do Brasil' },
  { mes: '10', dia: '12', nome: 'Nossa Senhora Aparecida' },
  { mes: '11', dia: '02', nome: 'Finados' },
  { mes: '11', dia: '15', nome: 'Proclamação da República' },
  { mes: '11', dia: '20', nome: 'Dia da Consciência Negra' },
  { mes: '12', dia: '25', nome: 'Natal' },
];

/** Domingo de Páscoa pelo algoritmo gregoriano (Meeus/Jones/Butcher). */
function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${String(ano)}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Feriados nacionais do ano, em ordem (RN-44). Carnaval e Corpus Christi são ponto facultativo
 * e ficam de fora: a agência bloqueia esses dias se parar. Feriado estadual ou municipal
 * também entra como bloqueio. Ver decisoes/2026-11-14-b-feriados-e-bloqueios.md.
 */
export function feriadosNacionais(ano: number): Feriado[] {
  const fixos = FIXOS.filter(
    (f) => ano >= ANO_CONSCIENCIA_NEGRA || f.nome !== 'Dia da Consciência Negra',
  );
  const feriados: Feriado[] = [
    ...fixos.map((f) => ({ data: `${String(ano)}-${f.mes}-${f.dia}`, nome: f.nome })),
    { data: adicionarDias(pascoa(ano), -2), nome: 'Sexta-feira Santa' },
  ];
  return feriados.sort((a, b) => a.data.localeCompare(b.data));
}

export function feriadoNacional(data: string): Feriado | undefined {
  return feriadosNacionais(Number(data.slice(0, 4))).find((f) => f.data === data);
}
