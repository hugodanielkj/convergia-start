import type { FastifyInstance } from 'fastify';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { filtrosDoPainel, listarOnboardings } from './painel.js';

/** Módulo painel (S3-3): lista de onboardings com filtros (RN-63, RN-64). */
export default function painel(app: FastifyInstance): Promise<void> {
  app.get('/painel/onboardings', { preHandler: exigirUsuario }, (request) =>
    listarOnboardings(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      filtrosDoPainel.parse(request.query),
      app.deps.relogio.agora(),
    ),
  );

  return Promise.resolve();
}
