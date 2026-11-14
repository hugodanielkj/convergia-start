import type { StatusEtapa, StatusOnboarding, TipoEtapa } from '@convergia/core/onboarding';
import type { PrismaClient } from '../../base/prisma.js';
import { localizarLink } from './localizar-link.js';

/** Tudo que o cliente pode ver pelo link (RN-13): nada de ids, agência ou outros clientes. */
export interface VisaoCliente {
  readonly empresa: string;
  readonly statusGeral: StatusOnboarding;
  readonly etapas: readonly { readonly tipo: TipoEtapa; readonly status: StatusEtapa }[];
}

export type ResultadoConsultaLink =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'expirado' }
  | { readonly tipo: 'valido'; readonly visao: VisaoCliente };

/** Dados do onboarding para a página do cliente, ou o motivo de o link não valer (RN-11, RN-13). */
export async function consultarLink(
  prisma: PrismaClient,
  token: string,
  agora: Date,
): Promise<ResultadoConsultaLink> {
  const localizado = await localizarLink(prisma, token, agora);
  if (localizado.situacao !== 'valido') return { tipo: localizado.situacao };

  const onboarding = await prisma.onboarding.findUniqueOrThrow({
    where: { id: localizado.link.onboardingId },
    select: {
      statusGeral: true,
      cliente: { select: { nomeEmpresa: true } },
      etapas: { select: { tipo: true, status: true }, orderBy: { tipo: 'asc' } },
    },
  });
  const { statusGeral, cliente, etapas } = onboarding;
  return { tipo: 'valido', visao: { empresa: cliente.nomeEmpresa, statusGeral, etapas } };
}
