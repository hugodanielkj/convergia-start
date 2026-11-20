import { describe, expect, it } from 'vitest';
import { rotuloResponsavel } from './SeletorResponsavel';

describe('RN-08 nome do responsável na lista', () => {
  const ana = { id: '1', nome: 'Ana', email: 'ana@a.com' };
  const admin1 = { id: '2', nome: 'Admin', email: 'um@a.com' };
  const admin2 = { id: '3', nome: 'Admin', email: 'dois@a.com' };

  it('só o nome quando ele é único', () => {
    expect(rotuloResponsavel(ana, [ana, admin1])).toBe('Ana');
  });

  it('nome e e-mail quando o nome se repete', () => {
    expect(rotuloResponsavel(admin1, [ana, admin1, admin2])).toBe('Admin · um@a.com');
  });
});
