import { describe, expect, it } from 'vitest';
import { agruparPorDia, gerarSlots, MAX_DIAS_CONSULTA, type EntradaSlots } from './slots.js';

const SP = 'America/Sao_Paulo';
// Segunda-feira 16/11/2026, 09:00 em São Paulo.
const AGORA = new Date('2026-11-16T12:00:00.000Z');
const seg_a_sex = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  horaInicio: '09:00',
  horaFim: '12:00',
}));

const base: EntradaSlots = {
  janelas: seg_a_sex,
  bloqueios: [],
  ocupados: [],
  agora: AGORA,
  antecedenciaMinimaHoras: 24,
  duracaoPadraoMinutos: 60,
  fusoAgencia: SP,
  de: '2026-11-16',
  ate: '2026-11-18',
};

const inicios = (entrada: Partial<EntradaSlots>) =>
  gerarSlots({ ...base, ...entrada }).map((s) => s.inicio.toISOString());

describe('RN-30 geração de slots', () => {
  it('gera os slots de cada janela, em UTC, em ordem', () => {
    const slots = gerarSlots({
      ...base,
      antecedenciaMinimaHoras: 0,
      de: '2026-11-17',
      ate: '2026-11-17',
    });
    expect(slots.map((s) => [s.inicio.toISOString(), s.fim.toISOString()])).toEqual([
      ['2026-11-17T12:00:00.000Z', '2026-11-17T13:00:00.000Z'],
      ['2026-11-17T13:00:00.000Z', '2026-11-17T14:00:00.000Z'],
      ['2026-11-17T14:00:00.000Z', '2026-11-17T15:00:00.000Z'],
    ]);
  });

  it('usa a duração da janela quando ela tem, e a da agência quando não tem', () => {
    const umDia = { antecedenciaMinimaHoras: 0, de: '2026-11-17', ate: '2026-11-17' };
    expect(
      inicios({
        ...umDia,
        janelas: [{ diaSemana: 2, horaInicio: '09:00', horaFim: '12:00', duracaoMinutos: 45 }],
      }),
    ).toEqual([
      '2026-11-17T12:00:00.000Z',
      '2026-11-17T12:45:00.000Z',
      '2026-11-17T13:30:00.000Z',
      '2026-11-17T14:15:00.000Z',
    ]);
    expect(inicios({ ...umDia, duracaoPadraoMinutos: 90 })).toEqual([
      '2026-11-17T12:00:00.000Z',
      '2026-11-17T13:30:00.000Z',
    ]);
  });

  it('só gera slot que cabe inteiro dentro da janela', () => {
    expect(
      inicios({
        antecedenciaMinimaHoras: 0,
        de: '2026-11-17',
        ate: '2026-11-17',
        duracaoPadraoMinutos: 100,
      }),
    ).toEqual(['2026-11-17T12:00:00.000Z']);
  });

  it('junta várias janelas do mesmo dia, como manhã e tarde', () => {
    const janelas = [
      { diaSemana: 2, horaInicio: '14:00', horaFim: '15:00' },
      { diaSemana: 2, horaInicio: '09:00', horaFim: '10:00' },
    ];
    expect(
      inicios({ janelas, antecedenciaMinimaHoras: 0, de: '2026-11-17', ate: '2026-11-17' }),
    ).toEqual(['2026-11-17T12:00:00.000Z', '2026-11-17T17:00:00.000Z']);
  });

  it('não repete o mesmo horário quando dois profissionais têm a mesma janela', () => {
    const terca = { diaSemana: 2, horaInicio: '09:00', horaFim: '12:00' };
    const janelas = [terca, terca];
    expect(
      inicios({ janelas, antecedenciaMinimaHoras: 0, de: '2026-11-17', ate: '2026-11-17' }),
    ).toHaveLength(3);
  });

  it('gera slot em fim de semana se a agência cadastrou janela nesse dia', () => {
    const janelas = [{ diaSemana: 6, horaInicio: '10:00', horaFim: '11:00' }];
    expect(
      inicios({ janelas, antecedenciaMinimaHoras: 0, de: '2026-11-21', ate: '2026-11-22' }),
    ).toEqual(['2026-11-21T13:00:00.000Z']);
  });
});

