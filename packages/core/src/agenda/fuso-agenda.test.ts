import { describe, expect, it } from 'vitest';
import { dataLocal, horaLocal, instanteLocal } from './fuso-agenda.js';

const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('RN-32 horário local da agência para instante UTC', () => {
  it('converte 09:00 de São Paulo (UTC-3, sem horário de verão)', () => {
    expect(iso(instanteLocal('2026-11-16', '09:00', 'America/Sao_Paulo'))).toBe(
      '2026-11-16T12:00:00.000Z',
    );
    expect(iso(instanteLocal('2026-01-10', '23:30', 'America/Sao_Paulo'))).toBe(
      '2026-01-11T02:30:00.000Z',
    );
  });

  it('funciona com UTC e com fuso de meia hora', () => {
    expect(iso(instanteLocal('2026-11-16', '09:00', 'UTC'))).toBe('2026-11-16T09:00:00.000Z');
    expect(iso(instanteLocal('2026-11-16', '09:00', 'Asia/Kolkata'))).toBe(
      '2026-11-16T03:30:00.000Z',
    );
  });

  it('respeita o horário de verão de quem tem', () => {
    expect(iso(instanteLocal('2026-01-15', '09:00', 'America/New_York'))).toBe(
      '2026-01-15T14:00:00.000Z',
    );
    expect(iso(instanteLocal('2026-07-01', '09:00', 'America/New_York'))).toBe(
      '2026-07-01T13:00:00.000Z',
    );
  });

  it('hora que não existe (a que pula na virada do horário de verão) devolve null', () => {
    expect(instanteLocal('2026-03-08', '02:30', 'America/New_York')).toBeNull();
    expect(iso(instanteLocal('2026-03-08', '03:30', 'America/New_York'))).toBe(
      '2026-03-08T07:30:00.000Z',
    );
  });

  it('hora que acontece duas vezes fica com a primeira', () => {
    expect(iso(instanteLocal('2026-11-01', '01:30', 'America/New_York'))).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('rejeita fuso inexistente', () => {
    expect(() => instanteLocal('2026-11-16', '09:00', 'Lua/Base_Alfa')).toThrow(/fuso/i);
  });
});

describe('RN-32 instante UTC para o horário do cliente', () => {
  const instante = new Date('2026-11-17T01:30:00.000Z');

  it('mostra a data e a hora locais', () => {
    expect(dataLocal(instante, 'America/Sao_Paulo')).toBe('2026-11-16');
    expect(horaLocal(instante, 'America/Sao_Paulo')).toBe('22:30');
    expect(dataLocal(instante, 'Europe/Lisbon')).toBe('2026-11-17');
    expect(horaLocal(instante, 'Europe/Lisbon')).toBe('01:30');
  });

  it('meia-noite local aparece como 00:00, não 24:00', () => {
    expect(horaLocal(new Date('2026-11-16T03:00:00.000Z'), 'America/Sao_Paulo')).toBe('00:00');
  });
});
