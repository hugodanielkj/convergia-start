import { describe, expect, it } from 'vitest';
import { diaBloqueado, diaUtil, validarBloqueio, type Bloqueio } from './dias.js';

const recesso: Bloqueio = { dataInicio: '2026-12-28', dataFim: '2027-01-02', motivo: 'Recesso' };
const folga: Bloqueio = { dataInicio: '2026-11-10', dataFim: '2026-11-10', motivo: 'Folga' };

describe('RN-44 bloqueios', () => {
  it('um bloqueio cobre o período inteiro, incluindo o primeiro e o último dia', () => {
    expect(diaBloqueado('2026-12-27', [recesso])).toBe(false);
    expect(diaBloqueado('2026-12-28', [recesso])).toBe(true);
    expect(diaBloqueado('2026-12-31', [recesso])).toBe(true);
    expect(diaBloqueado('2027-01-02', [recesso])).toBe(true);
    expect(diaBloqueado('2027-01-03', [recesso])).toBe(false);
  });

  it('bloqueio de um dia só', () => {
    expect(diaBloqueado('2026-11-10', [folga])).toBe(true);
    expect(diaBloqueado('2026-11-11', [folga])).toBe(false);
  });

  it('sem bloqueios nenhum dia fica bloqueado', () => {
    expect(diaBloqueado('2026-11-10', [])).toBe(false);
  });

  it('valida um bloqueio correto, com motivo sem espaços sobrando', () => {
    expect(validarBloqueio(folga)).toEqual({ ok: true, bloqueio: folga });
    expect(validarBloqueio({ ...folga, motivo: '  Folga  ' })).toEqual({
      ok: true,
      bloqueio: folga,
    });
  });

  it.each([
    [{ ...folga, dataInicio: '2026-02-30' }, 'data_invalida'],
    [{ ...folga, dataFim: 'amanhã' }, 'data_invalida'],
    [{ ...folga, dataInicio: '2026-11-11', dataFim: '2026-11-10' }, 'intervalo_invalido'],
    [{ ...folga, motivo: '   ' }, 'motivo_obrigatorio'],
    [{ ...folga, motivo: 'x'.repeat(201) }, 'motivo_invalido'],
  ] as const)('rejeita %j', (bloqueio, erro) => {
    expect(validarBloqueio(bloqueio)).toEqual({ ok: false, erro });
  });
});

describe('RN-44 dia útil', () => {
  it('segunda a sexta comuns são dias úteis', () => {
    expect(diaUtil('2026-11-16', [])).toBe(true);
    expect(diaUtil('2026-11-20', [])).toBe(false); // Consciência Negra, sexta
    expect(diaUtil('2026-11-19', [])).toBe(true);
  });

  it('sábado e domingo não são dias úteis', () => {
    expect(diaUtil('2026-11-14', [])).toBe(false);
    expect(diaUtil('2026-11-15', [])).toBe(false);
  });

  it('feriado nacional em dia de semana não é dia útil', () => {
    expect(diaUtil('2026-09-07', [])).toBe(false);
    expect(diaUtil('2026-04-03', [])).toBe(false);
    expect(diaUtil('2026-12-25', [])).toBe(false);
  });

  it('bloqueio cadastrado tira o dia útil, e o vizinho continua útil', () => {
    expect(diaUtil('2026-11-10', [folga])).toBe(false);
    expect(diaUtil('2026-11-11', [folga])).toBe(true);
  });
});
