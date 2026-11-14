import { dataLocal } from '../agenda/fuso-agenda.js';
import { adicionarDias } from '../agenda/datas.js';

/**
 * RN-39: a captação fica pelo menos `intervaloDiasMin` dias (de calendário, no fuso da agência)
 * depois do dia da reunião, e nunca antes dela.
 */
export function captacaoRespeitaIntervalo(
  reuniaoInicio: Date,
  captacaoInicio: Date,
  intervaloDiasMin: number,
  fusoAgencia: string,
): boolean {
  if (captacaoInicio.getTime() < reuniaoInicio.getTime()) return false;
  const diaMinimo = adicionarDias(dataLocal(reuniaoInicio, fusoAgencia), intervaloDiasMin);
  return dataLocal(captacaoInicio, fusoAgencia) >= diaMinimo;
}

export interface EntradaDadosCaptacao {
  readonly presencial: boolean;
  readonly local?: string | null | undefined;
  readonly contatoLocal?: string | null | undefined;
  readonly observacoes?: string | null | undefined;
}

export interface DadosCaptacao {
  readonly presencial: boolean;
  readonly local: string | null;
  readonly contatoLocal: string | null;
  readonly observacoes: string | null;
}

export type ResultadoDadosCaptacao =
  | { readonly ok: true; readonly dados: DadosCaptacao }
  | { readonly ok: false; readonly erro: 'local_obrigatorio' };

const limpar = (texto: string | null | undefined): string | null => {
  const t = texto?.trim();
  return t ? t : null;
};

/** RN-40: local, contato e observações; o local é obrigatório quando a captação é presencial. */
export function validarDadosCaptacao(entrada: EntradaDadosCaptacao): ResultadoDadosCaptacao {
  const local = limpar(entrada.local);
  if (entrada.presencial && local === null) return { ok: false, erro: 'local_obrigatorio' };
  return {
    ok: true,
    dados: {
      presencial: entrada.presencial,
      local,
      contatoLocal: limpar(entrada.contatoLocal),
      observacoes: limpar(entrada.observacoes),
    },
  };
}
