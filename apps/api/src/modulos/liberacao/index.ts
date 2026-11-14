import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import { comLinkValido } from '../consentimento/consentimento.js';
import { etapasDoCliente } from './liberacao.js';

const parametrosToken = z.object({ token: z.string().min(1).max(100) });

/**
 * Módulo liberacao (S6-4, RN-79): ordem das etapas na página do cliente. As etapas usam
 * `exigirEtapaLiberada` (liberacao.ts) antes de aceitar uma ação.
 */
export default function liberacao(app: FastifyInstance): Promise<void> {
  app.get('/publico/onboardings/:token/etapas', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const r = await comLinkValido(app.deps.prisma, token, app.deps.relogio.agora(), (link) =>
      etapasDoCliente(escopoAgencia(app.deps.prisma, link.agenciaId), link.onboardingId),
    );
    if (r.tipo === 'invalido') {
      return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
    if (r.tipo === 'expirado') {
      return reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
    }
    return r.valor;
  });

  return Promise.resolve();
}
