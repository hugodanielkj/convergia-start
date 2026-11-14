import { describe, expect, it } from 'vitest';
import { consultaDosFiltros } from './tipos';

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
