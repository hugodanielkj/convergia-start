import { describe, expect, it } from 'vitest';
import { configHttpDoEnv } from '../base/http/config.js';
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
      WHATSAPP_PROVEDOR: 'megaapi',
      META_WHATSAPP_API_VERSION: 'v21.0',
      META_WHATSAPP_IDIOMA: 'pt_BR',
      EMAIL_ASSUNTO_PADRAO: 'Seu onboarding',
      CONFIAR_PROXY: 'loopback,linklocal,uniquelocal',
      LIMITE_JANELA_SEGUNDOS: 60,
      LIMITE_PUBLICO_POR_IP: 300,
      LIMITE_PUBLICO_POR_TOKEN: 300,
      LIMITE_TOKENS_INVALIDOS_POR_IP: 20,
      LIMITE_BLOQUEIO_MINUTOS: 15,
    });
  });

  it('RN-76: limites do link e proxy confiável viram a configuração HTTP', () => {
    const env = carregarEnv({
      DATABASE_URL,
      NODE_ENV: 'production',
      SESSAO_SEGREDO: 's'.repeat(32),
      CONFIAR_PROXY: 'nenhum',
      LIMITE_PUBLICO_POR_IP: '0',
    });
    expect(configHttpDoEnv(env)).toEqual({
      confiarProxy: false,
      hsts: true,
      limites: {
        janelaMs: 60_000,
        porIp: 0,
        porToken: 300,
        tokensInvalidosPorIp: 20,
        janelaTokensInvalidosMs: 900_000,
      },
    });
  });

  it('credenciais da MegaAPI e do Resend vêm juntas ou não vêm (S5-2)', () => {
    expect(() => carregarEnv({ DATABASE_URL, MEGAAPI_TOKEN: 't' })).toThrow(/MEGAAPI_HOST/);
    expect(() => carregarEnv({ DATABASE_URL, RESEND_API_KEY: 'k' })).toThrow(/EMAIL_REMETENTE/);
    expect(
      carregarEnv({
        DATABASE_URL,
        MEGAAPI_HOST: 'h',
        MEGAAPI_INSTANCE_KEY: 'i',
        MEGAAPI_TOKEN: 't',
        RESEND_API_KEY: 'k',
        EMAIL_REMETENTE: 'Ag <a@ag.com>',
      }).MEGAAPI_TOKEN,
    ).toBe('t');
  });

  it('WhatsApp oficial: provedor padrão é megaapi e token e número vêm juntos (RN-71)', () => {
    expect(carregarEnv({ DATABASE_URL }).WHATSAPP_PROVEDOR).toBe('megaapi');
    expect(() => carregarEnv({ DATABASE_URL, META_WHATSAPP_TOKEN: 't' })).toThrow(
      /META_WHATSAPP_PHONE_NUMBER_ID/,
    );
    expect(() => carregarEnv({ DATABASE_URL, WHATSAPP_PROVEDOR: 'x' })).toThrow();
    const env = carregarEnv({
      DATABASE_URL,
      WHATSAPP_PROVEDOR: 'meta',
      META_WHATSAPP_TOKEN: 't',
      META_WHATSAPP_PHONE_NUMBER_ID: '1',
    });
    expect(env.META_WHATSAPP_API_VERSION).toBe('v21.0');
    expect(env.META_WHATSAPP_IDIOMA).toBe('pt_BR');
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
