import type { SituacaoAcesso } from '../acessos/index.js';

/** Ordem das etapas na página do cliente (RN-79). */
export const ORDEM_ETAPAS = ['formulario', 'acessos', 'reuniao', 'captacao'] as const;
export type EtapaCliente = (typeof ORDEM_ETAPAS)[number];

/** O que já aconteceu no onboarding; cada fato é o "feito" de uma etapa (RN-79). */
export interface FatosLiberacao {
  /** Formulário enviado (RN-17). */
  readonly formularioEnviado: boolean;
  /** O cliente avisou, ou a agência concedeu, em todas as plataformas escolhidas (RN-27). */
  readonly acessosAvisados: boolean;
  /** Reunião agendada, reagendada ou realizada. */
  readonly reuniaoAgendada: boolean;
  /** Captação agendada, reagendada ou realizada. */
  readonly captacaoAgendada: boolean;
}

export interface SituacaoLiberacao {
  readonly etapa: EtapaCliente;
  readonly liberada: boolean;
  readonly feita: boolean;
}

const FEITA: Record<EtapaCliente, keyof FatosLiberacao> = {
  formulario: 'formularioEnviado',
  acessos: 'acessosAvisados',
  reuniao: 'reuniaoAgendada',
  captacao: 'captacaoAgendada',
};

/**
 * RN-79 (nova, PO 2026-11-14): formulário enviado libera Acessos; avisos em todas as plataformas
 * liberam Reunião; reunião agendada libera Captação. Se algo anterior volta atrás, só trava de
 * novo o que ainda não foi feito: uma etapa feita continua liberada.
 */
export function liberacaoEtapas(fatos: FatosLiberacao): SituacaoLiberacao[] {
  const resultado: SituacaoLiberacao[] = [];
  for (const etapa of ORDEM_ETAPAS) {
    const feita = fatos[FEITA[etapa]];
    const anterior = resultado.at(-1);
    const liberada = !anterior || feita || (anterior.liberada && anterior.feita);
    resultado.push({ etapa, liberada, feita });
  }
  return resultado;
}

/** RN-79: plataforma conta como avisada se a agência concedeu ou o cliente avisou (e não é inválida). */
export const acessosAvisados = (situacoes: readonly SituacaoAcesso[]): boolean =>
  situacoes.length > 0 &&
  situacoes.every((s) => s.status === 'concedido' || (s.informado && s.status === 'pendente'));

/** Etapa em que a página abre: a primeira liberada e ainda não feita; com tudo feito, a última. */
export function etapaInicial(situacoes: readonly SituacaoLiberacao[]): EtapaCliente {
  return situacoes.find((s) => s.liberada && !s.feita)?.etapa ?? ORDEM_ETAPAS[3];
}

export function proximaEtapa(etapa: EtapaCliente): EtapaCliente | null {
  return ORDEM_ETAPAS[ORDEM_ETAPAS.indexOf(etapa) + 1] ?? null;
}

export const ehEtapaCliente = (valor: string): valor is EtapaCliente =>
  (ORDEM_ETAPAS as readonly string[]).includes(valor);
