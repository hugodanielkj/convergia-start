import type { StatusOnboarding } from '../onboarding/index.js';
import { transicaoPermitida } from './transicoes.js';

/** Status de um agendamento, como o módulo agenda grava (seção 7). */
export type StatusDoAgendamento =
  'agendado' | 'reagendado' | 'cancelado' | 'realizado' | 'nao_compareceu';

/** Resumo dos agendamentos de um tipo (reunião ou captação) para o status geral. */
export type SituacaoAgendamento = 'nenhum' | 'agendado' | 'realizado';

/** O que o status geral precisa saber do onboarding (RN-49). */
export interface FatosOnboarding {
  readonly abriuLink: boolean;
  readonly conviteEnviado: boolean;
  readonly formularioConcluido: boolean;
  readonly acessosConcluidos: boolean;
  readonly reuniao: SituacaoAgendamento;
  readonly captacao: SituacaoAgendamento;
  readonly entregueEm: Date | null;
}

/** Realizado vale mais que ativo; cancelado e não comparecimento pedem um novo agendamento. */
export function situacaoAgendamento(status: readonly StatusDoAgendamento[]): SituacaoAgendamento {
  if (status.includes('realizado')) return 'realizado';
  if (status.some((s) => s === 'agendado' || s === 'reagendado')) return 'agendado';
  return 'nenhum';
}

/**
 * Etapa reunião ou captação para o cliente: concluída quando há um horário marcado (ou já
 * realizado). Cancelado ou não comparecimento sem novo horário volta a pendente
 * (decisão 2026-11-19-a-etapa-concluida-ao-agendar).
 */
export function statusEtapaAgendada(
  status: readonly StatusDoAgendamento[],
): 'concluida' | 'pendente' {
  return situacaoAgendamento(status) === 'nenhum' ? 'pendente' : 'concluida';
}

/** Status da jornada que as etapas e os agendamentos indicam (RN-49 a RN-52). */
export function derivarStatus(f: FatosOnboarding): StatusOnboarding {
  if (f.entregueEm) return 'primeiro_conteudo_entregue';
  if (f.captacao === 'realizado') return 'em_producao';
  if (!f.abriuLink) return f.conviteEnviado ? 'convite_enviado' : 'criado';
  if (!f.formularioConcluido || !f.acessosConcluidos) return 'em_andamento';
  if (f.reuniao === 'nenhum' || f.captacao === 'nenhum') return 'aguardando_agendamentos';
  return f.reuniao === 'realizado' ? 'aguardando_captacao' : 'aguardando_reuniao';
}

const FORA_DO_AUTOMATICO: ReadonlySet<StatusOnboarding> = new Set([
  'pausado',
  'cancelado',
  'concluido',
]);

/**
 * Para onde o status vai sozinho depois de uma mudança nas etapas ou nos agendamentos. Pausado,
 * cancelado e concluído só mudam por ação da agência; transição inválida mantém o atual.
 */
export function proximoStatusAutomatico(
  atual: StatusOnboarding,
  fatos: FatosOnboarding,
): StatusOnboarding {
  if (FORA_DO_AUTOMATICO.has(atual)) return atual;
  const derivado = derivarStatus(fatos);
  return transicaoPermitida(atual, derivado) ? derivado : atual;
}

const MS_POR_DIA = 86_400_000;

/** RN-52: sem confirmação do responsável, o onboarding conclui N dias corridos após a entrega. */
export function venceuConclusaoAutomatica(entregueEm: Date, agora: Date, dias: number): boolean {
  return agora.getTime() - entregueEm.getTime() >= dias * MS_POR_DIA;
}
