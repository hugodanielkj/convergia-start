import { describe, expect, it } from 'vitest';
import { carregarEnv } from './env.js';

describe('carregarEnv', () => {
  it('aplica valores padrão', () => {
    expect(carregarEnv({})).toEqual({ NODE_ENV: 'development', API_PORT: 3333, LOG_LEVEL: 'info' });
  });

  it('converte a porta para número', () => {
    expect(carregarEnv({ API_PORT: '8080' }).API_PORT).toBe(8080);
  });

  it('falha com valor inválido', () => {
    expect(() => carregarEnv({ NODE_ENV: 'qualquer' })).toThrow(/Variáveis de ambiente inválidas/);
  });
});
