import type { FastifyInstance } from 'fastify';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import { enfileirarConfirmacao } from './confirmacao.js';

/**
 * Módulo notificacoes/confirmacao (S8-3): confirmação final com prazo. Reage às etapas (a última
 * concluída) e ao prazo (calculado depois da captação): o que vier por último dispara.
 */
export default function confirmacao(app: FastifyInstance): Promise<void> {
  const tentar = (e: { agenciaId: string; ocorridoEm: Date; dados: { onboardingId: string } }) =>
    enfileirarConfirmacao(
      escopoAgencia(app.deps.prisma, e.agenciaId),
      { eventos: app.deps.eventos, urlApp: app.deps.auth.urlApp, chaveLink: app.deps.chaveLink },
      e.dados.onboardingId,
      e.ocorridoEm,
    ).then(() => undefined);

  app.deps.eventos.assinar('onboarding.etapas_mudaram', tentar);
  app.deps.eventos.assinar('prazo.alterado', tentar);
  // Captação remarcada no mesmo dia: o prazo não muda, mas o horário na confirmação sim (RN-46).
  app.deps.eventos.assinar('agendamento.reagendado', (e) =>
    e.dados.tipo === 'captacao' ? tentar(e) : Promise.resolve(),
  );
  return Promise.resolve();
}
