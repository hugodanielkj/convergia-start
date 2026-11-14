import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import { criarAgendaApi, type AgendaApi } from './api';

/** Cliente da API de agenda para Server Components e Server Actions; repassa o cookie de sessão. */
export async function agendaApiDoServidor(): Promise<AgendaApi> {
  const cookie = (await cookies()).toString();
  return criarAgendaApi({
    baseUrl: URL_API,
    fetcher: fetch,
    ...(cookie ? { cabecalhos: { cookie } } : {}),
  });
}
