import type { Canal } from './mensageria.js';

export type Plataforma = 'instagram' | 'facebook' | 'tiktok' | 'google' | 'outro';

/**
 * Parâmetros que a agência configura (instrução 5 da spec: nada fixo no código).
 * Espelha a tabela `config_agencia`. Novos campos entram aqui e no schema base.
 */
export interface ConfigAgencia {
  prazoProducaoDiasUteis: number; // RN-43
  validadeLinkDias: number; // RN-11
  antecedenciaMinimaHoras: number; // RN-31
  intervaloReuniaoCaptacaoDiasMin: number; // RN-39
  limiteReagendamentos: number; // RN-35
  antecedenciaReagendamentoHoras: number; // RN-35
  duracaoReuniaoMinutos: number; // RN-30
  duracaoCaptacaoMinutos: number; // RN-38
  lembretesPendenciaDias: number[]; // RN-56
  maxLembretesPendencia: number; // RN-56
  lembretesCompromissoHoras: number[]; // RN-57
  janelaEnvioInicio: string; // RN-59, "HH:mm"
  janelaEnvioFim: string; // RN-59, "HH:mm"
  diasEnvioPermitidos: number[]; // RN-59, 0 = domingo
  canalNotificacaoPadrao: Canal; // RN-60
  intervaloMinimoReenvioHoras: number; // RN-66
  diasSemAcaoParaAlerta: number; // RN-58
  diasConclusaoAutomatica: number; // RN-52
  plataformasObrigatorias: Plataforma[]; // RN-27, D-06
  uploadTamanhoMaxMb: number; // RN-20
  uploadTiposPermitidos: string[]; // RN-20
  permitirCredenciais: boolean; // RN-23, D-05
}

/** Valores iniciais da configuração (D-09). Usados só no seed; depois a agência edita. */
const padrao: ConfigAgencia = {
  prazoProducaoDiasUteis: 5,
  validadeLinkDias: 14,
  antecedenciaMinimaHoras: 24,
  intervaloReuniaoCaptacaoDiasMin: 1,
  limiteReagendamentos: 2,
  antecedenciaReagendamentoHoras: 24,
  duracaoReuniaoMinutos: 60,
  duracaoCaptacaoMinutos: 120,
  lembretesPendenciaDias: [1, 3, 5],
  maxLembretesPendencia: 3,
  lembretesCompromissoHoras: [24, 2],
  janelaEnvioInicio: '08:00',
  janelaEnvioFim: '20:00',
  diasEnvioPermitidos: [1, 2, 3, 4, 5, 6],
  canalNotificacaoPadrao: 'whatsapp',
  intervaloMinimoReenvioHoras: 24,
  diasSemAcaoParaAlerta: 3,
  diasConclusaoAutomatica: 7,
  plataformasObrigatorias: ['instagram', 'facebook'],
  uploadTamanhoMaxMb: 20,
  uploadTiposPermitidos: ['image/png', 'image/jpeg', 'application/pdf'],
  permitirCredenciais: false,
};

export const CONFIG_PADRAO: Readonly<ConfigAgencia> = Object.freeze(padrao);
