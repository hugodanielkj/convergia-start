import { describe, expect, it } from 'vitest';
import { TERMO_ATUAL, aceiteValido } from './index.js';

describe('RN-72 termo de consentimento versionado', () => {
  it('o termo atual tem versão e texto sobre uso dos dados e contato', () => {
    expect(TERMO_ATUAL.versao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TERMO_ATUAL.texto).toMatch(/dados/i);
    expect(TERMO_ATUAL.texto).toMatch(/contato/i);
  });

  it('só vale o aceite da versão vigente do termo', () => {
    expect(aceiteValido(TERMO_ATUAL.versao)).toBe(true);
    expect(aceiteValido('1999-01-01')).toBe(false);
    expect(aceiteValido('')).toBe(false);
  });
});
