import { hashToken, verificarLink } from '@convergia/core/link';
import type { PrismaClient } from '../../base/prisma.js';

export interface LinkLocalizado {
  readonly onboardingId: string;
  readonly agenciaId: string;
  /** Quando este token passou a valer: criação ou última regeneração. */
  readonly valeDesde: Date;
}

export type ResultadoLocalizacao =
  | { readonly situacao: 'invalido' }
  | { readonly situacao: 'valido' | 'expirado'; readonly link: LinkLocalizado };

/**
 * Resolve o token da URL do cliente. Usa o Prisma sem escopo de propósito: a agência ainda
 * não é conhecida, ela sai do próprio link. Token errado e onboarding cancelado dão o mesmo
 * resultado, para a resposta não revelar se o link existe (RN-53).
 */
export async function localizarLink(
  prisma: PrismaClient,
  token: string,
  agora: Date,
): Promise<ResultadoLocalizacao> {
  const link = await prisma.linkOnboarding.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { onboarding: { select: { statusGeral: true } } },
  });
  if (!link || link.onboarding.statusGeral === 'cancelado') return { situacao: 'invalido' };

  const situacao = verificarLink(token, { hash: link.tokenHash, expiraEm: link.expiraEm }, agora);
  if (situacao === 'invalido') return { situacao };
  return {
    situacao,
    link: {
      onboardingId: link.onboardingId,
      agenciaId: link.agenciaId,
      valeDesde: link.regeneradoEm ?? link.criadoEm,
    },
  };
}
