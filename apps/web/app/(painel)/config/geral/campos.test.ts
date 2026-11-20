import { describe, expect, it } from 'vitest';
import { SECOES, lerNumero, textoLimite } from './campos';

describe('RN-03 campos da tela Geral', () => {
  const limite = { min: 1, max: 30 };

  it('aceita inteiros dentro do limite, inclusive os extremos', () => {
    expect(lerNumero('1', limite)).toBe(1);
    expect(lerNumero(' 30 ', limite)).toBe(30);
  });

  it('recusa fora do limite, vazio, negativo e quebrado', () => {
    for (const texto of ['0', '31', '', '-1', '2,5', 'abc']) {
      expect(lerNumero(texto, limite)).toBeNull();
    }
  });

  it('explica o limite em português', () => {
    expect(textoLimite(limite, 'dias úteis')).toBe('Entre 1 e 30 dias úteis.');
  });

  it('cada campo aparece uma vez', () => {
    const campos = SECOES.flatMap((s) => s.campos.map((c) => c.campo));
    expect(new Set(campos).size).toBe(campos.length);
    expect(campos).toHaveLength(11);
  });
});
