'use server';

import { URL_API } from '../../../_lib/url-api';
import { pedirNovoLink, type EstadoPedido } from './pedir-novo-link';

export async function pedirNovoLinkAction(
  _anterior: EstadoPedido,
  dados: FormData,
): Promise<EstadoPedido> {
  const token = dados.get('token');
  if (typeof token !== 'string' || token === '') return { tipo: 'invalido' };
  return pedirNovoLink(token, { baseUrl: URL_API, fetcher: fetch });
}
