import type { Mensageria, Relogio } from '@convergia/core/base';
import type { Calendario } from '@convergia/core/calendario';
import type { ConfigAuth, ResolvedorSessao } from './auth.js';
import type { BarramentoEventos } from './eventos.js';
import type { ConfigHttp } from './http/index.js';
import type { PrismaClient } from './prisma.js';

/** Dependências injetadas na API. Módulos acessam por `app.deps`. Testes trocam por fakes. */
export interface Dependencias {
  prisma: PrismaClient;
  eventos: BarramentoEventos;
  mensageria: Mensageria;
  /** Calendário externo da agência (RN-67); `null` quando não há credenciais e os agendamentos ficam pendentes. */
  calendario: Calendario | null;
  relogio: Relogio;
  /** Chave do link cifrado (`LINK_CHAVE_CIFRA`); `null` = o link só aparece na criação (D-13). */
  chaveLink: Uint8Array | null;
  resolverSessao: ResolvedorSessao;
  auth: ConfigAuth;
  /** Proxy confiável, HSTS e limites das rotas públicas (RN-76). */
  http: ConfigHttp;
  /** Webhook do WhatsApp oficial (RN-61); ausente = rota não é registrada. */
  webhookWhatsapp?: { verifyToken: string; appSecret: string } | null;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Dependencias;
  }
}
