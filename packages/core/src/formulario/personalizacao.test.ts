import { describe, expect, it } from 'vitest';
import {
  camposDaPersonalizacao,
  personalizacaoTravada,
  temResposta,
  validarPersonalizacao,
  type CampoFormulario,
} from './index.js';

const campo = (chave: string, extra: Partial<CampoFormulario> = {}): CampoFormulario => ({
  chave,
  rotulo: chave,
  tipo: 'texto_curto',
  obrigatorio: false,
  arquivado: false,
  ...extra,
});

describe('RN-15 personalização das perguntas por cliente', () => {
  it('parte só dos campos ativos do modelo padrão', () => {
    const padrao = [campo('empresa'), campo('antigo', { arquivado: true }), campo('segmento')];
    expect(camposDaPersonalizacao(padrao).map((c) => c.chave)).toEqual(['empresa', 'segmento']);
  });

  it('deixa remover qualquer pergunta do padrão, pois ninguém respondeu ainda', () => {
    expect(validarPersonalizacao([campo('segmento')])).toEqual([]);
  });

  it('recusa personalização sem nenhuma pergunta', () => {
    expect(validarPersonalizacao([])).toEqual([{ chave: null, codigo: 'sem_campos_ativos' }]);
  });

  it('recusa campo arquivado: na personalização a pergunta é removida, não arquivada', () => {
    expect(validarPersonalizacao([campo('a'), campo('b', { arquivado: true })])).toEqual([
      { chave: 'b', codigo: 'arquivado_na_personalizacao' },
    ]);
  });

  it('aplica as mesmas validações de campo do modelo (RN-16)', () => {
    expect(validarPersonalizacao([campo('a', { tipo: 'selecao_unica', opcoes: ['x'] })])).toEqual([
      { chave: 'a', codigo: 'opcoes_insuficientes' },
    ]);
  });
});

describe('RN-15 trava da personalização quando o cliente começa a responder', () => {
  it('não trava enquanto não há rascunho', () => {
    expect(personalizacaoTravada(null)).toBe(false);
  });

  it('não trava com rascunho sem nenhuma resposta preenchida', () => {
    expect(
      personalizacaoTravada({ respostas: { empresa: '  ', redes: [] }, enviadaEm: null }),
    ).toBe(false);
  });

  it('trava no primeiro rascunho com alguma resposta', () => {
    expect(personalizacaoTravada({ respostas: { empresa: 'Padaria' }, enviadaEm: null })).toBe(
      true,
    );
  });

  it('trava depois de enviado', () => {
    expect(personalizacaoTravada({ respostas: {}, enviadaEm: new Date(0) })).toBe(true);
  });

  it('continua travada depois que a agência reabre o formulário (RN-54)', () => {
    expect(personalizacaoTravada({ respostas: {}, enviadaEm: null, reabertaEm: new Date(0) })).toBe(
      true,
    );
  });

  it('número zero conta como resposta', () => {
    expect(temResposta({ funcionarios: 0 })).toBe(true);
  });
});
