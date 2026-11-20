import type { ConfigAgencia } from '../base/config.js';

/**
 * Configurações gerais da agência (S8-2, RN-03, D-09). Limites aprovados pelo PO em 2026-11-19
 * (`sprints/sprint-08.md`); valem na API e nos campos da tela.
 */
export const LIMITES_CONFIG_GERAL = {
  prazoProducaoDiasUteis: { min: 1, max: 30 }, // RN-43
  validadeLinkDias: { min: 1, max: 90 }, // RN-11
  antecedenciaMinimaHoras: { min: 0, max: 168 }, // RN-31
  intervaloReuniaoCaptacaoDiasMin: { min: 0, max: 30 }, // RN-39
  limiteReagendamentos: { min: 0, max: 10 }, // RN-35
  antecedenciaReagendamentoHoras: { min: 0, max: 168 }, // RN-35
  duracaoReuniaoMinutos: { min: 15, max: 240 }, // RN-30
  duracaoCaptacaoMinutos: { min: 30, max: 480 }, // RN-38
  diasSemAcaoParaAlerta: { min: 1, max: 30 }, // RN-58
  intervaloMinimoReenvioHoras: { min: 1, max: 168 }, // RN-66
  diasConclusaoAutomatica: { min: 1, max: 60 }, // RN-52
} as const satisfies Partial<Record<keyof ConfigAgencia, { min: number; max: number }>>;

export type CampoNumerico = keyof typeof LIMITES_CONFIG_GERAL;
export const CAMPOS_NUMERICOS = Object.keys(LIMITES_CONFIG_GERAL) as CampoNumerico[];

export const NOME_AGENCIA_MAX = 80;

export type ConfigGeral = Pick<ConfigAgencia, CampoNumerico | 'canalNotificacaoPadrao'> & {
  nomeAgencia: string;
};

/** Os campos da tela Geral, tirados da configuração completa da agência. */
export function extrairConfigGeral(
  nomeAgencia: string,
  c: Pick<ConfigAgencia, keyof Omit<ConfigGeral, 'nomeAgencia'>>,
): ConfigGeral {
  return {
    nomeAgencia,
    prazoProducaoDiasUteis: c.prazoProducaoDiasUteis,
    validadeLinkDias: c.validadeLinkDias,
    antecedenciaMinimaHoras: c.antecedenciaMinimaHoras,
    intervaloReuniaoCaptacaoDiasMin: c.intervaloReuniaoCaptacaoDiasMin,
    limiteReagendamentos: c.limiteReagendamentos,
    antecedenciaReagendamentoHoras: c.antecedenciaReagendamentoHoras,
    duracaoReuniaoMinutos: c.duracaoReuniaoMinutos,
    duracaoCaptacaoMinutos: c.duracaoCaptacaoMinutos,
    diasSemAcaoParaAlerta: c.diasSemAcaoParaAlerta,
    intervaloMinimoReenvioHoras: c.intervaloMinimoReenvioHoras,
    diasConclusaoAutomatica: c.diasConclusaoAutomatica,
    canalNotificacaoPadrao: c.canalNotificacaoPadrao,
  };
}

export type ErroConfigGeral = { campo: keyof ConfigGeral; motivo: 'fora_do_limite' | 'invalido' };

/** Confere nome e números contra os limites (o canal já vem validado pelo tipo). Lista vazia = tudo certo. */
export function validarConfigGeral(config: ConfigGeral): ErroConfigGeral[] {
  const erros: ErroConfigGeral[] = [];
  const nome = config.nomeAgencia.trim();
  if (nome === '' || nome.length > NOME_AGENCIA_MAX) {
    erros.push({ campo: 'nomeAgencia', motivo: 'invalido' });
  }
  for (const campo of CAMPOS_NUMERICOS) {
    const valor = config[campo];
    const { min, max } = LIMITES_CONFIG_GERAL[campo];
    if (!Number.isInteger(valor)) erros.push({ campo, motivo: 'invalido' });
    else if (valor < min || valor > max) erros.push({ campo, motivo: 'fora_do_limite' });
  }
  return erros;
}

/** Campos que mudaram, com o valor antes e depois, para a auditoria (RN-77). */
export function diferencas(
  antes: ConfigGeral,
  depois: ConfigGeral,
): Partial<Record<keyof ConfigGeral, string>> {
  const mudou: Partial<Record<keyof ConfigGeral, string>> = {};
  for (const campo of Object.keys(depois) as (keyof ConfigGeral)[]) {
    if (antes[campo] !== depois[campo]) {
      mudou[campo] = `${String(antes[campo])} → ${String(depois[campo])}`;
    }
  }
  return mudou;
}
