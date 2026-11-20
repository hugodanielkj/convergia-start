import type { PublicadorEventos } from '@convergia/core/base';
import { statusEtapaAgendada } from '@convergia/core/estados';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';
import { avisarEtapasMudaram } from './status.js';

/**
 * Deixa a etapa reunião ou captação coerente com os agendamentos: concluída ao marcar o horário,
 * pendente se o horário foi cancelado ou o cliente faltou (decisão 2026-11-19-a-etapa-concluida-
 * ao-agendar). Quando muda, avisa os módulos (status geral, aviso de conclusão, confirmação).
 */
export async function sincronizarEtapaAgendada(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  agenciaId: string,
  onboardingId: string,
  tipo: 'reuniao' | 'captacao',
  ator: string,
  agora: Date,
): Promise<void> {
  const [agendamentos, etapa] = await Promise.all([
    prisma.agendamento.findMany({ where: { onboardingId, tipo }, select: { status: true } }),
    prisma.etapaOnboarding.findFirst({ where: { onboardingId, tipo }, select: { status: true } }),
  ]);
  if (!etapa) return;
  const novo = statusEtapaAgendada(agendamentos.map((a) => a.status));
  if (etapa.status === novo) return;
  await prisma.etapaOnboarding.updateMany({
    where: { onboardingId, tipo },
    data: { status: novo },
  });
  await avisarEtapasMudaram(eventos, agenciaId, onboardingId, ator, agora);
}
