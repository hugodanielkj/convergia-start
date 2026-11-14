import { afterAll, describe, expect, it } from 'vitest';
import { construirApp } from './app.js';

describe('GET /health', () => {
  const app = construirApp({ LOG_LEVEL: 'silent' });
  afterAll(() => app.close());

  it('responde ok com o fuso padrão', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok', fuso: 'America/Sao_Paulo' });
  });
});
