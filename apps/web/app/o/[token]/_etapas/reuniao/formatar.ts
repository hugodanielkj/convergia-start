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
