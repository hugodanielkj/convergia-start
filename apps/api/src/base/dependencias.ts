import type { Mensageria, Relogio } from '@convergia/core/base';
import type { Calendario } from '@convergia/core/calendario';
import type { Armazenamento } from '@convergia/core/uploads';
import type { ConfigAuth, ResolvedorSessao } from './auth.js';
import type { BarramentoEventos } from './eventos.js';
import type { PrismaClient } from './prisma.js';

/** Dependências injetadas na API. Módulos acessam por `app.deps`. Testes trocam por fakes. */
export interface Dependencias {
  prisma: PrismaClient;
  eventos: BarramentoEventos;
  armazenamento: Armazenamento;
  mensageria: Mensageria;
  /** Calendário externo da agência (RN-67); `null` quando não há credenciais e os agendamentos ficam pendentes. */
  calendario: Calendario | null;
  relogio: Relogio;
  resolverSessao: ResolvedorSessao;
  auth: ConfigAuth;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Dependencias;
  }
}
