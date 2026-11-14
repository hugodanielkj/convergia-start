import { describe, expect, it } from 'vitest';
import { consultaDosFiltros, formatarDataDoPrazo } from './tipos';

describe('consultaDosFiltros', () => {
  it('mantém só filtros conhecidos e preenchidos', () => {
    expect(
      consultaDosFiltros({ status: 'em_andamento', de: '', outro: 'x', atencao: ['a', 'b'] }),
    ).toEqual({ filtros: { status: 'em_andamento' }, consulta: 'status=em_andamento' });
  });

  it('sem filtros, consulta vazia', () => {
    expect(consultaDosFiltros({})).toEqual({ filtros: {}, consulta: '' });
  });
});

describe('RN-48 prazo no painel', () => {
  it('escreve a data do prazo sem deslocar o dia', () => {
    expect(formatarDataDoPrazo('2026-11-26')).toBe('26/11/2026');
  });

  it('repassa o filtro de indicador de prazo à API (RN-64)', () => {
    expect(consultaDosFiltros({ prazo: 'atrasado', outro: 'x' }).consulta).toBe('prazo=atrasado');
  });
});
