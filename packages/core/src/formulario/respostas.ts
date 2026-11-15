import type { CampoFormulario } from './modelo.js';

export type ValorResposta = string | number | readonly string[];
/** Respostas do cliente, por chave de campo (RN-15: a chave nunca muda). */
export type Respostas = Readonly<Record<string, ValorResposta>>;

/** Tamanhos máximos dos textos, só para barrar abuso (não são regra de negócio da spec). */
export const LIMITES_RESPOSTA = { textoCurto: 300, textoLongo: 5000, url: 2000 } as const;

export type CodigoErroResposta =
  | 'obrigatorio'
  | 'tipo_invalido'
  | 'opcao_invalida'
  | 'numero_invalido'
  | 'data_invalida'
  | 'url_invalida'
  | 'texto_longo_demais'
  | 'campo_desconhecido';

export interface ErroResposta {
  readonly chave: string;
  readonly codigo: CodigoErroResposta;
}

const vazio = (valor: ValorResposta | undefined): boolean =>
  valor === undefined ||
  (typeof valor === 'string' && valor.trim() === '') ||
  (Array.isArray(valor) && valor.length === 0);

function dataValida(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

function urlValida(texto: string): boolean {
  try {
    const { protocol } = new URL(texto);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function texto(valor: ValorResposta, limite: number): CodigoErroResposta | null {
  if (typeof valor !== 'string') return 'tipo_invalido';
  return valor.length > limite ? 'texto_longo_demais' : null;
}

/** Erro do valor de um campo preenchido, ou `null` se estiver bom (RN-16). */
function erroDoValor(campo: CampoFormulario, valor: ValorResposta): CodigoErroResposta | null {
  switch (campo.tipo) {
    case 'texto_curto':
      return texto(valor, LIMITES_RESPOSTA.textoCurto);
    case 'texto_longo':
      return texto(valor, LIMITES_RESPOSTA.textoLongo);
    case 'numero':
      return typeof valor === 'number' && Number.isFinite(valor) ? null : 'numero_invalido';
    case 'data':
      return typeof valor === 'string' && dataValida(valor) ? null : 'data_invalida';
    case 'url':
      return typeof valor === 'string' && valor.length <= LIMITES_RESPOSTA.url && urlValida(valor)
        ? null
        : 'url_invalida';
    case 'selecao_unica':
      if (typeof valor !== 'string') return 'tipo_invalido';
      return campo.opcoes?.includes(valor) ? null : 'opcao_invalida';
    case 'multipla_escolha': {
      if (!Array.isArray(valor)) return 'tipo_invalido';
      const escolhidas: readonly string[] = valor;
      const validas = escolhidas.every((v) => campo.opcoes?.includes(v));
      return validas && new Set(escolhidas).size === escolhidas.length ? null : 'opcao_invalida';
    }
  }
}

/**
 * Valida as respostas contra os campos de uma versão do formulário (RN-16, RN-17).
 * No rascunho (`completo: false`) só confere o que foi preenchido; no envio (`completo: true`)
 * também exige todos os campos obrigatórios ativos. Campo arquivado nunca é exigido.
 */
export function validarRespostas(
  campos: readonly CampoFormulario[],
  respostas: Respostas,
  { completo }: { completo: boolean },
): ErroResposta[] {
  const porChave = new Map(campos.map((c) => [c.chave, c]));
  const erros: ErroResposta[] = [];

  for (const [chave, valor] of Object.entries(respostas)) {
    const campo = porChave.get(chave);
    if (!campo) erros.push({ chave, codigo: 'campo_desconhecido' });
    else if (!vazio(valor)) {
      const codigo = erroDoValor(campo, valor);
      if (codigo) erros.push({ chave, codigo });
    }
  }
  if (completo) {
    for (const campo of campos) {
      if (campo.obrigatorio && !campo.arquivado && vazio(respostas[campo.chave])) {
        erros.push({ chave: campo.chave, codigo: 'obrigatorio' });
      }
    }
  }
  return erros;
}

/** A etapa só está concluída com todos os obrigatórios preenchidos e válidos (RN-17). */
export function etapaConcluida(campos: readonly CampoFormulario[], respostas: Respostas): boolean {
  return validarRespostas(campos, respostas, { completo: true }).length === 0;
}
