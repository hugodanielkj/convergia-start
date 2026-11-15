import { describe, expect, it } from 'vitest';
import {
  TIPOS_CAMPO,
  gerarChave,
  modeloPadrao,
  validarCampos,
  validarEvolucao,
  type CampoFormulario,
} from './index.js';

const texto = (chave: string, extra: Partial<CampoFormulario> = {}): CampoFormulario => ({
  chave,
  rotulo: `Campo ${chave}`,
  tipo: 'texto_curto',
  obrigatorio: false,
  arquivado: false,
  ...extra,
});

describe('RN-16 tipos de campo suportados', () => {
  it('suporta exatamente os 7 tipos (envio de arquivo removido, decisão 2026-11-14-a-sem-envio-de-arquivos)', () => {
    expect([...TIPOS_CAMPO].sort()).toEqual(
      [
        'data',
        'multipla_escolha',
        'numero',
        'selecao_unica',
        'texto_curto',
        'texto_longo',
        'url',
      ].sort(),
    );
  });

  it('recusa tipo desconhecido', () => {
    const campo = { ...texto('a'), tipo: 'cor' } as unknown as CampoFormulario;
    expect(validarCampos([campo])).toContainEqual({ chave: 'a', codigo: 'tipo_invalido' });
  });

  it('seleção única e múltipla escolha exigem ao menos 2 opções distintas', () => {
    const sem = texto('a', { tipo: 'selecao_unica', opcoes: ['Só uma'] });
    const repetida = texto('b', { tipo: 'multipla_escolha', opcoes: ['X', 'x'] });
    const ok = texto('c', { tipo: 'selecao_unica', opcoes: ['Sim', 'Não'] });
    const erros = validarCampos([sem, repetida, ok]);
    expect(erros).toContainEqual({ chave: 'a', codigo: 'opcoes_insuficientes' });
    expect(erros).toContainEqual({ chave: 'b', codigo: 'opcoes_insuficientes' });
    expect(erros.filter((e) => e.chave === 'c')).toEqual([]);
  });

  it('opções só fazem sentido em campos de seleção', () => {
    const campo = texto('a', { opcoes: ['A', 'B'] });
    expect(validarCampos([campo])).toContainEqual({ chave: 'a', codigo: 'opcoes_nao_aplicavel' });
  });
});

describe('RN-15 validação da definição do modelo', () => {
  it('aceita um modelo válido', () => {
    expect(validarCampos([texto('a'), texto('b', { obrigatorio: true })])).toEqual([]);
  });

  it('exige rótulo e chave únicos', () => {
    const erros = validarCampos([texto('a', { rotulo: '  ' }), texto('b'), texto('b')]);
    expect(erros).toContainEqual({ chave: 'a', codigo: 'rotulo_obrigatorio' });
    expect(erros).toContainEqual({ chave: 'b', codigo: 'chave_duplicada' });
  });

  it('exige ao menos um campo ativo', () => {
    expect(validarCampos([texto('a', { arquivado: true })])).toContainEqual({
      chave: null,
      codigo: 'sem_campos_ativos',
    });
  });

  it('campo obrigatório não pode ficar arquivado', () => {
    expect(
      validarCampos([texto('a', { obrigatorio: true, arquivado: true }), texto('b')]),
    ).toContainEqual({
      chave: 'a',
      codigo: 'obrigatorio_arquivado',
    });
  });
});

describe('RN-15 nova versão preserva o que já foi respondido', () => {
  const anterior = [texto('a'), texto('b', { tipo: 'numero' })];

  it('aceita editar rótulo, obrigatoriedade, arquivar e incluir campos', () => {
    const novo = [
      texto('a', { rotulo: 'Outro nome', obrigatorio: true }),
      texto('b', { tipo: 'numero', arquivado: true }),
      texto('c'),
    ];
    expect(validarEvolucao(anterior, novo)).toEqual([]);
  });

  it('não permite trocar o tipo de um campo já publicado', () => {
    const novo = [texto('a', { tipo: 'texto_longo' }), texto('b', { tipo: 'numero' })];
    expect(validarEvolucao(anterior, novo)).toEqual([{ chave: 'a', codigo: 'tipo_alterado' }]);
  });

  it('não permite apagar um campo já publicado (só arquivar)', () => {
    expect(validarEvolucao(anterior, [texto('a')])).toEqual([
      { chave: 'b', codigo: 'campo_removido' },
    ]);
  });
});

describe('RN-19 modelo padrão', () => {
  const campos = modeloPadrao();

  it('é um modelo válido', () => {
    expect(validarCampos(campos)).toEqual([]);
  });

  it('cobre todos os itens sugeridos pela spec', () => {
    const chaves = campos.map((c) => c.chave);
    expect(chaves).toEqual(
      expect.arrayContaining([
        'nome_empresa',
        'segmento',
        'publico_alvo',
        'concorrentes',
        'tom_de_voz',
        'redes_sociais',
        'objetivos',
        'restricoes',
        'datas_e_produtos',
        'contato_aprovacao',
      ]),
    );
  });

  it('só empresa, segmento e contato para aprovação são obrigatórios; nenhum pede arquivo', () => {
    expect(campos.filter((c) => c.obrigatorio).map((c) => c.chave)).toEqual([
      'nome_empresa',
      'segmento',
      'contato_aprovacao',
    ]);
    expect(campos.map((c) => c.tipo)).not.toContain('upload');
  });
});

describe('RN-15 chave estável do campo', () => {
  it('gera a chave a partir do rótulo, sem acento, e evita repetição', () => {
    expect(gerarChave('Público-alvo', [])).toBe('publico_alvo');
    expect(gerarChave('Público-alvo', ['publico_alvo'])).toBe('publico_alvo_2');
    expect(gerarChave('???', [])).toBe('campo');
  });
});
