import { describe, expect, it } from 'vitest';
import { encontrarDuplicidades, type ClienteExistente } from './duplicidade.js';

const maria: ClienteExistente = {
  id: 'c1',
  nomeEmpresa: 'Padaria Pão Quente',
  whatsapp: '+5531999998888',
  email: 'maria@padaria.com.br',
};
const joao: ClienteExistente = {
  id: 'c2',
  nomeEmpresa: 'Oficina do João',
  whatsapp: '+5511987654321',
  email: null,
};
const sonia: ClienteExistente = {
  id: 'c3',
  nomeEmpresa: 'Studio Sônia',
  whatsapp: null,
  email: 'sonia@studio.com',
};

describe('RN-07 alerta de cadastro duplicado', () => {
  it('não alerta quando nenhum canal coincide', () => {
    const novo = { whatsapp: '+5521977776666', email: 'novo@loja.com' };
    expect(encontrarDuplicidades(novo, [maria, joao, sonia])).toEqual([]);
  });

  it('não alerta quando não há clientes cadastrados', () => {
    expect(encontrarDuplicidades({ whatsapp: '+5531999998888', email: null }, [])).toEqual([]);
  });

  it('alerta quando o e-mail é o mesmo', () => {
    const novo = { whatsapp: null, email: 'maria@padaria.com.br' };
    expect(encontrarDuplicidades(novo, [maria, joao])).toEqual([
      { cliente: maria, motivos: ['email'] },
    ]);
  });

  it('alerta quando o WhatsApp é o mesmo', () => {
    const novo = { whatsapp: '+5511987654321', email: null };
    expect(encontrarDuplicidades(novo, [maria, joao])).toEqual([
      { cliente: joao, motivos: ['whatsapp'] },
    ]);
  });

  it('informa os dois motivos quando e-mail e WhatsApp coincidem com o mesmo cliente', () => {
    const novo = { whatsapp: '+5531999998888', email: 'maria@padaria.com.br' };
    expect(encontrarDuplicidades(novo, [maria])).toEqual([
      { cliente: maria, motivos: ['whatsapp', 'email'] },
    ]);
  });

  it('lista clientes diferentes quando cada canal coincide com um deles', () => {
    const novo = { whatsapp: '+5511987654321', email: 'sonia@studio.com' };
    expect(encontrarDuplicidades(novo, [maria, joao, sonia])).toEqual([
      { cliente: joao, motivos: ['whatsapp'] },
      { cliente: sonia, motivos: ['email'] },
    ]);
  });

  it('não trata canal ausente como coincidência', () => {
    const novo = { whatsapp: null, email: null };
    expect(encontrarDuplicidades(novo, [joao, sonia])).toEqual([]);
  });

  it('ignora o próprio cliente ao editar um cadastro existente', () => {
    const novo = { whatsapp: '+5531999998888', email: 'maria@padaria.com.br' };
    expect(encontrarDuplicidades(novo, [maria, joao], { ignorarId: 'c1' })).toEqual([]);
  });

  it('ainda alerta sobre outros clientes ao editar um cadastro', () => {
    const novo = { whatsapp: '+5511987654321', email: 'maria@padaria.com.br' };
    expect(encontrarDuplicidades(novo, [maria, joao], { ignorarId: 'c1' })).toEqual([
      { cliente: joao, motivos: ['whatsapp'] },
    ]);
  });
});
