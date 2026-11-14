import { adicionarDias, dataValida, diaDaSemana } from './datas.js';
import { diaBloqueado, type Bloqueio } from './dias.js';
import { feriadoNacional } from './feriados.js';
import { dataLocal, instanteLocal } from './fuso-agenda.js';
import { minutosDoDia, type JanelaDisponibilidade } from './janelas.js';

/** Um horário que o cliente pode escolher, em instantes UTC (RN-32). */
export interface Slot {
  readonly inicio: Date;
  readonly fim: Date;
}

export interface EntradaSlots {
  /** Janelas do tipo e do profissional que interessam (reunião ou captação, RN-30, RN-42). */
  readonly janelas: readonly JanelaDisponibilidade[];
  readonly bloqueios: readonly Bloqueio[];
  /** Agendamentos que já ocupam horário (RN-33). */
  readonly ocupados: readonly Slot[];
  readonly agora: Date;
  /** `antecedencia_minima_horas` da configuração (RN-31). */
  readonly antecedenciaMinimaHoras: number;
  /** Duração de quem não define a sua: `duracao_reuniao_minutos` ou `duracao_captacao_minutos`. */
  readonly duracaoPadraoMinutos: number;
  readonly fusoAgencia: string;
  /** Primeiro e último dia da consulta, `YYYY-MM-DD` no fuso da agência. */
  readonly de: string;
  readonly ate: string;
}

/** Tamanho máximo de uma consulta de slots, em dias. */
export const MAX_DIAS_CONSULTA = 62;

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_HORA = 60 * MS_POR_MINUTO;

function diasDoPeriodo(de: string, ate: string): string[] {
  if (!dataValida(de) || !dataValida(ate) || ate < de) {
    throw new Error('Período inválido: use datas reais, com o fim depois do início');
  }
  const dias: string[] = [];
  for (let dia = de; dia <= ate; dia = adicionarDias(dia, 1)) {
    dias.push(dia);
    if (dias.length > MAX_DIAS_CONSULTA) {
      throw new Error(`Período inválido: no máximo ${String(MAX_DIAS_CONSULTA)} dias por consulta`);
    }
  }
  return dias;
}

function horaTexto(minutos: number): string {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Slots livres no período (RN-30 a RN-33). Para cada dia sem bloqueio nem feriado nacional, corta
 * cada janela em horários da duração configurada, tira os que começam antes da antecedência mínima
 * (RN-31) e os que cruzam um agendamento existente (RN-33). As janelas valem no fuso da agência e
 * o resultado sai em UTC; quem exibe converte para o fuso do cliente com `agruparPorDia` (RN-32).
 * Sábado e domingo só têm slots se a agência cadastrou janela nesses dias.
 */
export function gerarSlots(entrada: EntradaSlots): Slot[] {
  const { fusoAgencia, duracaoPadraoMinutos, antecedenciaMinimaHoras } = entrada;
  dataLocal(entrada.agora, fusoAgencia); // falha cedo se o fuso não existe
  if (!Number.isInteger(duracaoPadraoMinutos) || duracaoPadraoMinutos <= 0) {
    throw new Error('Duração padrão inválida');
  }
  if (!Number.isFinite(antecedenciaMinimaHoras) || antecedenciaMinimaHoras < 0) {
    throw new Error('Antecedência mínima inválida');
  }

  const limite = entrada.agora.getTime() + antecedenciaMinimaHoras * MS_POR_HORA;
  const slots = new Map<number, Slot>();

  for (const dia of diasDoPeriodo(entrada.de, entrada.ate)) {
    if (diaBloqueado(dia, entrada.bloqueios) || feriadoNacional(dia) !== undefined) continue;

    for (const janela of entrada.janelas) {
      if (janela.diaSemana !== diaDaSemana(dia)) continue;
      const duracao = janela.duracaoMinutos ?? duracaoPadraoMinutos;
      const inicioJanela = minutosDoDia(janela.horaInicio);
      const fimJanela = minutosDoDia(janela.horaFim);
      if (inicioJanela === null || fimJanela === null) continue;

      for (let minuto = inicioJanela; minuto + duracao <= fimJanela; minuto += duracao) {
        const inicio = instanteLocal(dia, horaTexto(minuto), fusoAgencia);
        if (inicio === null || inicio.getTime() < limite) continue;

        const fim = new Date(inicio.getTime() + duracao * MS_POR_MINUTO);
        const ocupado = entrada.ocupados.some((o) => o.inicio < fim && inicio < o.fim);
        if (!ocupado) slots.set(inicio.getTime() * 1e4 + duracao, { inicio, fim });
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

export interface SlotsDoDia {
  /** Dia no fuso do cliente, `YYYY-MM-DD`. */
  readonly data: string;
  readonly slots: readonly Slot[];
}

/** Agrupa os slots pelo dia que o relógio do cliente marca, no fuso dele (RN-32). */
export function agruparPorDia(slots: readonly Slot[], fusoCliente: string): SlotsDoDia[] {
  const porDia = new Map<string, Slot[]>();
  for (const slot of slots) {
    const dia = dataLocal(slot.inicio, fusoCliente);
    porDia.set(dia, [...(porDia.get(dia) ?? []), slot]);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, doDia]) => ({ data, slots: doDia }));
}
