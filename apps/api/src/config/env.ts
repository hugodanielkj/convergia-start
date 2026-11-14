import { z } from 'zod';

const vazioParaIndefinido = (valor: unknown) => (valor === '' ? undefined : valor);

const esquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3333),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url(),
    AUTH_DEV_USUARIO_EMAIL: z.preprocess(vazioParaIndefinido, z.email().optional()),
    APP_URL: z.url().default('http://localhost:3000'),
    GOOGLE_CLIENT_ID: z.preprocess(vazioParaIndefinido, z.string().optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess(vazioParaIndefinido, z.string().optional()),
    SESSAO_SEGREDO: z.preprocess(vazioParaIndefinido, z.string().min(32).optional()),
    SESSAO_DURACAO_HORAS: z.coerce.number().int().positive().default(168),
    ARMAZENAMENTO_DIR: z.string().min(1).default('.armazenamento'),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.AUTH_DEV_USUARIO_EMAIL === undefined, {
    message: 'AUTH_DEV_USUARIO_EMAIL é proibido em produção',
    path: ['AUTH_DEV_USUARIO_EMAIL'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.SESSAO_SEGREDO !== undefined, {
    message: 'SESSAO_SEGREDO é obrigatório em produção',
    path: ['SESSAO_SEGREDO'],
  })
  .refine(
    (env) => (env.GOOGLE_CLIENT_ID === undefined) === (env.GOOGLE_CLIENT_SECRET === undefined),
    {
      message: 'Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos',
      path: ['GOOGLE_CLIENT_SECRET'],
    },
  );

export type Env = z.infer<typeof esquemaEnv>;

/** Lê e valida as variáveis de ambiente; falha cedo se algo estiver inválido. */
export function carregarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const resultado = esquemaEnv.safeParse(fonte);
  if (!resultado.success) {
    throw new Error(`Variáveis de ambiente inválidas: ${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
