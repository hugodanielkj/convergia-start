import { describe, expect, it } from 'vitest';
import { adicionarDias, diaDaSemana, dataValida } from './datas.js';

describe('datas do calendário (YYYY-MM-DD, sem fuso)', () => {
  it.each(['2026-11-14', '2024-02-29', '2000-01-01'])('aceita %s', (data) => {
    expect(dataValida(data)).toBe(true);
  });

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '26-11-14',
    '2026-1-1',
    '',
    'amanhã',
  ])('rejeita %j', (data) => {
    expect(dataValida(data)).toBe(false);
  });

  it('diz o dia da semana, com 0 = domingo', () => {
    expect(diaDaSemana('2026-11-15')).toBe(0);
    expect(diaDaSemana('2026-11-16')).toBe(1);
    expect(diaDaSemana('2026-11-21')).toBe(6);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(adicionarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(adicionarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(adicionarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(adicionarDias('2024-03-01', -1)).toBe('2024-02-29');
  });
});
