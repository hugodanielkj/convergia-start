import { describe, expect, it } from 'vitest';
import { FUSO_PADRAO, fusoValido } from './fuso.js';

describe('RN-32 fuso horário', () => {
  it('usa America/Sao_Paulo como fuso padrão válido', () => {
    expect(fusoValido(FUSO_PADRAO)).toBe(true);
  });

  it('aceita fusos IANA enviados pelo navegador', () => {
    expect(fusoValido('Europe/Lisbon')).toBe(true);
  });

  it('rejeita fuso inexistente', () => {
    expect(fusoValido('Lua/Base_Alfa')).toBe(false);
  });
});
