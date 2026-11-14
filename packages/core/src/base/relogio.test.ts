import { describe, expect, it } from 'vitest';
import { relogioFixo, relogioSistema } from './relogio.js';

describe('Relogio', () => {
  it('relógio fixo devolve sempre a mesma data, em cópias independentes', () => {
    const data = new Date('2026-11-13T12:00:00Z');
    const relogio = relogioFixo(data);
    const primeira = relogio.agora();
    primeira.setFullYear(2000);

    expect(relogio.agora()).toEqual(data);
  });

  it('relógio do sistema devolve a data atual', () => {
    const antes = Date.now();
    expect(relogioSistema.agora().getTime()).toBeGreaterThanOrEqual(antes);
  });
});
