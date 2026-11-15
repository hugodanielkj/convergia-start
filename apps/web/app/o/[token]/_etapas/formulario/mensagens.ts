import type { ErroResposta } from './tipos';

const MENSAGENS: Record<string, string> = {
  obrigatorio: 'Preencha este campo.',
  tipo_invalido: 'Valor inválido.',
  opcao_invalida: 'Escolha uma das opções.',
  numero_invalido: 'Informe um número.',
  data_invalida: 'Informe uma data válida.',
  url_invalida: 'Informe um link começando com http:// ou https://.',
  texto_longo_demais: 'Texto grande demais.',
};

/** Mensagem amigável por campo, a partir dos erros devolvidos pela API (RN-17). */
export function mensagensPorCampo(erros: readonly ErroResposta[]): Record<string, string> {
  return Object.fromEntries(
    erros.map((e) => [e.chave, MENSAGENS[e.codigo] ?? 'Confira este campo.']),
  );
}
