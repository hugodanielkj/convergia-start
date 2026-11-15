import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { registrarCabecalhos } from './cabecalhos.js';
import type { ConfigHttp } from './config.js';
import { ContadorEmMemoria } from './contador-janela.js';
import { registrarCsrf } from './csrf.js';
import { registrarLimitePublico } from './limite-publico.js';

export interface OpcoesHttp {
  readonly http: ConfigHttp;
  readonly urlApp: string;
  readonly agora?: () => number;
}

/**
 * Proteções HTTP de toda a API (RN-76): cabeçalhos, CSRF e limite das rotas públicas.
 * Registre antes do login, para uma requisição recusada não chegar a consultar a sessão no banco.
 */
export const pluginHttp = fp(
  (app: FastifyInstance, opcoes: OpcoesHttp) => {
    const agora = opcoes.agora ?? Date.now;
    registrarCabecalhos(app, opcoes.http.hsts);
    if (opcoes.http.limites) {
      const contador = opcoes.http.contador ?? new ContadorEmMemoria(agora);
      registrarLimitePublico(app, opcoes.http.limites, contador, agora);
    }
    registrarCsrf(app, opcoes.urlApp);
    return Promise.resolve();
  },
  { name: 'http' },
);

export type { ConfigHttp, LimitesPublicos } from './config.js';
export { configHttpDoEnv } from './config.js';
