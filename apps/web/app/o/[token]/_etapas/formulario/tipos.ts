// Espelha o contrato público da API do formulário (RN-16). As regras vivem na API e no core.
export type TipoCampo =
  | 'texto_curto'
  | 'texto_longo'
  | 'numero'
  | 'selecao_unica'
  | 'multipla_escolha'
  | 'data'
  | 'upload'
  | 'url';

export interface Campo {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  ajuda?: string;
  opcoes?: string[];
}

export type ValorResposta = string | number | string[];
export type Respostas = Record<string, ValorResposta>;

export interface EstadoFormulario {
  versao: number;
  campos: Campo[];
  respostas: Respostas;
  situacao: 'rascunho' | 'enviado' | 'fechado';
  editavel: boolean;
}

export interface ErroResposta {
  chave: string;
  codigo: string;
}
