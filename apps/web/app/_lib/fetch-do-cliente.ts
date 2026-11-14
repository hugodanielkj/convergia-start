import { headers } from 'next/headers';

/**
 * `fetch` do servidor da web para as rotas públicas da API, repassando o `X-Forwarded-For` do
 * cliente. Sem isso, a API veria todas as páginas vindo do mesmo IP (o da web) e não conseguiria
 * limitar por cliente (RN-76).
 */
export async function fetchDoCliente(
  entrada: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const ipCliente = (await headers()).get('x-forwarded-for');
  const cabecalhos = new Headers(init.headers);
  if (ipCliente) cabecalhos.set('x-forwarded-for', ipCliente);
  return fetch(entrada, { ...init, headers: cabecalhos });
}
