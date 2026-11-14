import { hashToken, verificarLink } from '@convergia/core/link';
import type { StatusEtapa, StatusOnboarding, TipoEtapa } from '@convergia/core/onboarding';
import type { PrismaClient } from '../../base/prisma.js';

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

/**
 * Resolve o token da URL do cliente. Usa o Prisma sem escopo de propósito: a agência ainda
 * não é conhecida, ela sai do próprio link. Token errado e onboarding cancelado dão o mesmo
 * resultado, para a resposta não revelar se o link existe (RN-53).
 */
export async function consultarLink(
  prisma: PrismaClient,
  token: string,
  agora: Date,
): Promise<ResultadoConsultaLink> {
  const link = await prisma.linkOnboarding.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      onboarding: {
        select: {
          statusGeral: true,
          cliente: { select: { nomeEmpresa: true } },
          etapas: { select: { tipo: true, status: true }, orderBy: { tipo: 'asc' } },
        },
      },
    },
  });
  if (!link || link.onboarding.statusGeral === 'cancelado') return { tipo: 'invalido' };

  const situacao = verificarLink(token, { hash: link.tokenHash, expiraEm: link.expiraEm }, agora);
  if (situacao !== 'valido') return { tipo: situacao };

  const { statusGeral, cliente, etapas } = link.onboarding;
  return { tipo: 'valido', visao: { empresa: cliente.nomeEmpresa, statusGeral, etapas } };
}