describe('RN-31 antecedência mínima', () => {
  it('não mostra slots mais próximos que a antecedência, e o limite exato ainda vale', () => {
    // 24h depois de segunda 09:00 é terça 09:00 (12:00 UTC).
    expect(inicios({})[0]).toBe('2026-11-17T12:00:00.000Z');
    expect(inicios({ agora: new Date(AGORA.getTime() + 1) })[0]).toBe('2026-11-17T13:00:00.000Z');
  });

  it('sem antecedência, só some o que já passou', () => {
    const depois = new Date('2026-11-16T14:30:00.000Z');
    expect(
      inicios({ antecedenciaMinimaHoras: 0, agora: depois, de: '2026-11-16', ate: '2026-11-16' }),
    ).toEqual([]);
    expect(
      inicios({
        antecedenciaMinimaHoras: 0,
        agora: new Date('2026-11-16T12:30:00.000Z'),
        de: '2026-11-16',
        ate: '2026-11-16',
      }),
    ).toEqual(['2026-11-16T13:00:00.000Z', '2026-11-16T14:00:00.000Z']);
  });

  it('a antecedência pode ser de vários dias', () => {
    expect(inicios({ antecedenciaMinimaHoras: 72, de: '2026-11-16', ate: '2026-11-19' })[0]).toBe(
      '2026-11-19T12:00:00.000Z',
    );
  });
});

describe('RN-30 e RN-44 dias sem atendimento', () => {
  it('não gera slots em dia bloqueado, nem no primeiro e no último dia do bloqueio', () => {
    const bloqueios = [{ dataInicio: '2026-11-17', dataFim: '2026-11-17', motivo: 'Folga' }];
    expect(
      inicios({ bloqueios, antecedenciaMinimaHoras: 0 }).every((i) => !i.startsWith('2026-11-17')),
    ).toBe(true);
    expect(inicios({ bloqueios, antecedenciaMinimaHoras: 0 })).toHaveLength(6);
  });

  it('não gera slots em feriado nacional', () => {
    // Sexta 20/11/2026 é o Dia da Consciência Negra.
    expect(
      inicios({ antecedenciaMinimaHoras: 0, de: '2026-11-19', ate: '2026-11-21' }),
    ).toHaveLength(3);
  });

  it('o Natal e a Sexta-feira Santa também ficam de fora', () => {
    const sexta = [{ diaSemana: 5, horaInicio: '09:00', horaFim: '10:00' }];
    expect(
      inicios({
        janelas: sexta,
        antecedenciaMinimaHoras: 0,
        agora: new Date('2026-04-01T00:00:00Z'),
        de: '2026-04-03',
        ate: '2026-04-03',
      }),
    ).toEqual([]);
    expect(
      inicios({
        janelas: sexta,
        antecedenciaMinimaHoras: 0,
        agora: new Date('2026-12-01T00:00:00Z'),
        de: '2026-12-25',
        ate: '2026-12-25',
      }),
    ).toEqual([]);
  });
});

describe('RN-33 horários já ocupados', () => {
  const quarta = (inicio: string, fim: string) => ({
    inicio: new Date(inicio),
    fim: new Date(fim),
  });

  it('tira o slot ocupado e deixa os vizinhos', () => {
    const ocupados = [quarta('2026-11-18T13:00:00.000Z', '2026-11-18T14:00:00.000Z')];
    expect(inicios({ ocupados, de: '2026-11-18', ate: '2026-11-18' })).toEqual([
      '2026-11-18T12:00:00.000Z',
      '2026-11-18T14:00:00.000Z',
    ]);
  });

  it('um agendamento que invade parte de dois slots tira os dois', () => {
    const ocupados = [quarta('2026-11-18T13:30:00.000Z', '2026-11-18T14:30:00.000Z')];
    expect(inicios({ ocupados, de: '2026-11-18', ate: '2026-11-18' })).toEqual([
      '2026-11-18T12:00:00.000Z',
    ]);
  });

  it('agendamento que só encosta no slot não o tira', () => {
    const ocupados = [
      quarta('2026-11-18T11:00:00.000Z', '2026-11-18T12:00:00.000Z'),
      quarta('2026-11-18T15:00:00.000Z', '2026-11-18T16:00:00.000Z'),
    ];
    expect(inicios({ ocupados, de: '2026-11-18', ate: '2026-11-18' })).toHaveLength(3);
  });
});

