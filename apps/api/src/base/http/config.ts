import type { ContadorJanela } from './contador-janela.js';

/** Limites das rotas públicas do link (RN-76). Zero desliga aquele contador. */
export interface LimitesPublicos {
  /** Janela dos limites por IP e por token. */
  readonly janelaMs: number;
  readonly porIp: number;
  readonly porToken: number;
  /** Respostas 404 (token errado) por IP antes do bloqueio temporário. */
  readonly tokensInvalidosPorIp: number;
  /** Janela da contagem de tokens errados; é também a duração do bloqueio. */
  readonly janelaTokensInvalidosMs: number;
}

export interface ConfigHttp {
  /** `trustProxy` do Fastify: de quem aceitar o `X-Forwarded-For`. */
  readonly confiarProxy: string | boolean;
  /** HSTS só em produção (HTTPS). */
  readonly hsts: boolean;
  /** `null` desliga o limite (testes de outros módulos). */
  readonly limites: LimitesPublicos | null;
  /** Padrão: em memória. */
  readonly contador?: ContadorJanela;
}

export interface EnvHttp {
  NODE_ENV: 'development' | 'test' | 'production';
  CONFIAR_PROXY: string;
  LIMITE_JANELA_SEGUNDOS: number;
  LIMITE_PUBLICO_POR_IP: number;
  LIMITE_PUBLICO_POR_TOKEN: number;
  LIMITE_TOKENS_INVALIDOS_POR_IP: number;
  LIMITE_BLOQUEIO_MINUTOS: number;
}

export function configHttpDoEnv(env: EnvHttp): ConfigHttp {
  return {
    confiarProxy: env.CONFIAR_PROXY === 'nenhum' ? false : env.CONFIAR_PROXY,
    hsts: env.NODE_ENV === 'production',
    limites: {
      janelaMs: env.LIMITE_JANELA_SEGUNDOS * 1000,
      porIp: env.LIMITE_PUBLICO_POR_IP,
      porToken: env.LIMITE_PUBLICO_POR_TOKEN,
      tokensInvalidosPorIp: env.LIMITE_TOKENS_INVALIDOS_POR_IP,
      janelaTokensInvalidosMs: env.LIMITE_BLOQUEIO_MINUTOS * 60_000,
    },
  };
}
