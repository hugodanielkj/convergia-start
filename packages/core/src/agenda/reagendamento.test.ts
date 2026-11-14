import { describe, expect, it } from 'vitest';
import {
  avaliarReagendamento,
  mudancaDeStatusPermitida,
  reagendamentosRestantes,
  type EntradaReagendamento,
} from './reagendamento.js';

const AGORA = new Date('2026-11-16T12:00:00.000Z');
const HORA = 60 * 60 * 1000;

const base: EntradaReagendamento = {
  status: 'agendado',
  reagendamentosFeitos: 0,
  limiteReagendamentos: 2,
  inicio: new Date(AGORA.getTime() + 48 * HORA),
  agora: AGORA,
  antecedenciaReagendamentoHoras: 24,
};

describe('RN-35 quando o cliente pode reagendar', () => {
  it('pode, e diz quantos reagendamentos sobram depois deste', () => {
    expect(avaliarReagendamento(base)).toEqual({ ok: true, restantesDepois: 1 });
    expect(avaliarReagendamento({ ...base, reagendamentosFeitos: 1 })).toEqual({
      ok: true,
      restantesDepois: 0,
    });
  });

  it('o status reagendado também pode reagendar de novo, dentro do limite', () => {
    expect(
      avaliarReagendamento({ ...base, status: 'reagendado', reagendamentosFeitos: 1 }),
    ).toMatchObject({ ok: true });
  });

  it('recusa quando o limite acabou, mesmo faltando muito tempo', () => {
    expect(avaliarReagendamento({ ...base, reagendamentosFeitos: 2 })).toEqual({
      ok: false,
      motivo: 'limite_atingido',
    });
    expect(avaliarReagendamento({ ...base, reagendamentosFeitos: 5 })).toEqual({
      ok: false,
      motivo: 'limite_atingido',
    });
  });

  it('limite zero não deixa reagendar', () => {
    expect(avaliarReagendamento({ ...base, limiteReagendamentos: 0 })).toEqual({
      ok: false,
      motivo: 'limite_atingido',
    });
  });

  it('exige a antecedência mínima antes do horário atual, e o limite exato ainda vale', () => {
    const justo = new Date(AGORA.getTime() + 24 * HORA);
    expect(avaliarReagendamento({ ...base, inicio: justo })).toMatchObject({ ok: true });
    expect(avaliarReagendamento({ ...base, inicio: new Date(justo.getTime() - 1) })).toEqual({
      ok: false,
      motivo: 'prazo_encerrado',
    });
  });

  it('horário que já passou não pode ser reagendado', () => {
    expect(avaliarReagendamento({ ...base, inicio: new Date(AGORA.getTime() - HORA) })).toEqual({
      ok: false,
      motivo: 'prazo_encerrado',
    });
  });

  it.each(['cancelado', 'realizado', 'nao_compareceu'] as const)(
    'agendamento %s não pode ser reagendado',
    (status) => {
      expect(avaliarReagendamento({ ...base, status })).toEqual({
        ok: false,
        motivo: 'status_invalido',
      });
    },
  );

  it('o status é conferido antes do limite e do prazo', () => {
    expect(avaliarReagendamento({ ...base, status: 'cancelado', reagendamentosFeitos: 9 })).toEqual(
      { ok: false, motivo: 'status_invalido' },
    );
  });

  it('conta os reagendamentos que ainda restam sem passar de zero', () => {
    expect(reagendamentosRestantes(0, 2)).toBe(2);
    expect(reagendamentosRestantes(2, 2)).toBe(0);
    expect(reagendamentosRestantes(7, 2)).toBe(0);
  });
});

describe('RN-36 e RN-37 mudanças de status feitas pela agência', () => {
  it.each(['agendado', 'reagendado'] as const)(
    'de %s a agência pode concluir, marcar falta ou cancelar',
    (de) => {
      for (const para of ['realizado', 'nao_compareceu', 'cancelado'] as const) {
        expect(mudancaDeStatusPermitida(de, para)).toBe(true);
      }
    },
  );

  it.each(['cancelado', 'realizado', 'nao_compareceu'] as const)(
    '%s é final: não muda mais',
    (de) => {
      for (const para of [
        'agendado',
        'reagendado',
        'realizado',
        'nao_compareceu',
        'cancelado',
      ] as const) {
        expect(mudancaDeStatusPermitida(de, para)).toBe(false);
      }
    },
  );

  it('a agência não leva um agendamento ativo de volta a agendado nem a reagendado por aqui', () => {
    expect(mudancaDeStatusPermitida('agendado', 'reagendado')).toBe(false);
    expect(mudancaDeStatusPermitida('reagendado', 'agendado')).toBe(false);
  });
});
