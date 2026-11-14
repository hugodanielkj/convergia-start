import Fastify, { type FastifyInstance } from 'fastify';
import { FUSO_PADRAO } from '@convergia/core';
import type { Env } from './config/env.js';

export function construirApp(env: Pick<Env, 'LOG_LEVEL'>): FastifyInstance {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  app.get('/health', () => ({ status: 'ok', fuso: FUSO_PADRAO }));

  return app;
}
