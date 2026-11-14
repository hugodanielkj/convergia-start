import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { pluginAuth } from './base/auth.js';
import type { Dependencias } from './base/dependencias.js';
import { registrarTratamentoDeErros } from './base/erros.js';
import { registrarModulos } from './base/modulos.js';
import type { Env } from './config/env.js';

export function construirApp(env: Pick<Env, 'LOG_LEVEL'>, deps: Dependencias): FastifyInstance {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  app.decorate('deps', deps);
  registrarTratamentoDeErros(app);
  void app.register(pluginAuth);
  registrarModulos(app, join(import.meta.dirname, 'modulos'));

  return app;
}
