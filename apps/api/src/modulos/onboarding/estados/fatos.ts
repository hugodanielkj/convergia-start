import { situacaoAgendamento, type FatosOnboarding } from '@convergia/core/estados';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';

/** Cliente de dentro de uma transação interativa do Prisma escopado por agência. */
export type TransacaoDaAgencia = Parameters<Parameters<PrismaDaAgencia['$transaction']>[0]>[0];

/** Data da entrega dos primeiros conteúdos: a última transição para esse status (RN-52). */
export async function dataDaEntrega(
  tx: TransacaoDaAgencia,
  onboardingId: string,
): Promise<Date | null> {
  const entrega = await tx.transicaoStatus.findFirst({
    where: { onboardingId, para: 'primeiro_conteudo_entregue' },
    orderBy: { em: 'desc' },
    select: { em: true },
  });
  return entrega?.em ?? null;
}

/** Lê o que o status geral precisa saber: primeiro acesso, etapas, agendamentos e entrega (RN-49). */
export async function lerFatos(
  tx: TransacaoDaAgencia,
  onboardingId: string,
): Promise<FatosOnboarding> {
  const [primeiroAcesso, convites, etapas, agendamentos, entregueEm] = await Promise.all([
    tx.primeiroAcesso.count({ where: { onboardingId } }),
    tx.notificacao.count({ where: { onboardingId, tipo: 'convite', status: 'enviada' } }),
    tx.etapaOnboarding.findMany({ where: { onboardingId }, select: { tipo: true, status: true } }),
    tx.agendamento.findMany({ where: { onboardingId }, select: { tipo: true, status: true } }),
    dataDaEntrega(tx, onboardingId),
  ]);
  const concluida = (tipo: 'formulario' | 'acessos') =>
    etapas.some((e) => e.tipo === tipo && e.status === 'concluida');
  const doTipo = (tipo: 'reuniao' | 'captacao') =>
    situacaoAgendamento(agendamentos.filter((a) => a.tipo === tipo).map((a) => a.status));

  return {
    abriuLink: primeiroAcesso > 0,
    // RN-09: vale o convite que saiu de fato, não o que está na fila (decisão do PO, S5-4).
    conviteEnviado: convites > 0,
    formularioConcluido: concluida('formulario'),
    acessosConcluidos: concluida('acessos'),
    reuniao: doTipo('reuniao'),
    captacao: doTipo('captacao'),
    entregueEm,
  };
}
