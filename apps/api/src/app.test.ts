import { afterAll, describe, expect, it } from 'vitest';
import { construirApp } from './app.js';
import { dependenciasDeTeste } from './testes/dependencias.js';

describe('GET /health (módulo carregado por autoload)', () => {
  const app = construirApp({ LOG_LEVEL: 'silent' }, dependenciasDeTeste());
  afterAll(() => app.close());

  it('responde ok com o fuso padrão', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok', fuso: 'America/Sao_Paulo' });
  });
});

describe('RN-76 proteções HTTP ligadas no app', () => {
  const app = construirApp({ LOG_LEVEL: 'silent' }, dependenciasDeTeste());
  afterAll(() => app.close());

  it('responde com os cabeçalhos de segurança', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.headers['x-frame-options']).toBe('DENY');
    expect(resposta.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('recusa mutação de outra origem antes de chegar ao módulo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/auth/sair',
      headers: { origin: 'https://site-malicioso.example' },
    });

    expect(resposta.statusCode).toBe(403);
  });
});
