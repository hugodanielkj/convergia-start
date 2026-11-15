import type { PublicadorEventos } from '@convergia/core/base';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import type { PrismaClient } from '../../../base/prisma.js';
import { tokenOptOut } from '../envio/enfileirar.js';
import { pararLembretes } from '../envio/opt-out.js';
import type { EventosMeta } from './eventos-meta.js';

/**
 * Aplica os eventos da Meta no registro de envio (RN-62) e o opt-out por "PARAR" (RN-61).
 * Entrega que falha depois de aceita fica `falhou` e avisa a agência (a mensagem já saiu da fila).
 */
export async function aplicarEventosMeta(
  prisma: PrismaClient,
  eventos: PublicadorEventos,
  ev: EventosMeta,
  agora: Date,
): Promise<void> {
  for (const f of ev.falhas) {
    const erro = `meta_entrega_${String(f.codigo ?? 'falhou')}`;
    const afetadas = await prisma.notificacao.findMany({
      where: { idExterno: f.idExterno, status: 'enviada' },
      select: { id: true, agenciaId: true, onboardingId: true },
    });
    for (const n of afetadas) {
      await prisma.notificacao.update({ where: { id: n.id }, data: { status: 'falhou', erro } });
      await eventos.publicar({
        tipo: 'notificacao.falhou',
        agenciaId: n.agenciaId,
        ocorridoEm: agora,
        dados: { notificacaoId: n.id, onboardingId: n.onboardingId, erro },
      });
    }
  }
  for (const telefone of new Set(ev.optOuts)) {
    const onboardings = await prisma.onboarding.findMany({
      where: { cliente: { whatsapp: { in: [telefone, `+${telefone}`] } } },
      select: { id: true, agenciaId: true },
    });
    for (const o of onboardings) {
      const pref = await tokenOptOut(escopoAgencia(prisma, o.agenciaId), o.agenciaId, o.id);
      await pararLembretes(prisma, pref.tokenOptOut, agora);
    }
  }
}
