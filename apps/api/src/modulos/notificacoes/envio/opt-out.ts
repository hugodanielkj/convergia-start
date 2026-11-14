import type { PrismaClient } from '../../../base/prisma.js';

export type SituacaoOptOut =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'ok'; readonly empresa: string; readonly desativado: boolean };

/** Página pública "parar de receber lembretes" (RN-61): só o token, sem expor mais nada. */
export async function consultarOptOut(
  prisma: PrismaClient,
  token: string,
): Promise<SituacaoOptOut> {
  const pref = await prisma.preferenciaEnvio.findUnique({
    where: { tokenOptOut: token },
    select: {
      lembretesDesativadosEm: true,
      onboarding: { select: { cliente: { select: { nomeEmpresa: true } } } },
    },
  });
  if (!pref) return { tipo: 'invalido' };
  return {
    tipo: 'ok',
    empresa: pref.onboarding.cliente.nomeEmpresa,
    desativado: pref.lembretesDesativadosEm !== null,
  };
}

/**
 * Para os lembretes (RN-61) e cancela os que ainda estão na fila. Pedir de novo não muda nada.
 * Só por POST: abrir o link (inclusive a pré-visualização do WhatsApp) não desativa sozinho.
 */
export async function pararLembretes(
  prisma: PrismaClient,
  token: string,
  agora: Date,
): Promise<boolean> {
  const pref = await prisma.preferenciaEnvio.findUnique({ where: { tokenOptOut: token } });
  if (!pref) return false;
  await prisma.$transaction([
    prisma.preferenciaEnvio.updateMany({
      where: { tokenOptOut: token, lembretesDesativadosEm: null },
      data: { lembretesDesativadosEm: agora },
    }),
    prisma.notificacao.updateMany({
      where: { onboardingId: pref.onboardingId, categoria: 'lembrete', status: 'pendente' },
      data: { status: 'cancelada', proximaTentativaEm: null, erro: 'opt_out' },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: pref.agenciaId,
        ator: `cliente:${pref.onboardingId}`,
        acao: 'lembretes.desativados',
        entidade: 'Onboarding',
        entidadeId: pref.onboardingId,
        em: agora,
      },
    }),
  ]);
  return true;
}
