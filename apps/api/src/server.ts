import { relogioSistema } from '@convergia/core/base';
import { MensageriaEmMemoria } from './adapters/mensageria/em-memoria.js';
import { construirApp } from './app.js';
import { semSessao, sessaoDeDesenvolvimento } from './base/auth.js';
import { criarBarramentoEmMemoria } from './base/eventos.js';
import { criarPrisma } from './base/prisma.js';
import { carregarEnv } from './config/env.js';

const env = carregarEnv();
const prisma = criarPrisma(env.DATABASE_URL);

const app = construirApp(env, {
  prisma,
  eventos: criarBarramentoEmMemoria((erro, evento) => {
    app.log.error({ err: erro, evento: evento.tipo }, 'falha ao tratar evento');
  }),
  mensageria: new MensageriaEmMemoria(),
  relogio: relogioSistema,
  resolverSessao: env.AUTH_DEV_USUARIO_EMAIL
    ? sessaoDeDesenvolvimento(prisma, env.AUTH_DEV_USUARIO_EMAIL)
    : semSessao,
});

const encerrar = async (): Promise<void> => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void encerrar());
process.on('SIGINT', () => void encerrar());

await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
