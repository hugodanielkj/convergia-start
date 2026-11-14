import { describe, expect, it } from 'vitest';
import { normalizarEmail } from './email.js';

describe('RN-05 validação de e-mail', () => {
  it.each([
    ['contato@padaria.com.br', 'contato@padaria.com.br'],
    ['  Maria.Silva@Empresa.COM ', 'maria.silva@empresa.com'],
    ['joao+onboarding@gmail.com', 'joao+onboarding@gmail.com'],
    ["o'neil_2@sub.dominio-x.io", "o'neil_2@sub.dominio-x.io"],
    ['a@b.co', 'a@b.co'],
    ['loja@xn--padaria-so-joo-gnb.com.br', 'loja@xn--padaria-so-joo-gnb.com.br'],
  ])('aceita %j e normaliza para %j', (entrada, esperado) => {
    expect(normalizarEmail(entrada)).toEqual({ ok: true, email: esperado });
  });

  it.each([
    ['vazio', ''],
    ['sem @', 'contato.padaria.com'],
    ['dois @', 'contato@@padaria.com'],
    ['sem parte local', '@padaria.com'],
    ['sem domínio', 'contato@'],
    ['domínio sem ponto', 'contato@localhost'],
    ['ponto no início', '.contato@padaria.com'],
    ['ponto no fim da parte local', 'contato.@padaria.com'],
    ['pontos seguidos', 'con..tato@padaria.com'],
    ['espaço no meio', 'con tato@padaria.com'],
    ['acento na parte local', 'joão@padaria.com'],
    ['hífen no início do rótulo', 'contato@-padaria.com'],
    ['hífen no fim do rótulo', 'contato@padaria-.com'],
    ['rótulo vazio', 'contato@padaria..com'],
    ['TLD de uma letra', 'contato@padaria.c'],
    ['TLD numérico', 'contato@padaria.123'],
    ['vírgula no lugar do ponto', 'contato@padaria,com'],
  ])('rejeita e-mail %s', (_caso, entrada) => {
    expect(normalizarEmail(entrada)).toEqual({ ok: false, erro: 'email_invalido' });
  });

  it('rejeita parte local com mais de 64 caracteres', () => {
    expect(normalizarEmail(`${'a'.repeat(65)}@padaria.com`)).toEqual({
      ok: false,
      erro: 'email_invalido',
    });
  });

  it('aceita parte local com exatamente 64 caracteres', () => {
    const email = `${'a'.repeat(64)}@padaria.com`;
    expect(normalizarEmail(email)).toEqual({ ok: true, email });
  });

  it('rejeita rótulo de domínio com mais de 63 caracteres', () => {
    expect(normalizarEmail(`contato@${'a'.repeat(64)}.com`)).toEqual({
      ok: false,
      erro: 'email_invalido',
    });
  });

  it('rejeita endereço com mais de 254 caracteres', () => {
    const dominio = `${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.com`;
    expect(normalizarEmail(`contato@${dominio}`)).toEqual({ ok: false, erro: 'email_invalido' });
  });
});
