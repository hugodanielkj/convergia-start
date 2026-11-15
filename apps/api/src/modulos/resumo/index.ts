import { RegraVioladaError } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { linkDeOnboardingConcluido, resumoDoLink } from './resumo.js';

const parametrosToken = z.object({ token: z.string().min(1).max(100) });
const METODOS_ALTERACAO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ROTA_DO_LINK = /^\/publico\/onboardings\/([^/?#]+)/;

function tokenDaUrl(url: string): string | null {
  const segmento = ROTA_DO_LINK.exec(url)?.[1];
  if (!segmento) return null;
  try {
    return decodeURIComponent(segmento);
  } catch {
    return null;
  }
}

/**
 * Módulo resumo (S7-2, RN-14): depois da conclusão, o link mostra só o resumo e nenhuma rota
 * pública aceita alteração. A trava fica num gancho único (fastify-plugin), e não em cada
 * módulo, para valer também nas etapas da outra trilha.
 */
async function resumo(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    if (!METODOS_ALTERACAO.has(request.method)) return;
    const token = tokenDaUrl(request.url);
    if (token && (await linkDeOnboardingConcluido(app.deps.prisma, token))) {
      throw new RegraVioladaError('RN-14', 'Onboarding concluído: o link é só para consulta');
    }
  });

  app.get('/publico/onboardings/:token/resumo', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const r = await resumoDoLink(app.deps.prisma, token, app.deps.relogio.agora());
    if (r.tipo === 'invalido') {
      return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
    if (r.tipo === 'nao_concluido') {
      return reply
        .status(409)
        .send({ erro: 'NAO_CONCLUIDO', mensagem: 'O onboarding ainda não foi concluído' });
    }
    return r.resumo;
  });

  return Promise.resolve();
}

export default fp(resumo, { name: 'resumo' });
