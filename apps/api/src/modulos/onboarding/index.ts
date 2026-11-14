import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { criarOnboardingParaCliente } from './criar-onboarding.js';

const parametros = z.object({ clienteId: z.string().min(1).max(64) });
const corpo = z.object({ responsavelId: z.string().min(1).max(64).optional() });

/** Módulo onboarding (S1-4): novo onboarding para um cliente que já existe. */
export default function onboarding(app: FastifyInstance): Promise<void> {
  app.post(
    '/clientes/:clienteId/onboardings',
    { preHandler: exigirUsuario },
    async (request, reply) => {
      const { clienteId } = parametros.parse(request.params);
      const { responsavelId } = corpo.parse(request.body ?? {});
      const criado = await criarOnboardingParaCliente(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        clienteId,
        responsavelId,
        app.deps.relogio.agora(),
      );
      return reply.status(201).send(criado);
    },
  );

  return Promise.resolve();
}
