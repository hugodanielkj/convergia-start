import { describe, expect, it } from 'vitest';
import { carregarEnv } from './env.js';

const DATABASE_URL = 'postgresql://u:s@localhost:5432/db';

describe('carregarEnv', () => {
  it('aplica valores padrão', () => {
    expect(carregarEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3333,
      LOG_LEVEL: 'info',
      DATABASE_URL,
      APP_URL: 'http://localhost:3000',
      SESSAO_DURACAO_HORAS: 168,
      ARMAZENAMENTO_DIR: '.armazenamento',
    });
  });

  it('exige SESSAO_SEGREDO em produção', () => {
    expect(() => carregarEnv({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(/SESSAO_SEGREDO/);
  });

  it('exige as duas credenciais do Google juntas', () => {
    expect(() => carregarEnv({ DATABASE_URL, GOOGLE_CLIENT_ID: 'id' })).toThrow(
      /GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET/,
    );
  });

  it('o calendário do Google precisa das credenciais do app e é opcional sem elas', () => {
    expect(carregarEnv({ DATABASE_URL }).GOOGLE_CALENDAR_REFRESH_TOKEN).toBeUndefined();
    expect(() => carregarEnv({ DATABASE_URL, GOOGLE_CALENDAR_REFRESH_TOKEN: 'token' })).toThrow(
      /GOOGLE_CALENDAR_REFRESH_TOKEN precisa/,
    );
    const env = carregarEnv({
      DATABASE_URL,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'segredo',
      GOOGLE_CALENDAR_REFRESH_TOKEN: 'token',
      GOOGLE_CALENDAR_ID: '',
    });
    expect(env.GOOGLE_CALENDAR_REFRESH_TOKEN).toBe('token');
    expect(env.GOOGLE_CALENDAR_ID).toBeUndefined();
  });

  it('converte a porta para número', () => {
    expect(carregarEnv({ DATABASE_URL, API_PORT: '8080' }).API_PORT).toBe(8080);
  });

  it('trata AUTH_DEV_USUARIO_EMAIL vazio como ausente', () => {
    expect(carregarEnv({ DATABASE_URL, AUTH_DEV_USUARIO_EMAIL: '' }).AUTH_DEV_USUARIO_EMAIL).toBe(
      undefined,
    );
  });

  it('exige DATABASE_URL', () => {
    expect(() => carregarEnv({})).toThrow(/DATABASE_URL/);
  });

  it('proíbe usuário de desenvolvimento em produção', () => {
    expect(() =>
      carregarEnv({ DATABASE_URL, NODE_ENV: 'production', AUTH_DEV_USUARIO_EMAIL: 'a@b.com' }),
    ).toThrow(/proibido em produção/);
  });
});
