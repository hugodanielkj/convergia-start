import type { Campo, Respostas, ValorResposta } from './tipos';

/** Resposta que conta como preenchida: texto com conteúdo, número ou lista com algum item. */
export function respondida(valor: ValorResposta | undefined): boolean {
  if (typeof valor === 'number') return true;
  if (typeof valor === 'string') return valor.trim() !== '';
  return Array.isArray(valor) && valor.length > 0;
}

/** Onde o formulário guiado abre: a primeira pergunta sem resposta, ou a última se não houver. */
export function indiceInicial(campos: readonly Campo[], respostas: Respostas): number {
  const indice = campos.findIndex((c) => !respondida(respostas[c.chave]));
  return indice === -1 ? Math.max(campos.length - 1, 0) : indice;
}

/** A primeira pergunta, na ordem do formulário, que a API recusou no envio. */
export function primeiroComErro(
  campos: readonly Campo[],
  erros: Readonly<Record<string, string>>,
): number | null {
  const indice = campos.findIndex((c) => c.chave in erros);
  return indice === -1 ? null : indice;
}
