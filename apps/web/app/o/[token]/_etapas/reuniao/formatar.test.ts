import { describe, expect, it } from 'vitest';
import {
  formatarDia,
  formatarDiaEHora,
  formatarHora,
  fusosDisponiveis,
  partesDoDia,
  partesDoInstante,
  periodoDaHora,
} from './formatar';

const INSTANTE = '2026-11-17T12:00:00.000Z';

describe('horários no fuso do cliente (RN-32)', () => {
  it('mostra o mesmo instante com a hora de cada fuso', () => {
    expect(formatarHora(INSTANTE, 'America/Sao_Paulo')).toBe('09:00');
    expect(formatarHora(INSTANTE, 'Europe/Lisbon')).toBe('12:00');
    expect(formatarHora(INSTANTE, 'Asia/Tokyo')).toBe('21:00');
  });

  it('escreve o dia por extenso em português', () => {
    expect(formatarDia('2026-11-17')).toMatch(/terça-feira, 17 de novembro/i);
    expect(formatarDia('2026-11-21')).toMatch(/sábado, 21 de novembro/i);
  });

  it('junta dia e hora no fuso pedido', () => {
    expect(formatarDiaEHora(INSTANTE, 'America/Sao_Paulo')).toMatch(
      /terça-feira, 17 de novembro.*09:00/i,
    );
    expect(formatarDiaEHora(INSTANTE, 'Asia/Tokyo')).toMatch(/terça-feira, 17 de novembro.*21:00/i);
  });

  it('um instante que passa da meia-noite muda o dia no fuso do cliente', () => {
    expect(formatarDiaEHora('2026-11-17T23:00:00.000Z', 'Asia/Tokyo')).toMatch(
      /quarta-feira, 18 de novembro.*08:00/i,
    );
  });

  it('a lista de fusos tem o do cliente mesmo quando o navegador não a traz', () => {
    const lista = fusosDisponiveis('Mars/Olympus');
    expect(lista[0]).toBe('Mars/Olympus');
    expect(lista).toContain('America/Sao_Paulo');
    expect(new Set(lista).size).toBe(lista.length);
  });
});

describe('faixa de dias e horários agrupados (RN-30, RN-32)', () => {
  it('quebra o dia em pedaços curtos, sem ponto de abreviação', () => {
    expect(partesDoDia('2026-11-17')).toEqual({ semana: 'ter', dia: '17', mes: 'nov' });
  });

  it('usa o fuso do cliente para o horário marcado', () => {
    expect(partesDoInstante('2026-11-17T23:00:00.000Z', 'Asia/Tokyo')).toEqual({
      semana: 'qua',
      dia: '18',
      mes: 'nov',
    });
  });

  it('agrupa em manhã, tarde e noite', () => {
    expect(periodoDaHora('09:30')).toBe('Manhã');
    expect(periodoDaHora('12:00')).toBe('Tarde');
    expect(periodoDaHora('17:59')).toBe('Tarde');
    expect(periodoDaHora('18:00')).toBe('Noite');
  });
});
