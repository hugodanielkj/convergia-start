import { describe, expect, it } from 'vitest';
import type { Bloqueio } from '../agenda/index.js';
import { diasUteisAte, indicadorPrazo, validarAjustePrazo } from './index.js';

const sem: Bloqueio[] = [];

describe('RN-48 indicador do prazo', () => {
  it('no prazo quando faltam mais de 2 dias úteis', () => {
    // Segunda 23/11 → quinta 26/11: ter, qua, qui = 3 dias úteis.
    expect(
      indicadorPrazo({ prazo: '2026-11-26', hoje: '2026-11-23', bloqueios: sem, entregue: false }),
    ).toBe('no_prazo');
  });

  it('atenção quando faltam 2 dias úteis ou menos, inclusive no próprio dia', () => {
    expect(
      indicadorPrazo({ prazo: '2026-11-26', hoje: '2026-11-24', bloqueios: sem, entregue: false }),
    ).toBe('atencao');
    expect(
      indicadorPrazo({ prazo: '2026-11-26', hoje: '2026-11-26', bloqueios: sem, entregue: false }),
    ).toBe('atencao');
  });

  it('o fim de semana e o feriado não contam como dias restantes', () => {
    // Quinta 19/11 → terça 24/11: (sex 20 feriado, sáb, dom) seg 23, ter 24 = 2.
    expect(
      indicadorPrazo({ prazo: '2026-11-24', hoje: '2026-11-19', bloqueios: sem, entregue: false }),
    ).toBe('atencao');
  });

  it('atrasado depois do dia do prazo', () => {
    expect(
      indicadorPrazo({ prazo: '2026-11-26', hoje: '2026-11-27', bloqueios: sem, entregue: false }),
    ).toBe('atrasado');
  });

  it('sem indicador depois da entrega dos primeiros conteúdos', () => {
    expect(
      indicadorPrazo({ prazo: '2026-11-26', hoje: '2026-11-30', bloqueios: sem, entregue: true }),
    ).toBeNull();
  });

  it('conta os dias úteis entre hoje (exclusive) e o prazo (inclusive)', () => {
    const recesso: Bloqueio[] = [{ dataInicio: '2026-11-25', dataFim: '2026-11-25', motivo: 'x' }];
    expect(diasUteisAte('2026-11-23', '2026-11-26', recesso)).toBe(2);
    expect(diasUteisAte('2026-11-26', '2026-11-26', sem)).toBe(0);
    expect(diasUteisAte('2026-11-27', '2026-11-26', sem)).toBe(0);
  });
});

describe('RN-47 ajuste manual do prazo', () => {
  it('exige justificativa', () => {
    expect(
      validarAjustePrazo({ data: '2026-12-01', justificativa: '  ', hoje: '2026-11-23' }),
    ).toEqual({
      ok: false,
      erro: 'justificativa_obrigatoria',
    });
  });

  it('recusa data inválida ou no passado', () => {
    expect(
      validarAjustePrazo({ data: '2026-02-30', justificativa: 'x', hoje: '2026-11-23' }),
    ).toEqual({
      ok: false,
      erro: 'data_invalida',
    });
    expect(
      validarAjustePrazo({ data: '2026-11-20', justificativa: 'x', hoje: '2026-11-23' }),
    ).toEqual({
      ok: false,
      erro: 'data_no_passado',
    });
  });

  it('recusa justificativa longa demais', () => {
    expect(
      validarAjustePrazo({
        data: '2026-12-01',
        justificativa: 'a'.repeat(501),
        hoje: '2026-11-23',
      }),
    ).toEqual({ ok: false, erro: 'justificativa_invalida' });
  });

  it('aceita hoje ou depois e limpa a justificativa', () => {
    expect(
      validarAjustePrazo({
        data: '2026-11-23',
        justificativa: ' Cliente pediu mais fotos ',
        hoje: '2026-11-23',
      }),
    ).toEqual({ ok: true, data: '2026-11-23', justificativa: 'Cliente pediu mais fotos' });
  });
});
