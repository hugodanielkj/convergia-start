export interface ConfigUpload {
  readonly tamanhoMaxMb: number;
  readonly tiposPermitidos: readonly string[];
}

export interface ArquivoRecebido {
  readonly nome: string;
  /** Tipo informado pelo navegador; nunca é confiado, só conferido. */
  readonly tipoDeclarado?: string | undefined;
  readonly tamanho: number;
  /** Primeiros bytes do arquivo (basta uma dúzia) para reconhecer o tipo. */
  readonly inicio: Uint8Array;
}

export type ErroUpload =
  'vazio' | 'grande_demais' | 'tipo_nao_permitido' | 'conteudo_diferente_do_declarado';

export type ResultadoUpload =
  | { readonly ok: true; readonly tipo: string; readonly nome: string }
  | { readonly ok: false; readonly erro: ErroUpload };

const ASCII = (bytes: Uint8Array, de: number, ate: number): string =>
  String.fromCharCode(...bytes.slice(de, ate));

const comeca = (bytes: Uint8Array, assinatura: readonly number[]): boolean =>
  assinatura.every((b, i) => bytes[i] === b);

/** Reconhece o tipo pelos primeiros bytes. Só conhece formatos seguros e comuns; o resto é `null`. */
export function detectarTipo(inicio: Uint8Array): string | null {
  if (comeca(inicio, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (comeca(inicio, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ASCII(inicio, 0, 5) === '%PDF-') return 'application/pdf';
  if (ASCII(inicio, 0, 4) === 'GIF8') return 'image/gif';
  if (ASCII(inicio, 0, 4) === 'RIFF' && ASCII(inicio, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const EXTENSAO: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const TAMANHO_MAX_NOME = 120;

/** Nome só para exibição: sem pastas nem caracteres de controle. Nunca vira caminho em disco. */
export function nomeSeguro(nome: string): string {
  const semPasta = nome.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const limpo = semPasta.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return limpo === '' || limpo === '.' || limpo === '..'
    ? 'arquivo'
    : limpo.slice(-TAMANHO_MAX_NOME);
}

/**
 * Confere tamanho e tipo de um upload (RN-20). O tipo vale pelo conteúdo: um arquivo cujo
 * conteúdo não é de um tipo permitido é recusado, qualquer que seja o nome ou o tipo declarado.
 */
export function validarUpload(arquivo: ArquivoRecebido, config: ConfigUpload): ResultadoUpload {
  if (arquivo.tamanho <= 0) return { ok: false, erro: 'vazio' };
  if (arquivo.tamanho > config.tamanhoMaxMb * 1024 * 1024)
    return { ok: false, erro: 'grande_demais' };

  const tipo = detectarTipo(arquivo.inicio);
  if (tipo === null || !config.tiposPermitidos.includes(tipo)) {
    return { ok: false, erro: 'tipo_nao_permitido' };
  }
  if (arquivo.tipoDeclarado !== undefined && arquivo.tipoDeclarado !== tipo) {
    return { ok: false, erro: 'conteudo_diferente_do_declarado' };
  }
  return { ok: true, tipo, nome: nomeSeguro(arquivo.nome) };
}

/** Chave no storage: por agência e cliente (RN-69), com id próprio. O nome enviado não entra. */
export function chaveDoArquivo(dados: {
  agenciaId: string;
  clienteId: string;
  arquivoId: string;
  tipo: string;
}): string {
  const extensao = EXTENSAO[dados.tipo] ?? 'bin';
  return `${dados.agenciaId}/${dados.clienteId}/${dados.arquivoId}.${extensao}`;
}
