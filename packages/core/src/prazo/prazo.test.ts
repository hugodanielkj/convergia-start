import { describe, expect, it } from 'vitest';
import type { Bloqueio } from '../agenda/index.js';
import { calcularPrazoLiberacao, prazoMudou } from './index.js';

const sem: Bloqueio[] = [];

describe('RN-43 prazo = data da captação + N dias úteis', () => {
  it('conta os dias úteis a partir do dia seguinte à captação', () => {
    // Quarta 18/11/2026 + 5 dias úteis: qui 19, sex 20 é feriado (Consciência Negra), seg 23,
    // ter 24, qua 25, qui 26.
    expect(calcularPrazoLiberacao('2026-11-18', 5, sem)).toBe('2026-11-26');
  });

  it('captação na sexta pula o fim de semana', () => {
    expect(calcularPrazoLiberacao('2026-12-04', 1, sem)).toBe('2026-12-07');
    expect(calcularPrazoLiberacao('2026-12-04', 5, sem)).toBe('2026-12-11');
  });

  it('captação no sábado começa a contar na segunda', () => {
    expect(calcularPrazoLiberacao('2026-12-05', 1, sem)).toBe('2026-12-07');
  });

  it('com 0 dias úteis o prazo é o próprio dia da captação', () => {
    expect(calcularPrazoLiberacao('2026-12-04', 0, sem)).toBe('2026-12-04');
  });

  it('recusa quantidade negativa ou fracionada', () => {
    expect(() => calcularPrazoLiberacao('2026-12-04', -1, sem)).toThrow();
    expect(() => calcularPrazoLiberacao('2026-12-04', 1.5, sem)).toThrow();
  });
});

describe('RN-44 dias úteis sem fim de semana, feriado nacional e bloqueios', () => {
  it('pula o Natal e o Ano-Novo', () => {
    // Quarta 23/12: qui 24, (sex 25 Natal), seg 28, ter 29, qua 30, qui 31, (sex 1º jan), seg 4.
    expect(calcularPrazoLiberacao('2026-12-23', 6, sem)).toBe('2027-01-04');
  });

  it('pula os bloqueios cadastrados pela agência', () => {
    const recesso: Bloqueio[] = [
      { dataInicio: '2026-12-07', dataFim: '2026-12-09', motivo: 'Recesso' },
    ];
    // Sexta 04/12 + 2: (seg 7, ter 8, qua 9 bloqueados) qui 10, sex 11.
    expect(calcularPrazoLiberacao('2026-12-04', 2, recesso)).toBe('2026-12-11');
  });

  it('não entra em laço infinito com um bloqueio enorme', () => {
    const tudo: Bloqueio[] = [{ dataInicio: '2026-01-01', dataFim: '2040-12-31', motivo: 'x' }];
    expect(() => calcularPrazoLiberacao('2026-12-04', 1, tudo)).toThrow(/dia útil/);
  });
});

describe('RN-46 recálculo só avisa quando a data muda', () => {
  it('detecta mudança de data', () => {
    expect(prazoMudou(null, '2026-12-11')).toBe(true);
    expect(prazoMudou('2026-12-11', '2026-12-14')).toBe(true);
    expect(prazoMudou('2026-12-11', null)).toBe(true);
  });

  it('não muda quando a captação troca de horário no mesmo dia', () => {
    expect(prazoMudou('2026-12-11', '2026-12-11')).toBe(false);
    expect(prazoMudou(null, null)).toBe(false);
  });
});
