import { describe, expect, it } from 'vitest';
import { indiceInicial, primeiroComErro, respondida } from './guiado';
import type { Campo } from './tipos';

const campo = (chave: string, obrigatorio = false): Campo => ({
  chave,
  rotulo: chave,
  tipo: 'texto_curto',
  obrigatorio,
});
const CAMPOS = [campo('nome', true), campo('segmento', true), campo('publico'), campo('site')];

describe('formulário guiado, uma pergunta por vez (RN-17, RN-18)', () => {
  it('considera respondido texto com conteúdo, número e lista com item', () => {
    expect(respondida('Padaria')).toBe(true);
    expect(respondida(0)).toBe(true);
    expect(respondida(['Instagram'])).toBe(true);
    expect(respondida('   ')).toBe(false);
    expect(respondida([])).toBe(false);
    expect(respondida(undefined)).toBe(false);
  });

  it('volta para a primeira pergunta sem resposta do rascunho', () => {
    expect(indiceInicial(CAMPOS, {})).toBe(0);
    expect(indiceInicial(CAMPOS, { nome: 'Padaria', segmento: 'Alimentos' })).toBe(2);
  });

  it('com tudo respondido, abre a última pergunta (onde fica o envio)', () => {
    expect(
      indiceInicial(CAMPOS, { nome: 'a', segmento: 'b', publico: 'c', site: 'https://x.com' }),
    ).toBe(3);
  });

  it('leva à primeira pergunta com erro devolvido pela API', () => {
    expect(primeiroComErro(CAMPOS, { site: 'Informe um link', segmento: 'Preencha' })).toBe(1);
    expect(primeiroComErro(CAMPOS, {})).toBeNull();
  });
});
