import { cookies } from 'next/headers';
import { URL_API } from '../../_lib/url-api';
import { criarClienteApi, type ClienteApi } from './api';

/** Cliente da API para Server Components e Server Actions. Repassa o cookie de sessão do usuário. */
export async function clienteApiDoServidor(): Promise<ClienteApi> {
  const cookie = (await cookies()).toString();
  return criarClienteApi({
    baseUrl: URL_API,
    fetcher: fetch,
    ...(cookie ? { cabecalhos: { cookie } } : {}),
  });
}
