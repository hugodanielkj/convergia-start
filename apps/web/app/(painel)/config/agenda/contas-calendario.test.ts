import { describe, expect, it } from 'vitest';
import {
  diasDaSemana,
  enderecoDoCalendario,
  horarioDoDia,
  inicioDaSemana,
  lerParametros,
  nomeDaSemana,
  periodoVisivel,
  semanasDoMes,
  somarMeses,
} from './contas-calendario';

const janelas = [4, 5].map((diaSemana) => ({
  tipo: 'reuniao' as const,
  diaSemana,
  horaInicio: '13:00',
  horaFim: '17:00',
  duracaoMinutos: 40,
}));

describe('semana e mês', () => {
  it('a semana vai de segunda a domingo', () => {
    expect(inicioDaSemana('2026-11-26')).toBe('2026-11-23'); // quinta
    expect(inicioDaSemana('2026-11-29')).toBe('2026-11-23'); // domingo
    expect(inicioDaSemana('2026-11-23')).toBe('2026-11-23');
    expect(diasDaSemana('2026-11-26')).toHaveLength(7);
    expect(nomeDaSemana('2026-11-26')).toBe('23/11 a 29/11/2026');
  });

  it('o mês traz semanas inteiras, com os dias vizinhos nas pontas', () => {
    const semanas = semanasDoMes('2026-11-15');
    expect(semanas[0]?.[0]).toBe('2026-10-26');
    expect(semanas.at(-1)?.[6]).toBe('2026-12-06');
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(periodoVisivel('mes', '2026-11-15')).toEqual({ de: '2026-10-26', ate: '2026-12-06' });
    expect(periodoVisivel('semana', '2026-11-26')).toEqual({ de: '2026-11-23', ate: '2026-11-29' });
  });

  it('soma meses sem passar do último dia', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15');
    expect(somarMeses('2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('horário que vale no dia (RN-30)', () => {
  it('sem exceção vale o horário padrão do dia da semana', () => {
    const r = horarioDoDia('2026-11-27', 'reuniao', janelas, []);
    expect(r.personalizado).toBe(false);
    expect(r.horarios).toHaveLength(1);
    expect(horarioDoDia('2026-11-25', 'reuniao', janelas, []).horarios).toEqual([]);
  });

  it('a exceção do dia substitui o padrão só naquela data e naquele tipo', () => {
    const excecoes = [
      {
        tipo: 'reuniao' as const,
        data: '2026-11-27',
        horaInicio: '14:00',
        horaFim: '17:00',
        duracaoMinutos: 40,
      },
    ];
    const sexta = horarioDoDia('2026-11-27', 'reuniao', janelas, excecoes);
    expect(sexta.personalizado).toBe(true);
    expect(sexta.horarios.map((h) => h.horaInicio)).toEqual(['14:00']);
    expect(horarioDoDia('2026-11-26', 'reuniao', janelas, excecoes).personalizado).toBe(false);
    expect(horarioDoDia('2026-11-27', 'captacao', janelas, excecoes).personalizado).toBe(false);
  });
});

describe('endereço da tela', () => {
  it('lê a URL e cai no padrão com valor estranho', () => {
    expect(lerParametros({}, '2026-11-23')).toEqual({
      visao: 'semana',
      data: '2026-11-23',
      dia: null,
    });
    expect(lerParametros({ visao: 'mes', data: '2026-12-01', dia: '2026-12-03' }, 'x')).toEqual({
      visao: 'mes',
      data: '2026-12-01',
      dia: '2026-12-03',
    });
    expect(lerParametros({ visao: 'ano', data: '2026-02-31', dia: 'abc' }, '2026-11-23')).toEqual({
      visao: 'semana',
      data: '2026-11-23',
      dia: null,
    });
  });

  it('monta o endereço com os três parâmetros', () => {
    expect(enderecoDoCalendario({ visao: 'mes', data: '2026-11-01', dia: '2026-11-05' })).toBe(
      '/config/agenda?visao=mes&data=2026-11-01&dia=2026-11-05',
    );
    expect(enderecoDoCalendario({ visao: 'semana', data: '2026-11-23' })).toBe(
      '/config/agenda?visao=semana&data=2026-11-23',
    );
  });
});
