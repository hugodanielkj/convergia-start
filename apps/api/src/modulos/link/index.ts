import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { consultarLink } from './consultar-link.js';
import { linkParaCopiar } from './link-atual.js';
import { regenerarLink } from './regenerar-link.js';
import { solicitarNovoLink } from './solicitar-novo-link.js';

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
        app.deps.chaveLink,
      );
      return { link: novo };
    },
  );

  // O link vigente, para "Copiar link" no detalhe (2026-11-15-b-link-cifrado).
  app.get(
    '/onboardings/:onboardingId/link',
    { preHandler: exigirUsuario },
    async (request, reply) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      void reply.header('cache-control', 'no-store');
      const link = await linkParaCopiar(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        app.deps.chaveLink,
        onboardingId,
      );
      return { link };
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

  // Rota pública: o cliente com link expirado pede um novo à agência (RN-11).
  app.post('/publico/onboardings/:token/solicitar-novo-link', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const resultado = await solicitarNovoLink(
      app.deps.prisma,
      app.deps.eventos,
      token,
      app.deps.relogio.agora(),
    );
    void reply.header('cache-control', 'no-store');

    switch (resultado) {
      case 'invalido':
        return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
      case 'link_valido':
        return reply
          .status(409)
          .send({ erro: 'LINK_VALIDO', mensagem: 'Este link ainda é válido' });
      case 'registrada':
      case 'ja_solicitada':
        return reply.status(202).send({ situacao: resultado });
    }
  });

  return Promise.resolve();
}
