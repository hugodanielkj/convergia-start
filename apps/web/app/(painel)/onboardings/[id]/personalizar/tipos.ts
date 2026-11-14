import type { Campo } from '../../../config/formulario/tipos';

// Espelha a API de personalização por cliente (S6-2, RN-15). As regras vivem na API e no core.
export interface EstadoPerguntas {
  personalizada: boolean;
  versao: number | null;
  versaoPadrao: number;
  campos: Campo[];
  travada: boolean;
}

/** Nome do campo escondido que leva as perguntas personalizadas no cadastro. */
export const CAMPO_PERGUNTAS = 'perguntasPersonalizadas';

export const MENSAGEM_TRAVADA =
  'O cliente já começou a responder. As perguntas ficam como estão (RN-15).';

export interface EstadoAcessos {
  plataformas: { plataforma: string; nome: string; escolhida: boolean }[];
  travada: boolean;
}

/** Campos do cadastro: as plataformas marcadas e o aviso de que a agência mexeu nelas. */
export const CAMPO_PLATAFORMAS = 'plataformasEscolhidas';
export const CAMPO_ACESSOS_MEXEU = 'acessosPersonalizados';

export const MENSAGEM_ACESSOS_TRAVADA =
  'A etapa de acessos já começou. As plataformas ficam como estão (RN-27).';
export const MENSAGEM_NENHUMA = 'Escolha pelo menos uma plataforma.';
