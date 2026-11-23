'use server';

import { revalidatePath } from 'next/cache';
import {
  processarBloqueio,
  processarExcecao,
  type EstadoExcecao,
  processarJanela,
  processarRemocao,
  type EstadoBloqueio,
  type EstadoJanela,
  type EstadoRemocao,
} from './processar';
import { agendaApiDoServidor } from './servidor';

const CAMINHO = '/config/agenda';

export async function salvarJanelaAction(
  _anterior: EstadoJanela,
  dados: FormData,
): Promise<EstadoJanela> {
  const estado = await processarJanela(dados, await agendaApiDoServidor());
  // Mesmo em erro parcial alguns dias já foram gravados, então a lista sempre atualiza.
  revalidatePath(CAMINHO);
  return estado;
}

export async function salvarBloqueioAction(
  _anterior: EstadoBloqueio,
  dados: FormData,
): Promise<EstadoBloqueio> {
  const estado = await processarBloqueio(dados, await agendaApiDoServidor());
  if (estado.tipo === 'salvo') revalidatePath(CAMINHO);
  return estado;
}

export async function removerItemAction(
  _anterior: EstadoRemocao,
  dados: FormData,
): Promise<EstadoRemocao> {
  const estado = await processarRemocao(dados, await agendaApiDoServidor());
  if (estado.tipo === 'inicial') revalidatePath(CAMINHO);
  return estado;
}

export async function salvarExcecaoAction(
  _anterior: EstadoExcecao,
  dados: FormData,
): Promise<EstadoExcecao> {
  const estado = await processarExcecao(dados, await agendaApiDoServidor());
  if (estado.tipo === 'salva') revalidatePath(CAMINHO);
  return estado;
}
