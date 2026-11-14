import type { StatusOnboarding } from '../onboarding/index.js';

export const TOTAL_ETAPAS = 4;

/** RN-63: "X de 4 etapas". */
export function progressoEtapas(etapas: readonly { status: string }[]): {
  concluidas: number;
  total: number;
} {
  return {
    concluidas: etapas.filter((e) => e.status === 'concluida').length,
    total: TOTAL_ETAPAS,
  };
}

export type IndicadorAtencao = 'acesso_invalido' | 'link_expirado' | 'parado';

export interface EntradaAtencao {
  readonly statusGeral: StatusOnboarding;
  readonly acessoInvalido: boolean;
  readonly linkExpirado: boolean;
  readonly ultimaAtividade: Date;
  readonly agora: Date;
  /** `diasSemAcaoParaAlerta` da configuração (RN-58). */
  readonly diasSemAcao: number;
}

const SEM_ATENCAO: ReadonlySet<StatusOnboarding> = new Set(['concluido', 'cancelado', 'pausado']);
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * RN-63: sinais que pedem a atenção da agência. Acesso inválido sempre importa enquanto o
 * onboarding estiver ativo; link expirado e inatividade também. Encerrados e pausados ficam sem alerta.
 */
export function indicadoresAtencao(e: EntradaAtencao): IndicadorAtencao[] {
  if (SEM_ATENCAO.has(e.statusGeral)) return [];
  const resultado: IndicadorAtencao[] = [];
  if (e.acessoInvalido) resultado.push('acesso_invalido');
  if (e.linkExpirado) resultado.push('link_expirado');
  if (e.agora.getTime() - e.ultimaAtividade.getTime() >= e.diasSemAcao * MS_DIA) {
    resultado.push('parado');
  }
  return resultado;
}

export * from './reenvio.js';