describe('RN-32 fuso da agência', () => {
  it('9h na Índia é 03:30 UTC', () => {
    const janelas = [{ diaSemana: 2, horaInicio: '09:00', horaFim: '10:00' }];
    expect(
      inicios({
        janelas,
        fusoAgencia: 'Asia/Kolkata',
        antecedenciaMinimaHoras: 0,
        de: '2026-11-17',
        ate: '2026-11-17',
      }),
    ).toEqual(['2026-11-17T03:30:00.000Z']);
  });

  it('pula o horário que não existe na virada do horário de verão', () => {
    const janelas = [{ diaSemana: 0, horaInicio: '01:00', horaFim: '05:00' }];
    const resultado = inicios({
      janelas,
      fusoAgencia: 'America/New_York',
      agora: new Date('2026-03-01T00:00:00Z'),
      antecedenciaMinimaHoras: 0,
      de: '2026-03-08',
      ate: '2026-03-08',
    });
    expect(resultado).toEqual([
      '2026-03-08T06:00:00.000Z',
      '2026-03-08T07:00:00.000Z',
      '2026-03-08T08:00:00.000Z',
    ]);
  });
});

describe('validação da consulta', () => {
  it('recusa período invertido, longo demais e fuso inexistente', () => {
    expect(() => gerarSlots({ ...base, de: '2026-11-18', ate: '2026-11-17' })).toThrow(/período/i);
    expect(() => gerarSlots({ ...base, de: '2026-01-01', ate: '2026-12-31' })).toThrow(/período/i);
    expect(() => gerarSlots({ ...base, fusoAgencia: 'Lua/Base_Alfa' })).toThrow(/fuso/i);
    expect(() => gerarSlots({ ...base, de: '2026-02-30' })).toThrow(/período/i);
  });

  it('aceita o período máximo', () => {
    const ate = new Date(Date.UTC(2026, 10, 16 + MAX_DIAS_CONSULTA - 1)).toISOString().slice(0, 10);
    expect(() => gerarSlots({ ...base, ate })).not.toThrow();
  });
});

describe('RN-32 horários no fuso do cliente', () => {
  it('agrupa por dia local do cliente, não da agência', () => {
    const slots = gerarSlots({
      ...base,
      antecedenciaMinimaHoras: 0,
      de: '2026-11-17',
      ate: '2026-11-17',
    });
    const tarde = {
      inicio: new Date('2026-11-17T23:00:00.000Z'),
      fim: new Date('2026-11-18T00:00:00.000Z'),
    };
    const grupos = agruparPorDia([...slots, tarde], 'Asia/Tokyo');
    expect(grupos.map((g) => [g.data, g.slots.length])).toEqual([
      ['2026-11-17', 3],
      ['2026-11-18', 1],
    ]);
  });

  it('no mesmo fuso da agência o agrupamento bate com os dias de atendimento', () => {
    const slots = gerarSlots({
      ...base,
      antecedenciaMinimaHoras: 0,
      de: '2026-11-17',
      ate: '2026-11-18',
    });
    expect(agruparPorDia(slots, SP).map((g) => g.data)).toEqual(['2026-11-17', '2026-11-18']);
  });

  it('sem slots não há grupos', () => {
    expect(agruparPorDia([], SP)).toEqual([]);
  });
});
