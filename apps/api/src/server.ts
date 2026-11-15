import { randomBytes } from 'node:crypto';
import { relogioSistema } from '@convergia/core/base';
import { criarCalendarioGoogle } from './adapters/calendario/google.js';
import { criarWhatsappMegaApi } from './adapters/mensageria/megaapi.js';
import { criarEmailResend } from './adapters/mensageria/resend.js';
import { criarWhatsappMeta, lerMapaDeTemplates } from './adapters/mensageria/whatsapp-meta.js';
import { criarRoteadorMensageria } from './adapters/mensageria/roteador.js';
import { construirApp } from './app.js';
import { sessaoDeDesenvolvimento } from './base/auth.js';
import { criarBarramentoEmMemoria } from './base/eventos.js';
import { configHttpDoEnv } from './base/http/index.js';
import { criarPrisma } from './base/prisma.js';
import { carregarEnv } from './config/env.js';
import { criarProvedorGoogle } from './modulos/auth/provedor-google.js';
import { resolvedorSessaoCookie } from './modulos/auth/sessoes.js';

const env = carregarEnv();
const prisma = criarPrisma(env.DATABASE_URL);

const app = construirApp(env, {
  prisma,
  eventos: criarBarramentoEmMemoria((erro, evento) => {
    app.log.error({ err: erro, evento: evento.tipo }, 'falha ao tratar evento');
  }),
  // Canal sem credencial: as mensagens ficam pendentes e saem quando configurar (S5-2).
  mensageria: criarRoteadorMensageria({
    whatsapp:
      env.WHATSAPP_PROVEDOR === 'meta'
        ? env.META_WHATSAPP_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID
          ? criarWhatsappMeta({
              token: env.META_WHATSAPP_TOKEN,
              phoneNumberId: env.META_WHATSAPP_PHONE_NUMBER_ID,
              versaoApi: env.META_WHATSAPP_API_VERSION,
              idioma: env.META_WHATSAPP_IDIOMA,
              templates: lerMapaDeTemplates(env.META_WHATSAPP_TEMPLATES),
              templatePadrao: env.META_WHATSAPP_TEMPLATE_PADRAO,
            })
          : null
        : env.MEGAAPI_HOST && env.MEGAAPI_INSTANCE_KEY && env.MEGAAPI_TOKEN
          ? criarWhatsappMegaApi({
              host: env.MEGAAPI_HOST,
              instanceKey: env.MEGAAPI_INSTANCE_KEY,
              token: env.MEGAAPI_TOKEN,
            })
          : null,
    email:
      env.RESEND_API_KEY && env.EMAIL_REMETENTE
        ? criarEmailResend({
            apiKey: env.RESEND_API_KEY,
            remetente: env.EMAIL_REMETENTE,
            assuntoPadrao: env.EMAIL_ASSUNTO_PADRAO,
          })
        : null,
  }),
  // Sem o token de renovação do Google, os agendamentos ficam pendentes no calendário (RN-67).
  calendario:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALENDAR_REFRESH_TOKEN
      ? criarCalendarioGoogle({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          refreshToken: env.GOOGLE_CALENDAR_REFRESH_TOKEN,
          ...(env.GOOGLE_CALENDAR_ID ? { calendarioId: env.GOOGLE_CALENDAR_ID } : {}),
        })
      : null,
  relogio: relogioSistema,
  chaveLink: env.LINK_CHAVE_CIFRA ? Buffer.from(env.LINK_CHAVE_CIFRA, 'base64') : null,
  resolverSessao: env.AUTH_DEV_USUARIO_EMAIL
    ? sessaoDeDesenvolvimento(prisma, env.AUTH_DEV_USUARIO_EMAIL)
    : resolvedorSessaoCookie(prisma, relogioSistema),
  auth: {
    // Em desenvolvimento, sem SESSAO_SEGREDO, um segredo aleatório por execução basta
    // (só assina o cookie de 10 min do fluxo OAuth). Em produção é obrigatório (carregarEnv).
    segredoCookie: env.SESSAO_SEGREDO ?? randomBytes(32).toString('hex'),
    urlApp: env.APP_URL,
    duracaoSessaoHoras: env.SESSAO_DURACAO_HORAS,
    identidade:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? criarProvedorGoogle({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            urlRetorno: `${env.APP_URL}/api/auth/google/callback`,
          })
        : null,
  },
  http: configHttpDoEnv(env),
  webhookWhatsapp:
    env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN && env.META_APP_SECRET
      ? { verifyToken: env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN, appSecret: env.META_APP_SECRET }
      : null,
});

if (!env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
  app.log.warn('Google Calendar não configurado: os agendamentos ficam pendentes no calendário');
}

const whatsappSemCredencial =
  env.WHATSAPP_PROVEDOR === 'meta' ? !env.META_WHATSAPP_TOKEN : !env.MEGAAPI_TOKEN;
if (whatsappSemCredencial || !env.RESEND_API_KEY) {
  app.log.warn('WhatsApp ou e-mail sem credenciais: as mensagens desse canal ficam pendentes');
}

if (!env.LINK_CHAVE_CIFRA) {
  app.log.warn(
    'LINK_CHAVE_CIFRA não configurada: lembretes e reenvios sem o link do cliente não saem',
  );
}

if (env.AUTH_DEV_USUARIO_EMAIL) {
  app.log.warn(`Sessão de desenvolvimento ativa: todos entram como ${env.AUTH_DEV_USUARIO_EMAIL}`);
}

const encerrar = async (): Promise<void> => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void encerrar());
process.on('SIGINT', () => void encerrar());

await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
