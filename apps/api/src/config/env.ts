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
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.AUTH_DEV_USUARIO_EMAIL === undefined, {
    message: 'AUTH_DEV_USUARIO_EMAIL é proibido em produção',
    path: ['AUTH_DEV_USUARIO_EMAIL'],
  });

export type Env = z.infer<typeof esquemaEnv>;

/** Lê e valida as variáveis de ambiente; falha cedo se algo estiver inválido. */
export function carregarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const resultado = esquemaEnv.safeParse(fonte);
  if (!resultado.success) {
    throw new Error(`Variáveis de ambiente inválidas: ${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
