import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { consultarLink } from './consultar-link.js';
import { regenerarLink } from './regenerar-link.js';

// O token tem 43 caracteres; o teto só barra entradas absurdas antes de qualquer cálculo.
const parametrosToken = z.object({ token: z.string().min(1).max(100) });
const parametrosOnboarding = z.object({ onboardingId: z.string().min(1).max(64) });

/** Módulo link (S1-5): regeneração pela agência e consulta pública pelo cliente. */
export default function link(app: FastifyInstance): Promise<void> {
  app.post(
    '/onboardings/:onboardingId/link/regenerar',
    { preHandler: exigirUsuario },
    async (request) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      const novo = await regenerarLink(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        onboardingId,
        app.deps.relogio.agora(),
      );
      return { link: novo };
    },
  );

  // Rota pública: sem login (RN-01). O token da URL é a única credencial.
  app.get('/publico/onboardings/:token', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const resultado = await consultarLink(app.deps.prisma, token, app.deps.relogio.agora());
    // A URL carrega a credencial: nada de guardar a resposta em cache.
    void reply.header('cache-control', 'no-store');

    switch (resultado.tipo) {
      case 'invalido':
        return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
      case 'expirado':
        return reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
      case 'valido':
        return { onboarding: resultado.visao };
    }
  });

  return Promise.resolve();
}
