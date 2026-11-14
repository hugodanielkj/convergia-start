import { describe, expect, it } from 'vitest';
import { captacaoRespeitaIntervalo, validarDadosCaptacao } from './index.js';

const FUSO = 'America/Sao_Paulo';

describe('RN-39 captação depois da reunião', () => {
  const reuniao = new Date('2026-12-02T17:00:00Z'); // 14h em Brasília

  it('aceita a captação a partir do intervalo mínimo em dias', () => {
    const captacao = new Date('2026-12-03T13:00:00Z'); // 10h do dia seguinte
    expect(captacaoRespeitaIntervalo(reuniao, captacao, 1, FUSO)).toBe(true);
  });

  it('recusa a captação no mesmo dia da reunião quando o intervalo é de 1 dia', () => {
    const captacao = new Date('2026-12-02T20:00:00Z');
    expect(captacaoRespeitaIntervalo(reuniao, captacao, 1, FUSO)).toBe(false);
  });

  it('conta os dias no fuso da agência, não em UTC', () => {
    // 23h de Brasília do dia 2 já é dia 3 em UTC, mas continua no mesmo dia da reunião.
    const captacao = new Date('2026-12-03T02:00:00Z');
    expect(captacaoRespeitaIntervalo(reuniao, captacao, 1, FUSO)).toBe(false);
  });

  it('com intervalo 0 aceita o mesmo dia, mas nunca antes da reunião', () => {
    expect(captacaoRespeitaIntervalo(reuniao, new Date('2026-12-02T20:00:00Z'), 0, FUSO)).toBe(
      true,
    );
    expect(captacaoRespeitaIntervalo(reuniao, new Date('2026-12-01T20:00:00Z'), 0, FUSO)).toBe(
      false,
    );
  });

  it('respeita intervalos maiores', () => {
    const captacao = new Date('2026-12-04T13:00:00Z');
    expect(captacaoRespeitaIntervalo(reuniao, captacao, 3, FUSO)).toBe(false);
    expect(captacaoRespeitaIntervalo(reuniao, new Date('2026-12-05T13:00:00Z'), 3, FUSO)).toBe(
      true,
    );
  });
});

describe('RN-40 dados adicionais da captação', () => {
  it('exige o local quando a captação é presencial', () => {
    const r = validarDadosCaptacao({ presencial: true, local: '  ' });
    expect(r).toEqual({ ok: false, erro: 'local_obrigatorio' });
  });

  it('aceita presencial com local e limpa os espaços', () => {
    const r = validarDadosCaptacao({
      presencial: true,
      local: ' Rua A, 10 ',
      contatoLocal: ' Maria ',
      observacoes: ' ',
    });
    expect(r).toEqual({
      ok: true,
      dados: { presencial: true, local: 'Rua A, 10', contatoLocal: 'Maria', observacoes: null },
    });
  });

  it('não exige local quando não é presencial', () => {
    const r = validarDadosCaptacao({ presencial: false });
    expect(r).toEqual({
      ok: true,
      dados: { presencial: false, local: null, contatoLocal: null, observacoes: null },
    });
  });
});
