export type StatusAgendamento =
  'agendado' | 'reagendado' | 'cancelado' | 'realizado' | 'nao_compareceu';

export type MotivoReagendamentoNegado = 'status_invalido' | 'limite_atingido' | 'prazo_encerrado';

export interface EntradaReagendamento {
  readonly status: StatusAgendamento;
  /** Quantas vezes o cliente já reagendou este agendamento. */
  readonly reagendamentosFeitos: number;
  /** `limite_reagendamentos` da configuração (RN-35). */
  readonly limiteReagendamentos: number;
  /** Horário atual do agendamento, que seria trocado. */
  readonly inicio: Date;
  readonly agora: Date;
  /** `antecedencia_reagendamento_horas` da configuração (RN-35). */
  readonly antecedenciaReagendamentoHoras: number;
}

export type ResultadoReagendamento =
  | { readonly ok: true; readonly restantesDepois: number }
  | { readonly ok: false; readonly motivo: MotivoReagendamentoNegado };

const MS_POR_HORA = 60 * 60 * 1000;
const ATIVOS: ReadonlySet<StatusAgendamento> = new Set(['agendado', 'reagendado']);

export function reagendamentosRestantes(feitos: number, limite: number): number {
  return Math.max(0, limite - feitos);
}

/**
 * O cliente pode reagendar? (RN-35) Precisa estar ativo, ter reagendamentos sobrando e faltar pelo
 * menos a antecedência configurada até o horário atual (o limite exato ainda vale). Recusado, ele
 * deve falar com a agência.
 */
export function avaliarReagendamento(entrada: EntradaReagendamento): ResultadoReagendamento {
  if (!ATIVOS.has(entrada.status)) return { ok: false, motivo: 'status_invalido' };
  if (entrada.reagendamentosFeitos >= entrada.limiteReagendamentos) {
    return { ok: false, motivo: 'limite_atingido' };
  }
  const limite = entrada.inicio.getTime() - entrada.antecedenciaReagendamentoHoras * MS_POR_HORA;
  if (entrada.agora.getTime() > limite) return { ok: false, motivo: 'prazo_encerrado' };
  return {
    ok: true,
    restantesDepois: reagendamentosRestantes(
      entrada.reagendamentosFeitos + 1,
      entrada.limiteReagendamentos,
    ),
  };
}

const FINAIS: readonly StatusAgendamento[] = ['realizado', 'nao_compareceu', 'cancelado'];

/**
 * A agência pode mudar o status? (RN-36, RN-37, seção 7) De um agendamento ativo para um estado
 * final. `reagendado` só acontece quando o cliente reagenda, então não é escolhido aqui.
 */
export function mudancaDeStatusPermitida(de: StatusAgendamento, para: StatusAgendamento): boolean {
  return ATIVOS.has(de) && FINAIS.includes(para);
}
