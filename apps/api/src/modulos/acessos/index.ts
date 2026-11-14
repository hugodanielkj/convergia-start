import { ehPlataformaAcesso, PLATAFORMAS_ACESSO } from '@convergia/core/acessos';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  exigirAdmin,
  exigirUsuario,
  prismaDaRequisicao,
  usuarioDaRequisicao,
} from '../../base/auth.js';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import { comLinkValido } from '../consentimento/consentimento.js';
import {
  informarAcessoDoCliente,
  lerAcessosDaAgencia,
  lerAcessosDoCliente,
  lerConfigAcessos,
  marcarAcesso,
  salvarConfigAcessos,
} from './acessos.js';

const plataforma = z.string().refine(ehPlataformaAcesso, 'Plataforma desconhecida');
const parametrosToken = z.object({
  token: z.string().min(1).max(100),
  plataforma: plataforma.optional(),
});
const parametrosOnboarding = z.object({
  onboardingId: z.string().min(1).max(64),
  plataforma: plataforma.optional(),
});
const corpoMarcacao = z.object({
  status: z.enum(['concedido', 'invalido']),
  motivo: z.string().max(2000).optional(),
});
const corpoConfig = z.object({
  identificadores: z.object(
    Object.fromEntries(PLATAFORMAS_ACESSO.map((p) => [p, z.string().max(200).optional()])),
  ),
});

function recusarLink(reply: FastifyReply, tipo: 'invalido' | 'expirado') {
  return tipo === 'invalido'
    ? reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' })
    : reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
}

/**
 * Módulo acessos (S3-1, S3-2): acesso às redes por parceiro, sem senha (D-05).
 * O cliente só vê o passo a passo e avisa que adicionou; quem confirma é a agência (RN-28).
 */
export default function acessos(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', (request, reply, payload, feito) => {
    if (request.url.startsWith('/publico/')) void reply.header('cache-control', 'no-store');
    feito(null, payload);
  });

  // Cliente (link único, RN-01).
  app.get('/publico/onboardings/:token/acessos', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const r = await comLinkValido(app.deps.prisma, token, app.deps.relogio.agora(), (link) =>
      lerAcessosDoCliente(
        escopoAgencia(app.deps.prisma, link.agenciaId),
        link.agenciaId,
        link.onboardingId,
      ),
    );
    if (r.tipo !== 'ok') return recusarLink(reply, r.tipo);
    return r.valor;
  });

  app.post('/publico/onboardings/:token/acessos/:plataforma/informar', async (request, reply) => {
    const { token, plataforma: alvo } = parametrosToken.parse(request.params);
    if (!alvo || !ehPlataformaAcesso(alvo))
      return reply.status(404).send({ erro: 'NAO_ENCONTRADO' });
    const r = await comLinkValido(app.deps.prisma, token, app.deps.relogio.agora(), (link) =>
      informarAcessoDoCliente(
        escopoAgencia(app.deps.prisma, link.agenciaId),
        link.agenciaId,
        link.onboardingId,
        alvo,
        app.deps.relogio.agora(),
      ),
    );
    if (r.tipo !== 'ok') return recusarLink(reply, r.tipo);
    return r.valor.estado;
  });

  // Agência.
  app.get('/onboardings/:onboardingId/acessos', { preHandler: exigirUsuario }, (request) => {
    const { onboardingId } = parametrosOnboarding.parse(request.params);
    return lerAcessosDaAgencia(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      onboardingId,
    );
  });

  app.put(
    '/onboardings/:onboardingId/acessos/:plataforma',
    { preHandler: exigirUsuario },
    (request, reply) => {
      const { onboardingId, plataforma: alvo } = parametrosOnboarding.parse(request.params);
      if (!alvo || !ehPlataformaAcesso(alvo)) {
        return reply
          .status(404)
          .send({ erro: 'NAO_ENCONTRADO', mensagem: 'Plataforma desconhecida' });
      }
      const { status, motivo } = corpoMarcacao.parse(request.body);
      return marcarAcesso(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        onboardingId,
        alvo,
        status,
        motivo,
      );
    },
  );

  app.get('/acessos/config', { preHandler: exigirAdmin }, async (request) => ({
    identificadores: await lerConfigAcessos(prismaDaRequisicao(app, request)),
  }));

  app.put('/acessos/config', { preHandler: exigirAdmin }, async (request) => {
    const { identificadores } = corpoConfig.parse(request.body);
    await salvarConfigAcessos(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      identificadores,
    );
    return { ok: true };
  });

  return Promise.resolve();
}
