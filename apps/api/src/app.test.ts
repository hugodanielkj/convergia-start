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
