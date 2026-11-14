import { describe, expect, it } from 'vitest';
import { mascararTokens, serializarRequisicao } from './logs.js';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12';

describe('RN-10 token do link fora dos logs', () => {
  it.each([
    [`/publico/onboardings/${TOKEN}`, '/publico/onboardings/:token'],
    [`/o/${TOKEN}`, '/o/:token'],
    [`/publico/lembretes/${TOKEN}/parar`, '/publico/lembretes/:token/parar'],
    [`/parar-lembretes/${TOKEN}`, '/parar-lembretes/:token'],
    [`/o/${TOKEN}/expirado`, '/o/:token/expirado'],
    [`/o/${TOKEN}?origem=email`, '/o/:token?origem=email'],
    [
      `/publico/onboardings/${TOKEN}/solicitar-novo-link`,
      '/publico/onboardings/:token/solicitar-novo-link',
    ],
  ])('mascara o token em %s', (url, esperado) => {
    expect(mascararTokens(url)).toBe(esperado);
  });

  it.each(['/health', '/clientes', '/clientes/123/onboardings', '/onboardings/abc/link/regenerar'])(
    'não altera rotas sem token: %s',
    (url) => {
      expect(mascararTokens(url)).toBe(url);
    },
  );

  it('mascara também token malformado, pois qualquer coisa nessa posição é credencial', () => {
    expect(mascararTokens('/o/qualquer-coisa-aqui')).toBe('/o/:token');
  });

  it('o serializador de requisição só deixa método, URL mascarada e IP', () => {
    const requisicao = {
      method: 'GET',
      url: `/publico/onboardings/${TOKEN}`,
      headers: { cookie: 'segredo' },
      ip: '10.0.0.1',
    };
    expect(serializarRequisicao(requisicao)).toEqual({
      method: 'GET',
      url: '/publico/onboardings/:token',
      remoteAddress: '10.0.0.1',
    });
  });
});
