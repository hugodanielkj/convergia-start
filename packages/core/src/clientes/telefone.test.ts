import { describe, expect, it } from 'vitest';
import { normalizarTelefone } from './telefone.js';

describe('RN-05 normalização de telefone em E.164', () => {
  describe('números brasileiros (DDI 55 por padrão)', () => {
    it.each([
      ['(31) 99999-8888', '+5531999998888'],
      ['31999998888', '+5531999998888'],
      ['31 9 9999 8888', '+5531999998888'],
      ['031 99999-8888', '+5531999998888'],
      ['+55 (31) 99999-8888', '+5531999998888'],
      ['5531999998888', '+5531999998888'],
      ['0055 31 99999-8888', '+5531999998888'],
      ['  (11) 98765.4321  ', '+5511987654321'],
    ])('normaliza celular %j para %s', (entrada, esperado) => {
      expect(normalizarTelefone(entrada)).toEqual({ ok: true, e164: esperado });
    });

    it.each([
      ['(31) 3333-4444', '+553133334444'],
      ['553133334444', '+553133334444'],
      ['(11) 2345-6789', '+551123456789'],
    ])('aceita fixo %j (WhatsApp Business) como %s', (entrada, esperado) => {
      expect(normalizarTelefone(entrada)).toEqual({ ok: true, e164: esperado });
    });

    it('trata número de 11 dígitos com DDD 55 como nacional, não como DDI', () => {
      expect(normalizarTelefone('(55) 99999-8888')).toEqual({ ok: true, e164: '+5555999998888' });
    });

    it.each(['(20) 99999-8888', '(10) 3333-4444', '+55 (30) 99999-8888'])(
      'rejeita DDD inexistente em %j',
      (entrada) => {
        expect(normalizarTelefone(entrada)).toEqual({ ok: false, erro: 'ddd_invalido' });
      },
    );

    it.each([
      ['celular no formato antigo, sem o 9', '(31) 9999-8888'],
      ['celular de 9 dígitos que não começa com 9', '(31) 89999-8888'],
      ['fixo que começa com 1', '(31) 1333-4444'],
      ['fixo que começa com 6', '(31) 6333-4444'],
      ['número curto demais', '9999-8888'],
      ['número longo demais', '(31) 99999-88887'],
    ])('rejeita %s', (_caso, entrada) => {
      expect(normalizarTelefone(entrada)).toEqual({ ok: false, erro: 'telefone_invalido' });
    });
  });

  describe('números estrangeiros (com + ou 00)', () => {
    it.each([
      ['+351 912 345 678', '+351912345678'],
      ['+1 (415) 555-2671', '+14155552671'],
      ['00351912345678', '+351912345678'],
    ])('normaliza %j para %s', (entrada, esperado) => {
      expect(normalizarTelefone(entrada)).toEqual({ ok: true, e164: esperado });
    });

    it.each([
      ['DDI começando com 0', '+0 912 345 678'],
      ['menos de 8 dígitos', '+351 1234'],
      ['mais de 15 dígitos', '+351 9123 4567 8901 23'],
    ])('rejeita %s', (_caso, entrada) => {
      expect(normalizarTelefone(entrada)).toEqual({ ok: false, erro: 'telefone_invalido' });
    });

    it('valida números com +55 pelas regras brasileiras', () => {
      expect(normalizarTelefone('+55 31 9999-8888')).toEqual({
        ok: false,
        erro: 'telefone_invalido',
      });
    });
  });

  describe('entradas malformadas', () => {
    it.each([
      ['vazio', ''],
      ['só espaços', '   '],
      ['letras', '(31) 9999A-8888'],
      ['+ no meio', '31 +99999-8888'],
      ['dois +', '++55 31 99999-8888'],
      ['sem dígitos', '()-'],
    ])('rejeita entrada %s', (_caso, entrada) => {
      expect(normalizarTelefone(entrada)).toEqual({ ok: false, erro: 'telefone_invalido' });
    });
  });
});
