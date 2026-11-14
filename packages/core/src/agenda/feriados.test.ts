import { describe, expect, it } from 'vitest';
import { feriadoNacional, feriadosNacionais } from './feriados.js';

const datas = (ano: number) => feriadosNacionais(ano).map((f) => f.data);

describe('RN-44 feriados nacionais', () => {
  it('lista os feriados de 2026, em ordem, com a Sexta-feira Santa calculada', () => {
    expect(feriadosNacionais(2026)).toEqual([
      { data: '2026-01-01', nome: 'Confraternização Universal' },
      { data: '2026-04-03', nome: 'Sexta-feira Santa' },
      { data: '2026-04-21', nome: 'Tiradentes' },
      { data: '2026-05-01', nome: 'Dia do Trabalho' },
      { data: '2026-09-07', nome: 'Independência do Brasil' },
      { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
      { data: '2026-11-02', nome: 'Finados' },
      { data: '2026-11-15', nome: 'Proclamação da República' },
      { data: '2026-11-20', nome: 'Dia da Consciência Negra' },
      { data: '2026-12-25', nome: 'Natal' },
    ]);
  });

  it.each([
    [2024, '2024-03-29'],
    [2025, '2025-04-18'],
    [2027, '2027-03-26'],
    [2028, '2028-04-14'],
    [2038, '2038-04-23'],
  ])('a Sexta-feira Santa de %i cai em %s', (ano, esperada) => {
    expect(datas(ano)).toContain(esperada);
  });

  it('a Consciência Negra só é feriado nacional desde 2024 (Lei 14.759/2023)', () => {
    expect(datas(2023)).not.toContain('2023-11-20');
    expect(datas(2024)).toContain('2024-11-20');
  });

  it('não inclui Carnaval nem Corpus Christi, que são ponto facultativo', () => {
    const nomes = feriadosNacionais(2026).map((f) => f.nome);
    expect(nomes.some((n) => /carnaval|corpus/i.test(n))).toBe(false);
  });

  it('consulta se uma data é feriado nacional', () => {
    expect(feriadoNacional('2026-09-07')?.nome).toBe('Independência do Brasil');
    expect(feriadoNacional('2026-04-03')?.nome).toBe('Sexta-feira Santa');
    expect(feriadoNacional('2026-09-08')).toBeUndefined();
  });
});
