import { describe, expect, it } from 'vitest';
import { validarCadastroCliente } from './cadastro.js';

const base = { nomeEmpresa: 'Padaria Pão Quente', nomeContato: 'Maria Silva' };

describe('RN-04 campos obrigatórios do cadastro de cliente', () => {
  it('aceita cadastro só com WhatsApp', () => {
    expect(validarCadastroCliente({ ...base, whatsapp: '(31) 99999-8888' })).toEqual({
      ok: true,
      cliente: { ...base, whatsapp: '+5531999998888', email: null },
    });
  });

  it('aceita cadastro só com e-mail', () => {
    expect(validarCadastroCliente({ ...base, email: 'Maria@Padaria.com.br' })).toEqual({
      ok: true,
      cliente: { ...base, whatsapp: null, email: 'maria@padaria.com.br' },
    });
  });

  it('aceita cadastro com os dois canais', () => {
    expect(
      validarCadastroCliente({ ...base, whatsapp: '31999998888', email: 'maria@padaria.com.br' }),
    ).toEqual({
      ok: true,
      cliente: { ...base, whatsapp: '+5531999998888', email: 'maria@padaria.com.br' },
    });
  });

  it('remove espaços extras dos nomes', () => {
    const resultado = validarCadastroCliente({
      nomeEmpresa: '  Padaria   Pão  Quente ',
      nomeContato: '\tMaria \n Silva ',
      email: 'maria@padaria.com.br',
    });
    expect(resultado).toMatchObject({
      ok: true,
      cliente: { nomeEmpresa: 'Padaria Pão Quente', nomeContato: 'Maria Silva' },
    });
  });

  it('exige nome da empresa e do contato', () => {
    expect(
      validarCadastroCliente({ nomeEmpresa: '   ', nomeContato: '', email: 'a@b.co' }),
    ).toEqual({
      ok: false,
      erros: [
        { campo: 'nomeEmpresa', codigo: 'obrigatorio', regra: 'RN-04' },
        { campo: 'nomeContato', codigo: 'obrigatorio', regra: 'RN-04' },
      ],
    });
  });

  it.each([
    ['nenhum canal informado', {}],
    ['canais vazios', { whatsapp: '', email: '' }],
    ['canais só com espaços', { whatsapp: '  ', email: ' ' }],
    ['canais indefinidos', { whatsapp: undefined, email: undefined }],
  ])('exige WhatsApp ou e-mail: %s', (_caso, canais) => {
    expect(validarCadastroCliente({ ...base, ...canais })).toEqual({
      ok: false,
      erros: [{ campo: 'contato', codigo: 'contato_obrigatorio', regra: 'RN-04' }],
    });
  });

  it('devolve todos os erros de uma vez', () => {
    expect(validarCadastroCliente({ nomeEmpresa: '', nomeContato: '' })).toEqual({
      ok: false,
      erros: [
        { campo: 'nomeEmpresa', codigo: 'obrigatorio', regra: 'RN-04' },
        { campo: 'nomeContato', codigo: 'obrigatorio', regra: 'RN-04' },
        { campo: 'contato', codigo: 'contato_obrigatorio', regra: 'RN-04' },
      ],
    });
  });
});

describe('RN-05 canais de contato informados precisam ser válidos', () => {
  it('rejeita WhatsApp inválido mesmo com e-mail válido', () => {
    expect(
      validarCadastroCliente({ ...base, whatsapp: '(31) 9999-8888', email: 'maria@padaria.com' }),
    ).toEqual({
      ok: false,
      erros: [{ campo: 'whatsapp', codigo: 'telefone_invalido', regra: 'RN-05' }],
    });
  });

  it('informa DDD inexistente', () => {
    expect(validarCadastroCliente({ ...base, whatsapp: '(20) 99999-8888' })).toEqual({
      ok: false,
      erros: [{ campo: 'whatsapp', codigo: 'ddd_invalido', regra: 'RN-05' }],
    });
  });

  it('rejeita e-mail inválido mesmo com WhatsApp válido', () => {
    expect(
      validarCadastroCliente({ ...base, whatsapp: '31999998888', email: 'maria@padaria' }),
    ).toEqual({
      ok: false,
      erros: [{ campo: 'email', codigo: 'email_invalido', regra: 'RN-05' }],
    });
  });

  it('não pede canal obrigatório quando um canal foi informado, mas é inválido', () => {
    expect(validarCadastroCliente({ ...base, email: 'maria@' })).toEqual({
      ok: false,
      erros: [{ campo: 'email', codigo: 'email_invalido', regra: 'RN-05' }],
    });
  });
});
