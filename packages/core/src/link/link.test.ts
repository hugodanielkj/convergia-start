import { describe, expect, it } from 'vitest';
import { relogioFixo } from '../base/relogio.js';
import {
  cifrarToken,
  decifrarToken,
  calcularExpiracao,
  gerarTokenLink,
  hashToken,
  TOKEN_BYTES,
  verificarLink,
  type GeradorBytes,
} from './index.js';

const bytesFixos =
  (valor: number): GeradorBytes =>
  (tamanho) =>
    new Uint8Array(tamanho).fill(valor);

describe('RN-10 token do link', () => {
  it('usa 256 bits aleatórios (D-13)', () => {
    expect(TOKEN_BYTES * 8).toBe(256);
  });

  it('gera token seguro para URL, sem preenchimento nem caracteres reservados', () => {
    const { token } = gerarTokenLink(bytesFixos(251));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('gera tokens diferentes a cada chamada com o gerador real', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => gerarTokenLink().token));
    expect(tokens.size).toBe(50);
  });

  it('guarda só o hash SHA-256 em hexadecimal, nunca o token', () => {
    const { token, hash } = gerarTokenLink(bytesFixos(7));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it('calcula SHA-256 conhecido (vetor de teste)', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('recusa gerador que devolve menos de 256 bits', () => {
    const fraco: GeradorBytes = () => new Uint8Array(16);
    expect(() => gerarTokenLink(fraco)).toThrow(/256 bits/);
  });
});

describe('RN-11 expiração do link', () => {
  const criadoEm = new Date('2026-11-13T15:30:00.000Z');

  it('expira após validade_link_dias, contados a partir da criação', () => {
    expect(calcularExpiracao(criadoEm, 14)).toEqual(new Date('2026-11-27T15:30:00.000Z'));
  });

  it('aceita validade de 1 dia', () => {
    expect(calcularExpiracao(criadoEm, 1)).toEqual(new Date('2026-11-14T15:30:00.000Z'));
  });

  it.each([0, -1, 1.5, Number.NaN])('rejeita validade %s', (dias) => {
    expect(() => calcularExpiracao(criadoEm, dias)).toThrow(/validade/);
  });

  it('não altera a data de criação recebida', () => {
    const original = new Date(criadoEm);
    calcularExpiracao(original, 14);
    expect(original).toEqual(criadoEm);
  });
});

describe('RN-11 e RN-12 verificação do link', () => {
  const { token, hash } = gerarTokenLink(bytesFixos(42));
  const expiraEm = new Date('2026-11-27T15:30:00.000Z');
  const registro = { hash, expiraEm };

  it('aceita token correto antes de expirar', () => {
    const agora = relogioFixo(new Date('2026-11-20T10:00:00.000Z')).agora();
    expect(verificarLink(token, registro, agora)).toBe('valido');
  });

  it('expira exatamente no instante limite', () => {
    expect(verificarLink(token, registro, new Date(expiraEm.getTime() - 1))).toBe('valido');
    expect(verificarLink(token, registro, new Date(expiraEm))).toBe('expirado');
  });

  it('informa expirado quando o token é o correto, para exibir a tela amigável', () => {
    const agora = new Date('2026-12-30T00:00:00.000Z');
    expect(verificarLink(token, registro, agora)).toBe('expirado');
  });

  it('trata token errado como inválido, sem revelar se o link expirou', () => {
    const outro = gerarTokenLink(bytesFixos(43)).token;
    const depoisDeExpirar = new Date('2026-12-30T00:00:00.000Z');
    expect(verificarLink(outro, registro, depoisDeExpirar)).toBe('invalido');
    expect(verificarLink(outro, registro, new Date('2026-11-20T00:00:00.000Z'))).toBe('invalido');
  });

  it.each(['', ' ', 'abc', 'x'.repeat(500)])('trata token malformado %j como inválido', (lixo) => {
    expect(verificarLink(lixo, registro, new Date('2026-11-20T00:00:00.000Z'))).toBe('invalido');
  });

  it('RN-12: ao regenerar, o token anterior deixa de valer na hora', () => {
    const agora = new Date('2026-11-20T00:00:00.000Z');
    const novo = gerarTokenLink(bytesFixos(99));
    const registroNovo = { hash: novo.hash, expiraEm: calcularExpiracao(agora, 14) };

    expect(verificarLink(token, registroNovo, agora)).toBe('invalido');
    expect(verificarLink(novo.token, registroNovo, agora)).toBe('valido');
  });

  it('rejeita hash guardado em formato inesperado', () => {
    const agora = new Date('2026-11-20T00:00:00.000Z');
    expect(verificarLink(token, { hash: 'nao-e-hash', expiraEm }, agora)).toBe('invalido');
  });
});

describe('link cifrado para os lembretes (decisão 2026-11-15-b-link-cifrado)', () => {
  const chave = new Uint8Array(32).fill(7);
  const { token } = gerarTokenLink();

  it('decifra o mesmo token com a mesma chave', () => {
    expect(decifrarToken(cifrarToken(token, chave), chave)).toBe(token);
  });

  it('gera um valor diferente a cada vez (IV aleatório) e nunca o token em claro', () => {
    const a = cifrarToken(token, chave);
    expect(a).not.toBe(cifrarToken(token, chave));
    expect(a).not.toContain(token);
  });

  it('com outra chave ou valor alterado não decifra', () => {
    const cifrado = cifrarToken(token, chave);
    expect(decifrarToken(cifrado, new Uint8Array(32).fill(8))).toBeNull();
    const alterado = `${cifrado.slice(0, -2)}${cifrado.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(decifrarToken(alterado, chave)).toBeNull();
    expect(decifrarToken('curto', chave)).toBeNull();
  });

  it('recusa chave com tamanho errado', () => {
    expect(() => cifrarToken(token, new Uint8Array(16))).toThrow();
  });
});
