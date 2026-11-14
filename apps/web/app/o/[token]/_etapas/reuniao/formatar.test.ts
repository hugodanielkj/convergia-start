import { describe, expect, it } from 'vitest';
import { formatarDia, formatarDiaEHora, formatarHora, fusosDisponiveis } from './formatar';

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
