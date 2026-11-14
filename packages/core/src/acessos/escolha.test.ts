import { describe, expect, it } from 'vitest';
import { escolhaTravada, validarEscolha } from './index.js';

describe('RN-27 plataformas escolhidas por cliente', () => {
  it('aceita qualquer combinação, inclusive sem Instagram e Facebook', () => {
    expect(validarEscolha(['tiktok'])).toEqual({ ok: true, plataformas: ['tiktok'] });
  });

  it('devolve na ordem padrão e sem repetição', () => {
    expect(validarEscolha(['google', 'instagram', 'google'])).toEqual({
      ok: true,
      plataformas: ['instagram', 'google'],
    });
  });

  it('exige pelo menos uma plataforma', () => {
    expect(validarEscolha([])).toEqual({ ok: false, erro: 'nenhuma_plataforma' });
  });

  it('recusa plataforma desconhecida', () => {
    expect(validarEscolha(['instagram', 'orkut'])).toEqual({
      ok: false,
      erro: 'plataforma_desconhecida',
    });
  });
});

describe('RN-27 trava da escolha quando a etapa começa', () => {
  const pendente = { status: 'pendente', informado: false } as const;

  it('não trava enquanto nada aconteceu', () => {
    expect(escolhaTravada([pendente, pendente])).toBe(false);
  });

  it('trava quando o cliente avisa que adicionou a agência', () => {
    expect(escolhaTravada([pendente, { status: 'pendente', informado: true }])).toBe(true);
  });

  it('trava quando a agência marca concedido ou inválido', () => {
    expect(escolhaTravada([{ status: 'concedido', informado: false }])).toBe(true);
    expect(escolhaTravada([{ status: 'invalido', informado: false }])).toBe(true);
  });
});
