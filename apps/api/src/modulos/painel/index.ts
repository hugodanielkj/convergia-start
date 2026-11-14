import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { detalharOnboarding } from './detalhe.js';
import { filtrosDoPainel, listarOnboardings } from './painel.js';

const parametros = z.object({ id: z.string().min(1).max(64) });

/** Módulo painel: lista com filtros (S3-3, RN-63, RN-64) e detalhe do onboarding (S4-2, RN-65). */
export default function painel(app: FastifyInstance): Promise<void> {
  app.get('/painel/onboardings', { preHandler: exigirUsuario }, (request) =>
    listarOnboardings(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      filtrosDoPainel.parse(request.query),
      app.deps.relogio.agora(),
    ),
  );

  app.get('/onboardings/:id/detalhe', { preHandler: exigirUsuario }, (request) =>
    detalharOnboarding(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      parametros.parse(request.params).id,
    ),
  );

  return Promise.resolve();
}
