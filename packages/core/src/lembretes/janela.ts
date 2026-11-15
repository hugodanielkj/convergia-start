import {
  adicionarDias,
  dataLocal,
  diaDaSemana,
  horaLocal,
  instanteLocal,
  minutosDoDia,
} from '../agenda/index.js';
import type { ConfigAgencia } from '../base/config.js';

/** Horário permitido para mensagens ao cliente (RN-59), no fuso da agência. */
export interface JanelaEnvio {
  /** "HH:mm", inclusivo. */
  readonly inicio: string;
  /** "HH:mm", inclusivo: é o último horário permitido do dia. */
  readonly fim: string;
  /** Dias da semana permitidos, 0 = domingo. */
  readonly dias: readonly number[];
  readonly fuso: string;
}

/** Janela de envio a partir da configuração da agência e do fuso dela. */
export function janelaDaConfig(
  config: Pick<ConfigAgencia, 'janelaEnvioInicio' | 'janelaEnvioFim' | 'diasEnvioPermitidos'>,
  fuso: string,
): JanelaEnvio {
  return {
    inicio: config.janelaEnvioInicio,
    fim: config.janelaEnvioFim,
    dias: config.diasEnvioPermitidos,
    fuso,
  };
}

/** Uma semana inteira cobre qualquer combinação de dias permitidos. */
const DIAS_DE_BUSCA = 8;

export type ErroJanela = 'hora_invalida' | 'fim_antes_do_inicio' | 'sem_dias' | 'dia_invalido';

/** Confere a janela antes de salvar na configuração (RN-59). */
export function validarJanelaEnvio(janela: Omit<JanelaEnvio, 'fuso'>): ErroJanela | null {
  const inicio = minutosDoDia(janela.inicio);
  const fim = minutosDoDia(janela.fim);
  if (inicio === null || fim === null) return 'hora_invalida';
  if (fim <= inicio) return 'fim_antes_do_inicio';
  if (janela.dias.length === 0) return 'sem_dias';
  if (janela.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'dia_invalido';
  return null;
}

function diaPermitido(data: string, janela: JanelaEnvio): boolean {
  return janela.dias.includes(diaDaSemana(data));
}

/** RN-59: o relógio da agência está num dia permitido, entre o início e o fim. */
export function dentroDaJanela(instante: Date, janela: JanelaEnvio): boolean {
  const data = dataLocal(instante, janela.fuso);
  if (!diaPermitido(data, janela)) return false;
  const agora = minutosDoDia(horaLocal(instante, janela.fuso)) ?? -1;
  const inicio = minutosDoDia(janela.inicio) ?? Infinity;
  const fim = minutosDoDia(janela.fim) ?? -Infinity;
  return agora >= inicio && agora <= fim;
}

/**
 * RN-59: o próprio instante, se estiver na janela; senão, o próximo início de janela.
 * `null` só se a janela não tiver nenhum dia permitido.
 */
export function proximoHorarioPermitido(instante: Date, janela: JanelaEnvio): Date | null {
  if (dentroDaJanela(instante, janela)) return instante;
  const hoje = dataLocal(instante, janela.fuso);
  for (let i = 0; i < DIAS_DE_BUSCA; i += 1) {
    const data = adicionarDias(hoje, i);
    if (!diaPermitido(data, janela)) continue;
    const inicio = instanteLocal(data, janela.inicio, janela.fuso);
    if (inicio && inicio.getTime() > instante.getTime()) return inicio;
  }
  return null;
}

/**
 * O próprio instante, se estiver na janela; senão, o fim da última janela antes dele. Usado para
 * antecipar o lembrete de compromisso que cairia fora do horário permitido (decisão do PO).
 */
export function ultimoHorarioPermitidoAte(instante: Date, janela: JanelaEnvio): Date | null {
  if (dentroDaJanela(instante, janela)) return instante;
  const hoje = dataLocal(instante, janela.fuso);
  for (let i = 0; i < DIAS_DE_BUSCA; i += 1) {
    const data = adicionarDias(hoje, -i);
    if (!diaPermitido(data, janela)) continue;
    const fim = instanteLocal(data, janela.fim, janela.fuso);
    if (fim && fim.getTime() < instante.getTime()) return fim;
  }
  return null;
}

/** Data "dd/mm/aaaa" no fuso da agência, para o texto das mensagens. */
export function dataNaMensagem(instante: Date, fuso: string): string {
  const [ano, mes, dia] = dataLocal(instante, fuso).split('-');
  return `${String(dia)}/${String(mes)}/${String(ano)}`;
}

/** Hora "HH:mm" no fuso da agência, para o texto das mensagens. */
export function horaNaMensagem(instante: Date, fuso: string): string {
  return horaLocal(instante, fuso);
}
