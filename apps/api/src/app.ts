import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { pluginAuth } from './base/auth.js';
import type { Dependencias } from './base/dependencias.js';
import { registrarTratamentoDeErros } from './base/erros.js';
import { pluginHttp } from './base/http/index.js';
import { serializarRequisicao } from './base/logs.js';
import { registrarModulos } from './base/modulos.js';
import type { Env } from './config/env.js';

export function construirApp(env: Pick<Env, 'LOG_LEVEL'>, deps: Dependencias): FastifyInstance {
  const app = Fastify({
    // IP real do cliente pelo X-Forwarded-For, só vindo de proxy confiável (RN-76).
    trustProxy: deps.http.confiarProxy,
    logger: { level: env.LOG_LEVEL, serializers: { req: serializarRequisicao } },
  });

  app.decorate('deps', deps);
  registrarTratamentoDeErros(app);
  void app.register(pluginHttp, { http: deps.http, urlApp: deps.auth.urlApp });
  void app.register(fastifyCookie, { secret: deps.auth.segredoCookie });
  void app.register(pluginAuth);
  registrarModulos(app, join(import.meta.dirname, 'modulos'));

  return app;
}
