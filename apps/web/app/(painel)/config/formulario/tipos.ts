// Espelha o contrato da API do módulo formulario (RN-16). As regras vivem na API e no core.
export type TipoCampo =
  'texto_curto' | 'texto_longo' | 'numero' | 'selecao_unica' | 'multipla_escolha' | 'data' | 'url';

export interface Campo {
  chave?: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  arquivado: boolean;
  ajuda?: string;
  opcoes?: string[];
}

export interface EstadoModelo {
  versaoPublicada: { numero: number; publicadaEm: string; campos: Campo[] };
  rascunho: Campo[];
  temAlteracoes: boolean;
}

export const ROTULO_TIPO: Record<TipoCampo, string> = {
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  numero: 'Número',
  selecao_unica: 'Seleção única',
  multipla_escolha: 'Múltipla escolha',
  data: 'Data',
  url: 'Link (URL)',
};

export const COM_OPCOES: readonly TipoCampo[] = ['selecao_unica', 'multipla_escolha'];

export interface ErroModelo {
  chave: string | null;
  codigo: string;
}

export const MENSAGEM_ERRO: Record<string, string> = {
  tipo_invalido: 'tipo de campo inválido.',
  rotulo_obrigatorio: 'dê um nome ao campo.',
  chave_duplicada: 'campo repetido.',
  opcoes_insuficientes: 'informe pelo menos 2 opções diferentes.',
  opcoes_nao_aplicavel: 'este tipo de campo não usa opções.',
  obrigatorio_arquivado: 'um campo obrigatório não pode ficar arquivado.',
  sem_campos_ativos: 'o formulário precisa ter ao menos um campo ativo.',
  tipo_alterado: 'o tipo de um campo já publicado não pode mudar; crie um campo novo.',
  campo_removido: 'campos já publicados não podem ser apagados; use "Arquivar".',
};
