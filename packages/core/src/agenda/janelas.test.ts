import { describe, expect, it } from 'vitest';
import { janelasSeSobrepoem, validarJanela } from './janelas.js';

const janela = { diaSemana: 1, horaInicio: '09:00', horaFim: '12:00' };

describe('RN-30 janela de disponibilidade', () => {
  it('aceita uma janela correta, com duração opcional', () => {
    expect(validarJanela(janela)).toEqual({ ok: true });
    expect(validarJanela({ ...janela, duracaoMinutos: 60 })).toEqual({ ok: true });
    expect(validarJanela({ ...janela, duracaoMinutos: 180 })).toEqual({ ok: true });
  });

  it.each([0, 6])(
    'aceita fim de semana (dia %i), pois a agência escolhe quando atende',
    (diaSemana) => {
      expect(validarJanela({ ...janela, diaSemana })).toEqual({ ok: true });
    },
  );

  it.each([-1, 7, 1.5, Number.NaN])('rejeita dia da semana %s', (diaSemana) => {
    expect(validarJanela({ ...janela, diaSemana })).toEqual({ ok: false, erro: 'dia_invalido' });
  });

  it.each(['9:00', '25:00', '09:60', '0900', '', '09:00:00', 'manhã'])(
    'rejeita hora %j',
    (hora) => {
      expect(validarJanela({ ...janela, horaInicio: hora })).toEqual({
        ok: false,
        erro: 'hora_invalida',
      });
      expect(validarJanela({ ...janela, horaFim: hora })).toEqual({
        ok: false,
        erro: 'hora_invalida',
      });
    },
  );

  it('exige que o fim seja depois do início', () => {
    expect(validarJanela({ ...janela, horaFim: '09:00' })).toEqual({
      ok: false,
      erro: 'intervalo_invalido',
    });
    expect(validarJanela({ ...janela, horaInicio: '13:00', horaFim: '12:00' })).toEqual({
      ok: false,
      erro: 'intervalo_invalido',
    });
  });

  it('não aceita janela que passa da meia-noite', () => {
    expect(validarJanela({ ...janela, horaInicio: '22:00', horaFim: '00:00' })).toEqual({
      ok: false,
      erro: 'intervalo_invalido',
    });
    expect(validarJanela({ ...janela, horaInicio: '22:00', horaFim: '23:59' })).toEqual({
      ok: true,
    });
  });

  it.each([0, -30, 15.5, Number.NaN])('rejeita duração %s', (duracaoMinutos) => {
    expect(validarJanela({ ...janela, duracaoMinutos })).toEqual({
      ok: false,
      erro: 'duracao_invalida',
    });
  });

  it('rejeita duração maior que a própria janela', () => {
    expect(validarJanela({ ...janela, duracaoMinutos: 181 })).toEqual({
      ok: false,
      erro: 'duracao_invalida',
    });
  });
});

describe('janelas que se sobrepõem', () => {
  const outra = (diaSemana: number, horaInicio: string, horaFim: string) => ({
    diaSemana,
    horaInicio,
    horaFim,
  });

  it('detecta sobreposição parcial, total e contida no mesmo dia', () => {
    expect(janelasSeSobrepoem(janela, outra(1, '11:00', '14:00'))).toBe(true);
    expect(janelasSeSobrepoem(janela, outra(1, '08:00', '13:00'))).toBe(true);
    expect(janelasSeSobrepoem(janela, outra(1, '10:00', '11:00'))).toBe(true);
  });

  it('janelas que só se encostam não se sobrepõem', () => {
    expect(janelasSeSobrepoem(janela, outra(1, '12:00', '14:00'))).toBe(false);
    expect(janelasSeSobrepoem(janela, outra(1, '07:00', '09:00'))).toBe(false);
  });

  it('dias diferentes nunca se sobrepõem', () => {
    expect(janelasSeSobrepoem(janela, outra(2, '09:00', '12:00'))).toBe(false);
  });
});
