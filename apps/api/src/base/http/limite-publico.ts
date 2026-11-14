import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LimitesPublicos } from './config.js';
import type { ContadorJanela, SituacaoContador } from './contador-janela.js';
import { ehChamadaInterna } from './ip-cliente.js';

const PREFIXO_PUBLICO = '/publico/';

/** O contador guarda só o hash do token: a memória do processo não junta tokens válidos. */
const resumoToken = (token: string) =>
  createHash('sha256').update(token).digest('hex').slice(0, 32);

function tokenDaRota(request: FastifyRequest): string | null {
  const params: unknown = request.params;
  if (typeof params !== 'object' || params === null || !('token' in params)) return null;
  return typeof params.token === 'string' && params.token !== '' ? params.token : null;
}

function recusar(reply: FastifyReply, reiniciaEm: number, agora: number): FastifyReply {
  const segundos = Math.max(1, Math.ceil((reiniciaEm - agora) / 1000));
  return reply.code(429).header('retry-after', String(segundos)).send({
    erro: 'LIMITE_REQUISICOES',
    mensagem: 'Muitas tentativas. Tente de novo em instantes.',
  });
}

const passou = (situacao: SituacaoContador | null, limite: number) =>
  limite > 0 && situacao !== null && situacao.total > limite;

/**
 * Limite de requisições nas rotas públicas do link (RN-76): por IP, por token e bloqueio do IP que
 * erra muitos tokens. A resposta é a mesma para token existente ou não (sem enumeração).
 */
export function registrarLimitePublico(
  app: FastifyInstance,
  limites: LimitesPublicos,
  contador: ContadorJanela,
  agora: () => number,
): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith(PREFIXO_PUBLICO)) return;
    const interno = ehChamadaInterna(request);

    if (!interno) {
      const chaveErros = `erros:${request.ip}`;
      const erros = await contador.consultar(chaveErros);
      if (
        limites.tokensInvalidosPorIp > 0 &&
        erros &&
        erros.total >= limites.tokensInvalidosPorIp
      ) {
        return recusar(reply, erros.reiniciaEm, agora());
      }
      if (limites.porIp > 0) {
        const porIp = await contador.incrementar(`ip:${request.ip}`, limites.janelaMs);
        if (passou(porIp, limites.porIp)) return recusar(reply, porIp.reiniciaEm, agora());
      }
    }

    const token = tokenDaRota(request);
    if (token && limites.porToken > 0) {
      const porToken = await contador.incrementar(`token:${resumoToken(token)}`, limites.janelaMs);
      if (passou(porToken, limites.porToken)) return recusar(reply, porToken.reiniciaEm, agora());
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode !== 404 || !request.url.startsWith(PREFIXO_PUBLICO)) return;
    if (limites.tokensInvalidosPorIp <= 0 || ehChamadaInterna(request)) return;
    await contador.incrementar(`erros:${request.ip}`, limites.janelaTokensInvalidosMs);
  });
}
