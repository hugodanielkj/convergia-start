'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { aplicarPersonalizacao } from '../onboardings/[id]/personalizar/aplicar';
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
  const api = await clienteApiDoServidor();
  const criado: { onboardingId: string | null } = { onboardingId: null };
  const estado = await processarCadastro(dados, {
    ...api,
    // Guarda o onboarding criado para aplicar a personalização da trilha A (S6-2, S6-3).
    cadastrar: async (d) => {
      const r = await api.cadastrar(d);
      if (r.tipo === 'criado') criado.onboardingId = r.cliente.onboarding?.id ?? null;
      return r;
    },
  });
  if (estado.tipo !== 'criado') return estado;
  revalidatePath('/clientes');
  if (!criado.onboardingId) return estado;
  const aviso = await aplicarPersonalizacao(
    criado.onboardingId,
    dados,
    (await cookies()).toString(),
  );
  return aviso ? { ...estado, aviso } : estado;
}

export async function gerarNovoLinkAction(
  _anterior: EstadoLink,
  dados: FormData,
): Promise<EstadoLink> {
  return processarNovoLink(dados, await clienteApiDoServidor());
}
