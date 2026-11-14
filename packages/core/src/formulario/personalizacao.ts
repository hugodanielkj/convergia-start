import { validarCampos, type CampoFormulario, type ErroModelo } from './modelo.js';
import type { Respostas, ValorResposta } from './respostas.js';

const preenchido = (valor: ValorResposta): boolean =>
  typeof valor === 'number' ||
  (typeof valor === 'string' && valor.trim() !== '') ||
  (Array.isArray(valor) && valor.length > 0);

/** Há pelo menos uma resposta preenchida (texto em branco e lista vazia não contam). */
export const temResposta = (respostas: Respostas): boolean =>
  Object.values(respostas).some(preenchido);

/** RN-15: a personalização de um cliente parte dos campos ativos do modelo padrão vigente. */
export const camposDaPersonalizacao = (padrao: readonly CampoFormulario[]): CampoFormulario[] =>
  padrao.filter((c) => !c.arquivado);

/**
 * RN-15: valida as perguntas de um cliente. Como ninguém respondeu ainda, pode remover ou trocar o
 * tipo de qualquer pergunta; por isso não há arquivamento nem conferência contra a versão anterior.
 */
export function validarPersonalizacao(campos: readonly CampoFormulario[]): ErroModelo[] {
  const arquivados = campos
    .filter((c) => c.arquivado)
    .map((c): ErroModelo => ({ chave: c.chave, codigo: 'arquivado_na_personalizacao' }));
  return [...validarCampos(campos), ...arquivados];
}

export interface InicioDasRespostas {
  readonly respostas: Respostas;
  readonly enviadaEm: Date | null;
  readonly reabertaEm?: Date | null;
}

/**
 * RN-15 (revisada com o PO em 2026-11-14): a personalização trava quando o cliente começa a
 * responder, isto é, no primeiro rascunho com alguma resposta. Só abrir a página não conta.
 * Depois de enviado (ou reaberto pela agência), o cliente já começou, mesmo sem respostas.
 */
export function personalizacaoTravada(resposta: InicioDasRespostas | null): boolean {
  if (!resposta) return false;
  if (resposta.enviadaEm || resposta.reabertaEm) return true;
  return temResposta(resposta.respostas);
}
