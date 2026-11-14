import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { localizarLink } from '../link/localizar-link.js';
import { situacaoDaCaptacao } from './situacao.js';

const params = z.object({ token: z.string().min(1).max(100) });

/**
 * Módulo captação (S4-4): situação da etapa para a página do cliente (RN-39). Os horários e a
 * reserva usam as rotas de agenda (RN-38, RN-41); o intervalo mínimo e os dados do local (RN-39,
 * RN-40) são aplicados lá.
 */
export default function captacao(app: FastifyInstance): Promise<void> {
  app.get('/publico/onboardings/:token/captacao', async (request, reply) => {
    const { token } = params.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const link = await localizarLink(app.deps.prisma, token, app.deps.relogio.agora());
    if (link.situacao === 'invalido') {
      return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
    if (link.situacao === 'expirado') {
      return reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
    }
    return situacaoDaCaptacao(app.deps.prisma, link.link);
  });

  return Promise.resolve();
}
