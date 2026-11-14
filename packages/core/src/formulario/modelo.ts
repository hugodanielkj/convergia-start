/** Tipos de campo do formulário (RN-16). */
export const TIPOS_CAMPO = [
  'texto_curto',
  'texto_longo',
  'numero',
  'selecao_unica',
  'multipla_escolha',
  'data',
  'upload',
  'url',
] as const;

export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export interface CampoFormulario {
  /** Identificador estável: respostas guardam a chave, então ela nunca muda depois de criada. */
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo: TipoCampo;
  readonly obrigatorio: boolean;
  /** Campo "apagado": some do formulário novo, mas as respostas antigas continuam legíveis. */
  readonly arquivado: boolean;
  readonly ajuda?: string | undefined;
  /** Só para seleção única e múltipla escolha. */
  readonly opcoes?: readonly string[] | undefined;
}

export type CodigoErroModelo =
  | 'tipo_invalido'
  | 'rotulo_obrigatorio'
  | 'chave_duplicada'
  | 'opcoes_insuficientes'
  | 'opcoes_nao_aplicavel'
  | 'obrigatorio_arquivado'
  | 'sem_campos_ativos'
  | 'tipo_alterado'
  | 'campo_removido'
  /** Personalização por cliente remove a pergunta em vez de arquivar (ninguém respondeu ainda). */
  | 'arquivado_na_personalizacao';

export interface ErroModelo {
  /** `null` quando o erro é do modelo como um todo. */
  readonly chave: string | null;
  readonly codigo: CodigoErroModelo;
}

const COM_OPCOES: readonly TipoCampo[] = ['selecao_unica', 'multipla_escolha'];

const normalizar = (texto: string): string => texto.trim().toLocaleLowerCase('pt-BR');

function errosDoCampo(campo: CampoFormulario): ErroModelo[] {
  const erros: ErroModelo[] = [];
  const erro = (codigo: CodigoErroModelo): number => erros.push({ chave: campo.chave, codigo });

  if (!TIPOS_CAMPO.includes(campo.tipo)) erro('tipo_invalido');
  if (campo.rotulo.trim() === '') erro('rotulo_obrigatorio');
  if (campo.obrigatorio && campo.arquivado) erro('obrigatorio_arquivado');

  const opcoes = campo.opcoes ?? [];
  if (COM_OPCOES.includes(campo.tipo)) {
    const distintas = new Set(opcoes.map(normalizar).filter((o) => o !== ''));
    if (distintas.size < 2) erro('opcoes_insuficientes');
  } else if (opcoes.length > 0) {
    erro('opcoes_nao_aplicavel');
  }
  return erros;
}

/** Valida a definição de um modelo de formulário (RN-15, RN-16). Lista vazia = válido. */
export function validarCampos(campos: readonly CampoFormulario[]): ErroModelo[] {
  const erros = campos.flatMap(errosDoCampo);
  const vistas = new Set<string>();
  for (const { chave } of campos) {
    if (vistas.has(chave)) erros.push({ chave, codigo: 'chave_duplicada' });
    vistas.add(chave);
  }
  if (!campos.some((c) => !c.arquivado)) erros.push({ chave: null, codigo: 'sem_campos_ativos' });
  return erros;
}

/**
 * Confere uma nova versão contra a anterior (RN-15): respostas já enviadas apontam para
 * chaves e tipos antigos, então campo publicado não some e não troca de tipo; só se arquiva.
 */
export function validarEvolucao(
  anterior: readonly CampoFormulario[],
  novo: readonly CampoFormulario[],
): ErroModelo[] {
  const porChave = new Map(novo.map((c) => [c.chave, c]));
  return anterior.flatMap((antigo): ErroModelo[] => {
    const atual = porChave.get(antigo.chave);
    if (!atual) return [{ chave: antigo.chave, codigo: 'campo_removido' }];
    return atual.tipo === antigo.tipo ? [] : [{ chave: antigo.chave, codigo: 'tipo_alterado' }];
  });
}

/** Chave a partir do rótulo ("Público-alvo" → "publico_alvo"), sem repetir as existentes. */
export function gerarChave(rotulo: string, existentes: readonly string[]): string {
  const base =
    rotulo
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'campo';
  let chave = base;
  for (let n = 2; existentes.includes(chave); n += 1) chave = `${base}_${String(n)}`;
  return chave;
}
