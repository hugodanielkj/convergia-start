/** Fonte de tempo injetável, para regras com data serem testáveis. */
export interface Relogio {
  agora(): Date;
}

export const relogioSistema: Relogio = { agora: () => new Date() };

export function relogioFixo(data: Date): Relogio {
  return { agora: () => new Date(data) };
}
