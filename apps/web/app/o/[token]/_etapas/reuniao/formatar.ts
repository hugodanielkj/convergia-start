/** Hora (`HH:mm`) que o relógio do fuso marca naquele instante. */
export function formatarHora(instante: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instante));
}

const DIA_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** `2026-11-17` vira "terça-feira, 17 de novembro". A data já está no fuso certo, só se escreve por extenso. */
export function formatarDia(data: string): string {
  return DIA_POR_EXTENSO.format(new Date(`${data}T12:00:00Z`));
}

/** Dia por extenso e hora de um instante, no fuso do cliente. */
export function formatarDiaEHora(instante: string, fuso: string): string {
  const dia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(instante));
  return `${dia}, ${formatarHora(instante, fuso)}`;
}

/** Fuso do navegador do cliente, ou `UTC` se ele não informar. */
export function fusoDoNavegador(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Fusos para o cliente escolher; o dele sempre vem primeiro (RN-32). */
export function fusosDisponiveis(fusoDoCliente: string): string[] {
  const todos =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set([fusoDoCliente, 'America/Sao_Paulo', ...todos])];
}

export interface PartesDoDia {
  /** "ter" */
  semana: string;
  /** "17" */
  dia: string;
  /** "nov" */
  mes: string;
}

const partes = (formato: Intl.DateTimeFormat, data: Date): PartesDoDia => {
  const lista = formato.formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    (lista.find((p) => p.type === tipo)?.value ?? '').replace('.', '');
  return { semana: valor('weekday'), dia: valor('day'), mes: valor('month') };
};

const opcoesCurtas = (timeZone: string): Intl.DateTimeFormatOptions => ({
  timeZone,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** `2026-11-17` em pedaços curtos para os botões de dia: "ter", "17", "nov". */
export function partesDoDia(data: string): PartesDoDia {
  return partes(
    new Intl.DateTimeFormat('pt-BR', opcoesCurtas('UTC')),
    new Date(`${data}T12:00:00Z`),
  );
}

/** Os mesmos pedaços para um instante, no fuso do cliente (cartão do horário marcado). */
export function partesDoInstante(instante: string, fuso: string): PartesDoDia {
  return partes(new Intl.DateTimeFormat('pt-BR', opcoesCurtas(fuso)), new Date(instante));
}

export type Periodo = 'Manhã' | 'Tarde' | 'Noite';

/** Período do dia de um horário `HH:mm`, para agrupar os horários como em agendas conhecidas. */
export function periodoDaHora(hora: string): Periodo {
  const h = Number(hora.slice(0, 2));
  if (h < 12) return 'Manhã';
  return h < 18 ? 'Tarde' : 'Noite';
}
