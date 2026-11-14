import { ProibidoError } from '@convergia/core/base';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SITES_ACEITOS = new Set(['same-origin', 'none']);

const cabecalho = (request: FastifyRequest, nome: string): string | undefined => {
  const valor = request.headers[nome];
  return Array.isArray(valor) ? valor[0] : valor;
};

/**
 * Mutação vinda de navegador só da própria web (RN-76). O navegador sempre manda `Origin` e/ou
 * `Sec-Fetch-Site` em POST/PUT/PATCH/DELETE, e uma página não consegue forjá-los. Sem nenhum dos
 * dois não é navegador (chamada do servidor da web, testes) e não há CSRF possível.
 */
export function mesmaOrigem(request: FastifyRequest, origemApp: string): boolean {
  if (METODOS_SEGUROS.has(request.method)) return true;
  const site = cabecalho(request, 'sec-fetch-site');
  if (site !== undefined && !SITES_ACEITOS.has(site)) return false;
  const origem = cabecalho(request, 'origin');
  return origem === undefined || origem === origemApp;
}

export function registrarCsrf(app: FastifyInstance, urlApp: string): void {
  const origemApp = new URL(urlApp).origin;
  app.addHook('onRequest', async (request) => {
    if (!mesmaOrigem(request, origemApp)) throw new ProibidoError('RN-76');
  });
}
