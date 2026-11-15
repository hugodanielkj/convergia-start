import type { TipoEtapa } from '../onboarding/index.js';
import { ultimoHorarioPermitidoAte, type JanelaEnvio } from './janela.js';

const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Limites da tela de configuração (RN-56, RN-57). */
export const LIMITES_LEMBRETES = {
  maxDiaPendencia: 30,
  maxQuantidadePendencia: 10,
  maxHorasCompromisso: 168,
  maxItens: 10,
} as const;

/** Quando vence o lembrete de pendência de número `numero` (1, 2, 3...), ou `null` se não existe. */
export function vencimentoPendencia(
  conviteEnviadoEm: Date,
  dias: readonly number[],
  numero: number,
): Date | null {
  const dia = [...dias].sort((a, b) => a - b)[numero - 1];
  return dia === undefined ? null : new Date(conviteEnviadoEm.getTime() + dia * MS_POR_DIA);
}

export interface EntradaPendencia {
  readonly conviteEnviadoEm: Date;
  /** Dias depois do convite (padrão D+1, D+3, D+5). */
  readonly dias: readonly number[];
  readonly maximo: number;
  readonly agora: Date;
}

/**
 * RN-56: número do lembrete de pendência que já venceu, o mais recente, até o máximo configurado.
 * Só o mais recente: se o sistema ficou parado, o cliente não recebe vários de uma vez.
 */
export function lembretePendenciaDevido(e: EntradaPendencia): number | null {
  const ordenados = [...e.dias].sort((a, b) => a - b).slice(0, Math.max(0, e.maximo));
  let devido: number | null = null;
  ordenados.forEach((_, i) => {
    const vence = vencimentoPendencia(e.conviteEnviadoEm, ordenados, i + 1);
    if (vence && vence.getTime() <= e.agora.getTime()) devido = i + 1;
  });
  return devido;
}

/** Quantos lembretes automáticos de pendência existem com esta configuração. */
export function totalLembretesPendencia(dias: readonly number[], maximo: number): number {
  return Math.min(dias.length, Math.max(0, maximo));
}

export interface MomentoCompromisso {
  readonly horas: number;
  readonly em: Date;
}

/**
 * RN-57 + RN-59: momento de cada lembrete antes de um compromisso. O que cairia fora da janela é
 * antecipado para o fim da janela anterior; se coincidir com o lembrete anterior, sai um só
 * (decisão do PO). Lembrete que, antecipado, ficaria antes do anterior também não sai.
 */
export function momentosLembreteCompromisso(
  inicio: Date,
  horas: readonly number[],
  janela: JanelaEnvio,
): MomentoCompromisso[] {
  const momentos: MomentoCompromisso[] = [];
  for (const h of [...new Set(horas)].sort((a, b) => b - a)) {
    const em = ultimoHorarioPermitidoAte(new Date(inicio.getTime() - h * MS_POR_HORA), janela);
    if (!em) continue;
    const anterior = momentos.at(-1);
    if (anterior && em.getTime() <= anterior.em.getTime()) continue;
    momentos.push({ horas: h, em });
  }
  return momentos;
}

export interface EntradaCompromisso {
  readonly inicio: Date;
  /** Quando o agendamento foi feito: lembrete que já venceria antes disso não sai. */
  readonly marcadoEm: Date;
  readonly horas: readonly number[];
  readonly janela: JanelaEnvio;
  readonly agora: Date;
}

/**
 * RN-57: o lembrete de compromisso que venceu, o mais recente, enquanto o compromisso não começou.
 * Só o mais recente, como na pendência.
 */
export function lembreteCompromissoDevido(e: EntradaCompromisso): MomentoCompromisso | null {
  if (e.agora.getTime() >= e.inicio.getTime()) return null;
  const vencidos = momentosLembreteCompromisso(e.inicio, e.horas, e.janela).filter(
    (m) => m.em.getTime() <= e.agora.getTime() && m.em.getTime() >= e.marcadoEm.getTime(),
  );
  return vencidos.at(-1) ?? null;
}

/** O que o cliente precisa fazer em cada etapa, no texto do lembrete (RN-56). */
const TEXTO_ETAPA: Readonly<Record<TipoEtapa, string>> = {
  formulario: 'preencher o formulário',
  acessos: 'liberar os acessos',
  reuniao: 'agendar a reunião',
  captacao: 'agendar a captação',
};

const ORDEM_ETAPAS: readonly TipoEtapa[] = ['formulario', 'acessos', 'reuniao', 'captacao'];

/** RN-56: lista objetiva do que falta, na ordem das etapas. Vazio = nada pendente. */
export function textoPendencias(pendentes: readonly TipoEtapa[]): string {
  const itens = ORDEM_ETAPAS.filter((t) => pendentes.includes(t)).map((t) => TEXTO_ETAPA[t]);
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${String(itens.at(-1))}`;
}
