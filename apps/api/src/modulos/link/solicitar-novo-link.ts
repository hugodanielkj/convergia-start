import type { PublicadorEventos } from '@convergia/core/base';
import type { PrismaClient } from '../../base/prisma.js';
import { localizarLink } from './localizar-link.js';

// Evento para o alerta interno da agência (S5-4 assina este tipo).
declare module '@convergia/core/base' {
  interface MapaEventos {
    'onboarding.novo_link_solicitado': { onboardingId: string };
  }
}

export type ResultadoSolicitacao = 'registrada' | 'ja_solicitada' | 'link_valido' | 'invalido';

/**
 * O cliente com link expirado pede um novo à agência (RN-11). Só vale para link expirado, e um
 * pedido por link: repetir não gera novo aviso nem nova auditoria, para a rota pública não virar
 * canal de spam. Depois que a agência regenera o link, o cliente pode pedir de novo.
 * A agência é quem gera e entrega o link novo; o cliente nunca recebe um token por aqui (RN-12).
 */
export async function solicitarNovoLink(
  prisma: PrismaClient,
  eventos: PublicadorEventos,
  token: string,
  agora: Date,
): Promise<ResultadoSolicitacao> {
  const localizado = await localizarLink(prisma, token, agora);
  if (localizado.situacao === 'invalido') return 'invalido';
  if (localizado.situacao === 'valido') return 'link_valido';

  const { onboardingId, agenciaId, valeDesde } = localizado.link;
  const jaPediu = await prisma.auditoriaLog.findFirst({
    where: {
      agenciaId,
      entidade: 'Onboarding',
      entidadeId: onboardingId,
      acao: 'link.novo_solicitado',
      em: { gte: valeDesde },
    },
    select: { id: true },
  });
  if (jaPediu) return 'ja_solicitada';

  await prisma.auditoriaLog.create({
    data: {
      agenciaId,
      ator: `cliente:${onboardingId}`,
      acao: 'link.novo_solicitado',
      entidade: 'Onboarding',
      entidadeId: onboardingId,
      em: agora,
    },
  });
  await eventos.publicar({
    tipo: 'onboarding.novo_link_solicitado',
    agenciaId,
    ocorridoEm: agora,
    dados: { onboardingId },
  });
  return 'registrada';
}
