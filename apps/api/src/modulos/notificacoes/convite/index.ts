import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../../base/auth.js';
import { reenviarConvite, reenviarLembrete, type DepsConvite } from './convite.js';

const parametros = z.object({ id: z.string().min(1).max(64) });

/** Módulo notificacoes/convite (S5-4): reenviar convite e lembrete pelo detalhe (RN-65, RN-66). */
export default function convite(app: FastifyInstance): Promise<void> {
  const deps = (): DepsConvite => ({
    eventos: app.deps.eventos,
    urlApp: app.deps.auth.urlApp,
    chaveLink: app.deps.chaveLink,
  });

  app.post('/onboardings/:id/convite/reenviar', { preHandler: exigirUsuario }, async (request) => {
    const { id } = parametros.parse(request.params);
    const enviaEm = await reenviarConvite(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      deps(),
      id,
      app.deps.relogio.agora(),
    );
    return { enviaEm };
  });

  app.post('/onboardings/:id/lembrete/reenviar', { preHandler: exigirUsuario }, async (request) => {
    const { id } = parametros.parse(request.params);
    const enviaEm = await reenviarLembrete(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      deps(),
      id,
      app.deps.relogio.agora(),
    );
    return { enviaEm };
  });

  return Promise.resolve();
}
