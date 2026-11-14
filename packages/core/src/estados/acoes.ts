import { RegraVioladaError } from '../base/erros.js';
import type { StatusEtapa, StatusOnboarding, TipoEtapa } from '../onboarding/index.js';
import { derivarStatus, type FatosOnboarding } from './derivar.js';
import { garantirTransicao } from './transicoes.js';

/** Ações da agência sobre o status geral (RN-52, RN-53). */
export const ACOES_MANUAIS = [
  'pausar',
  'retomar',
  'cancelar',
  'registrar_entrega',
  'encerrar',
] as const;
export type AcaoManual = (typeof ACOES_MANUAIS)[number];

interface RegraDaAcao {
  readonly codigo: `RN-${string}`;
  readonly soAdmin: boolean;
  readonly motivoObrigatorio: boolean;
  /** Status de onde a ação parte; `null` = qualquer um que a transição aceite. */
  readonly origem: StatusOnboarding | null;
  readonly destino: (fatos: FatosOnboarding) => StatusOnboarding;
  readonly recusa: string;
}

const REGRAS: Record<AcaoManual, RegraDaAcao> = {
  pausar: {
    codigo: 'RN-53',
    soAdmin: true,
    motivoObrigatorio: true,
    origem: null,
    destino: () => 'pausado',
    recusa: 'Só dá para pausar um onboarding ativo que não esteja pausado',
  },
  retomar: {
    codigo: 'RN-53',
    soAdmin: true,
    motivoObrigatorio: false,
    origem: 'pausado',
    destino: derivarStatus,
    recusa: 'Só dá para retomar um onboarding pausado',
  },
  cancelar: {
    codigo: 'RN-53',
    soAdmin: true,
    motivoObrigatorio: true,
    origem: null,
    destino: () => 'cancelado',
    recusa: 'Este onboarding já foi encerrado',
  },
  registrar_entrega: {
    codigo: 'RN-52',
    soAdmin: false,
    motivoObrigatorio: false,
    origem: 'em_producao',
    destino: () => 'primeiro_conteudo_entregue',
    recusa: 'A entrega só pode ser registrada com o onboarding em produção',
  },
  encerrar: {
    codigo: 'RN-52',
    soAdmin: false,
    motivoObrigatorio: false,
    origem: 'primeiro_conteudo_entregue',
    destino: () => 'concluido',
    recusa: 'O encerramento só pode ser confirmado depois da entrega dos primeiros conteúdos',
  },
};

/** RN-53: pausar, retomar e cancelar são do Admin. Entrega e encerramento, também do responsável. */
export function exigeAdmin(acao: AcaoManual): boolean {
  return REGRAS[acao].soAdmin;
}

/** Motivo sem espaços nas pontas; vazio é recusado (RN-53, RN-54). */
export function motivoObrigatorio(codigo: `RN-${string}`, motivo: string | undefined): string {
  const limpo = motivo?.trim() ?? '';
  if (!limpo) throw new RegraVioladaError(codigo, 'Informe o motivo');
  return limpo;
}

/** Motivo limpo, ou `null` se a ação não exige e veio vazio. Pausar e cancelar exigem (RN-53). */
export function motivoDaAcao(acao: AcaoManual, motivo: string | undefined): string | null {
  const { codigo, motivoObrigatorio: exige } = REGRAS[acao];
  if (exige) return motivoObrigatorio(codigo, motivo);
  return motivo?.trim() || null;
}

/** Status de destino de uma ação da agência, ou erro se ela não cabe no status atual. */
export function destinoDaAcao(
  acao: AcaoManual,
  atual: StatusOnboarding,
  fatos: FatosOnboarding,
): StatusOnboarding {
  const regra = REGRAS[acao];
  const destino = regra.destino(fatos);
  if (regra.origem !== null && atual !== regra.origem) {
    throw new RegraVioladaError(regra.codigo, regra.recusa);
  }
  try {
    garantirTransicao(atual, destino);
  } catch {
    throw new RegraVioladaError(regra.codigo, regra.recusa);
  }
  return destino;
}

/** Etapas que a agência reabre por este caminho (decisão 2026-11-14-a-estados-onboarding). */
const ETAPAS_REABRIVEIS: ReadonlySet<TipoEtapa> = new Set(['formulario']);

/** RN-54: só etapa concluída, de um onboarding que não foi cancelado nem concluído. */
export function garantirReabertura(
  tipo: TipoEtapa,
  statusEtapa: StatusEtapa,
  statusOnboarding: StatusOnboarding,
): void {
  if (!ETAPAS_REABRIVEIS.has(tipo)) {
    throw new RegraVioladaError('RN-54', 'Esta etapa não é reaberta por aqui');
  }
  if (statusEtapa !== 'concluida') {
    throw new RegraVioladaError('RN-54', 'Só uma etapa concluída pode ser reaberta');
  }
  if (statusOnboarding === 'cancelado' || statusOnboarding === 'concluido') {
    throw new RegraVioladaError('RN-54', 'Este onboarding já foi encerrado');
  }
}
