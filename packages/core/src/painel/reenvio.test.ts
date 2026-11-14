import { describe, expect, it } from 'vitest';
import { podeReenviarLembrete } from './index.js';

describe('RN-66 intervalo mínimo entre reenvios de lembrete', () => {
  const ultimo = new Date('2026-11-16T12:00:00Z');
  const horas = (h: number) => new Date(ultimo.getTime() + h * 3_600_000);

  it('sem envio anterior, pode reenviar', () => {
    expect(podeReenviarLembrete(null, ultimo, 24)).toEqual({ pode: true, liberaEm: null });
  });

  it('antes do intervalo, não pode e diz quando libera', () => {
    expect(podeReenviarLembrete(ultimo, horas(23.9), 24)).toEqual({
      pode: false,
      liberaEm: horas(24),
    });
  });

  it('a partir do intervalo, pode', () => {
    expect(podeReenviarLembrete(ultimo, horas(24), 24)).toEqual({ pode: true, liberaEm: null });
  });
});
