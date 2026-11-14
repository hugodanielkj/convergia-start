'use server';

import { redirect } from 'next/navigation';
import { URL_API } from '../../../_lib/url-api';
import { aceitarTermo, type EstadoAceite } from './aceitar-termo';

export async function aceitarTermoAction(
  _anterior: EstadoAceite,
  dados: FormData,
): Promise<EstadoAceite> {
  const token = dados.get('token');
  const versao = dados.get('versao');
  if (typeof token !== 'string' || typeof versao !== 'string') {
    return { tipo: 'falha', mensagem: 'Não foi possível registrar agora.' };
  }
  const resultado = await aceitarTermo(token, versao, { baseUrl: URL_API, fetcher: fetch });
  if (resultado.tipo === 'aceito') redirect(`/o/${encodeURIComponent(token)}`);
  if (resultado.tipo === 'expirado') redirect(`/o/${encodeURIComponent(token)}/expirado`);
  return resultado;
}
