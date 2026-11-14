'use server';

import { revalidatePath } from 'next/cache';
import {
  processarCadastro,
  processarNovoLink,
  type EstadoCadastro,
  type EstadoLink,
} from './processar';
import { clienteApiDoServidor } from './servidor';

export async function cadastrarClienteAction(
  _anterior: EstadoCadastro,
  dados: FormData,
): Promise<EstadoCadastro> {
  const estado = await processarCadastro(dados, await clienteApiDoServidor());
  if (estado.tipo === 'criado') revalidatePath('/clientes');
  return estado;
}

export async function gerarNovoLinkAction(
  _anterior: EstadoLink,
  dados: FormData,
): Promise<EstadoLink> {
  return processarNovoLink(dados, await clienteApiDoServidor());
}
