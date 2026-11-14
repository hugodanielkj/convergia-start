import { ACOES_MANUAIS } from '@convergia/core/estados';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../../base/auth.js';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import { reabrirFormulario } from '../../formulario/respostas.js';
import { concluirVencidos, executarAcao, recalcularStatus } from './status.js';

const parametros = z.object({ id: z.string().min(1).max(64) });
const parametrosAcao = parametros.extend({ acao: z.enum(ACOES_MANUAIS) });
const corpoMotivo = z.object({ motivo: z.string().max(500).optional() });

/** De quanto em quanto tempo o worker procura onboardings para concluir sozinhos (RN-52). */
const INTERVALO_CONCLUSAO_MS = 60 * 60 * 1000;

function ligarConclusaoAutomatica(app: FastifyInstance): void {
  const { prisma, eventos, relogio } = app.deps;
  async function rodar(): Promise<void> {
    try {
      // Rotina do sistema: lê a config de todas as agências e age pelo cliente escopado de cada uma.
      const configs = await prisma.configAgencia.findMany({
        select: { agenciaId: true, diasConclusaoAutomatica: true },
      });
      await concluirVencidos(
        (agenciaId) => escopoAgencia(prisma, agenciaId),
        configs.map((c) => ({ agenciaId: c.agenciaId, dias: c.diasConclusaoAutomatica })),
        eventos,
        relogio.agora(),
      );
    } catch (erro) {
      app.log.error({ err: erro }, 'falha na conclusão automática de onboardings');
    }
  }
  const relogioDoWorker = setInterval(() => void rodar(), INTERVALO_CONCLUSAO_MS);
  relogioDoWorker.unref();
  app.addHook('onClose', () => {
    clearInterval(relogioDoWorker);
    return Promise.resolve();
  });
}

/** Módulo onboarding/estados (S4-1): máquina de estados do onboarding (RN-49 a RN-54). */
export default function estados(app: FastifyInstance): Promise<void> {
  const recalcularPorEvento = (agenciaId: string, onboardingId: string, ator: string) =>
    recalcularStatus(
      escopoAgencia(app.deps.prisma, agenciaId),
      app.deps.eventos,
      onboardingId,
      ator,
      app.deps.relogio.agora(),
    ).then(() => undefined);

  app.deps.eventos.assinar('onboarding.etapas_mudaram', (e) =>
    recalcularPorEvento(e.agenciaId, e.dados.onboardingId, e.dados.ator),
  );
  app.deps.eventos.assinar('agendamento.criado', (e) =>
    recalcularPorEvento(e.agenciaId, e.dados.onboardingId, `cliente:${e.dados.onboardingId}`),
  );

  // Pausar, retomar, cancelar (Admin, RN-53), registrar entrega e encerrar (RN-52).
  app.post('/onboardings/:id/acoes/:acao', { preHandler: exigirUsuario }, async (request) => {
    const { id, acao } = parametrosAcao.parse(request.params);
    const { motivo } = corpoMotivo.parse(request.body ?? {});
    const statusGeral = await executarAcao(
      prismaDaRequisicao(app, request),
      app.deps.eventos,
      usuarioDaRequisicao(request),
      id,
      acao,
      motivo,
      app.deps.relogio.agora(),
    );
    return { statusGeral };
  });

  // Reabrir etapa concluída, com motivo (RN-54). Por decisão do PO, só o formulário.
  app.post(
    '/onboardings/:id/etapas/formulario/reabrir',
    { preHandler: exigirUsuario },
    async (request) => {
      const { id } = parametros.parse(request.params);
      const { motivo } = corpoMotivo.parse(request.body ?? {});
      const prisma = prismaDaRequisicao(app, request);
      const usuario = usuarioDaRequisicao(request);
      const agora = app.deps.relogio.agora();
      await reabrirFormulario(prisma, usuario, id, motivo ?? '', agora);
      const statusGeral = await recalcularStatus(
        prisma,
        app.deps.eventos,
        id,
        `usuario:${usuario.id}`,
        agora,
      );
      return { statusGeral };
    },
  );

  ligarConclusaoAutomatica(app);
  return Promise.resolve();
}
