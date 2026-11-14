import { describe, expect, it } from 'vitest';
import {
  compararJanelas,
  formatarData,
  formatarPeriodo,
  mensagemDeErro,
  ORDEM_DA_SEMANA,
  rotuloDia,
  rotuloTipo,
} from './mensagens';

describe('textos da agenda', () => {
  it('mostra a semana começando na segunda, com domingo por último', () => {
    expect(ORDEM_DA_SEMANA.map(rotuloDia)).toEqual([
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
      'Domingo',
    ]);
  });

  it('traduz os tipos de atendimento', () => {
    expect(rotuloTipo('reuniao')).toBe('Reunião');
    expect(rotuloTipo('captacao')).toBe('Captação');
  });

  it.each([
    ['intervalo_invalido', /depois do início/],
    ['sobreposicao', /se sobrepõe/],
    ['motivo_obrigatorio', /motivo/],
    ['codigo_novo', /Valor inválido/],
  ])('traduz o código %s', (codigo, esperado) => {
    expect(mensagemDeErro(codigo)).toMatch(esperado);
  });

  it('formata datas de calendário sem passar por fuso', () => {
    expect(formatarData('2026-11-15')).toBe('15/11/2026');
    expect(formatarData('lixo')).toBe('lixo');
    expect(formatarPeriodo('2026-11-10', '2026-11-10')).toBe('10/11/2026');
    expect(formatarPeriodo('2026-12-28', '2027-01-02')).toBe('28/12/2026 a 02/01/2027');
  });

  it('ordena reunião antes de captação, segunda a domingo e pela hora', () => {
    const janelas = [
      { tipo: 'captacao', diaSemana: 1, horaInicio: '08:00' },
      { tipo: 'reuniao', diaSemana: 0, horaInicio: '08:00' },
      { tipo: 'reuniao', diaSemana: 1, horaInicio: '14:00' },
      { tipo: 'reuniao', diaSemana: 1, horaInicio: '09:00' },
    ];
    const ordenadas = [...janelas]
      .sort(compararJanelas)
      .map((j) => `${j.tipo} ${String(j.diaSemana)} ${j.horaInicio}`);
    expect(ordenadas).toEqual([
      'reuniao 1 09:00',
      'reuniao 1 14:00',
      'reuniao 0 08:00',
      'captacao 1 08:00',
    ]);
  });
});
