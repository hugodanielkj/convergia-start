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
    GOOGLE_CALENDAR_REFRESH_TOKEN: z.preprocess(vazioParaIndefinido, z.string().optional()),
    GOOGLE_CALENDAR_ID: z.preprocess(vazioParaIndefinido, z.string().optional()),
    SESSAO_SEGREDO: z.preprocess(vazioParaIndefinido, z.string().min(32).optional()),
    SESSAO_DURACAO_HORAS: z.coerce.number().int().positive().default(168),
    // WhatsApp pela MegaAPI (D-07); sem as três, o WhatsApp fica pendente (S5-2).
    MEGAAPI_HOST: z.preprocess(vazioParaIndefinido, z.string().optional()),
    MEGAAPI_INSTANCE_KEY: z.preprocess(vazioParaIndefinido, z.string().optional()),
    MEGAAPI_TOKEN: z.preprocess(vazioParaIndefinido, z.string().optional()),
    // Provedor de WhatsApp (D-07): "megaapi" (padrão) ou "meta" (API oficial, Cloud API).
    WHATSAPP_PROVEDOR: z.enum(['megaapi', 'meta']).default('megaapi'),
    META_WHATSAPP_TOKEN: z.preprocess(vazioParaIndefinido, z.string().optional()),
    META_WHATSAPP_PHONE_NUMBER_ID: z.preprocess(vazioParaIndefinido, z.string().optional()),
    META_WHATSAPP_API_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/)
      .default('v21.0'),
    META_WHATSAPP_IDIOMA: z.string().min(2).default('pt_BR'),
    // "tipo=nome_do_template,..." (tipos do app → templates aprovados na Meta).
    META_WHATSAPP_TEMPLATES: z.preprocess(vazioParaIndefinido, z.string().optional()),
    META_WHATSAPP_TEMPLATE_PADRAO: z.preprocess(vazioParaIndefinido, z.string().optional()),
    // E-mail pelo Resend; sem chave e remetente, o e-mail fica pendente (S5-2).
    RESEND_API_KEY: z.preprocess(vazioParaIndefinido, z.string().optional()),
    EMAIL_REMETENTE: z.preprocess(vazioParaIndefinido, z.string().optional()),
    EMAIL_ASSUNTO_PADRAO: z.string().min(1).default('Seu onboarding'),
    // Proteções do link público (RN-76). CONFIAR_PROXY: de quem aceitar o X-Forwarded-For
    // (IPs, sub-redes ou loopback/linklocal/uniquelocal; "nenhum" desliga).
    CONFIAR_PROXY: z.string().min(1).default('loopback,linklocal,uniquelocal'),
    LIMITE_JANELA_SEGUNDOS: z.coerce.number().int().positive().default(60),
    LIMITE_PUBLICO_POR_IP: z.coerce.number().int().nonnegative().default(300),
    LIMITE_PUBLICO_POR_TOKEN: z.coerce.number().int().nonnegative().default(300),
    LIMITE_TOKENS_INVALIDOS_POR_IP: z.coerce.number().int().nonnegative().default(20),
    LIMITE_BLOQUEIO_MINUTOS: z.coerce.number().int().positive().default(15),
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
    (env) => env.GOOGLE_CALENDAR_REFRESH_TOKEN === undefined || env.GOOGLE_CLIENT_ID !== undefined,
    {
      message: 'GOOGLE_CALENDAR_REFRESH_TOKEN precisa de GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET',
      path: ['GOOGLE_CALENDAR_REFRESH_TOKEN'],
    },
  )
  .refine(
    (env) => (env.GOOGLE_CLIENT_ID === undefined) === (env.GOOGLE_CLIENT_SECRET === undefined),
    {
      message: 'Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos',
      path: ['GOOGLE_CLIENT_SECRET'],
    },
  )

  .refine(
    (env) =>
      new Set([env.MEGAAPI_HOST, env.MEGAAPI_INSTANCE_KEY, env.MEGAAPI_TOKEN].map(Boolean)).size ===
      1,
    {
      message: 'Defina MEGAAPI_HOST, MEGAAPI_INSTANCE_KEY e MEGAAPI_TOKEN juntos',
      path: ['MEGAAPI_TOKEN'],
    },
  )
  .refine(
    (env) =>
      (env.META_WHATSAPP_TOKEN === undefined) === (env.META_WHATSAPP_PHONE_NUMBER_ID === undefined),
    {
      message: 'Defina META_WHATSAPP_TOKEN e META_WHATSAPP_PHONE_NUMBER_ID juntos',
      path: ['META_WHATSAPP_PHONE_NUMBER_ID'],
    },
  )
  .refine((env) => (env.RESEND_API_KEY === undefined) === (env.EMAIL_REMETENTE === undefined), {
    message: 'Defina RESEND_API_KEY e EMAIL_REMETENTE juntos',
    path: ['EMAIL_REMETENTE'],
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
