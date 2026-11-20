import { ehPlataformaAcesso, PLATAFORMAS_ACESSO } from '@convergia/core/acessos';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { avisarEtapasMudaram } from '../onboarding/estados/status.js';
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
  lerEscolha,
  lerEscolhaPadrao,
  marcarAcesso,
  plataformasPadrao,
  salvarConfigAcessos,
  salvarPlataformasPadrao,
  salvarEscolha,
} from './acessos.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    /** A agência marcou um acesso como inválido (RN-28): alerta interno da S5-4 (RN-58). */
    'acesso.marcado_invalido': { onboardingId: string; plataforma: string; usuarioId: string };
  }
}

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
const corpoEscolha = z.object({ plataformas: z.array(z.string().max(40)).max(10) });
const corpoConfig = z.object({
  identificadores: z.object(
    Object.fromEntries(PLATAFORMAS_ACESSO.map((p) => [p, z.string().max(200).optional()])),
  ),
  /** RN-27: marcadas por padrão para cada cliente novo (S8-2). Ausente = não muda. */
  plataformasPadrao: z.array(z.string().max(20)).max(10).optional(),
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
    const agora = app.deps.relogio.agora();
    const r = await comLinkValido(app.deps.prisma, token, agora, async (link) => {
      const informado = await informarAcessoDoCliente(
        escopoAgencia(app.deps.prisma, link.agenciaId),
        link.agenciaId,
        link.onboardingId,
        alvo,
        agora,
      );
      const ator = `cliente:${link.onboardingId}`;
      await avisarEtapasMudaram(app.deps.eventos, link.agenciaId, link.onboardingId, ator, agora);
      return informado;
    });
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
    async (request, reply) => {
      const { onboardingId, plataforma: alvo } = parametrosOnboarding.parse(request.params);
      if (!alvo || !ehPlataformaAcesso(alvo)) {
        return reply
          .status(404)
          .send({ erro: 'NAO_ENCONTRADO', mensagem: 'Plataforma desconhecida' });
      }
      const { status, motivo } = corpoMarcacao.parse(request.body);
      const usuario = usuarioDaRequisicao(request);
      const estado = await marcarAcesso(
        prismaDaRequisicao(app, request),
        usuario,
        onboardingId,
        alvo,
        status,
        motivo,
      );
      await avisarEtapasMudaram(
        app.deps.eventos,
        usuario.agenciaId,
        onboardingId,
        `usuario:${usuario.id}`,
        app.deps.relogio.agora(),
      );
      if (status === 'invalido') {
        await app.deps.eventos.publicar({
          tipo: 'acesso.marcado_invalido',
          agenciaId: usuario.agenciaId,
          ocorridoEm: app.deps.relogio.agora(),
          dados: { onboardingId, plataforma: alvo, usuarioId: usuario.id },
        });
      }
      return estado;
    },
  );

  // Plataformas pedidas a cada cliente (S6-3, RN-27). Qualquer usuário cadastra cliente, então o
  // padrão não exige admin; mudar a escolha exige admin ou responsável (RN-02).
  app.get('/acessos/padrao', { preHandler: exigirUsuario }, (request) =>
    lerEscolhaPadrao(prismaDaRequisicao(app, request)),
  );

  app.get(
    '/onboardings/:onboardingId/acessos/escolha',
    { preHandler: exigirUsuario },
    (request) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      return lerEscolha(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        onboardingId,
      );
    },
  );

  app.put(
    '/onboardings/:onboardingId/acessos/escolha',
    { preHandler: exigirUsuario },
    async (request, reply) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      const { plataformas } = corpoEscolha.parse(request.body);
      const usuario = usuarioDaRequisicao(request);
      const r = await salvarEscolha(
        prismaDaRequisicao(app, request),
        usuario,
        onboardingId,
        plataformas,
      );
      if (r.tipo === 'travada') {
        return reply.status(409).send({
          erro: 'ESCOLHA_TRAVADA',
          mensagem: 'A etapa de acessos já começou; as plataformas não mudam mais (RN-27)',
        });
      }
      await avisarEtapasMudaram(
        app.deps.eventos,
        usuario.agenciaId,
        onboardingId,
        `usuario:${usuario.id}`,
        app.deps.relogio.agora(),
      );
      return r.estado;
    },
  );

  app.get('/acessos/config', { preHandler: exigirAdmin }, async (request) => {
    const prisma = prismaDaRequisicao(app, request);
    return {
      identificadores: await lerConfigAcessos(prisma),
      plataformasPadrao: await plataformasPadrao(prisma),
    };
  });

  app.put('/acessos/config', { preHandler: exigirAdmin }, async (request, reply) => {
    const { identificadores, plataformasPadrao: padrao } = corpoConfig.parse(request.body);
    const prisma = prismaDaRequisicao(app, request);
    const usuario = usuarioDaRequisicao(request);
    if (padrao) {
      const erro = await salvarPlataformasPadrao(prisma, usuario, padrao);
      if (erro) return reply.status(422).send({ erro: 'RN-27', motivo: erro });
    }
    await salvarConfigAcessos(prisma, usuario, identificadores);
    return { ok: true };
  });

  return Promise.resolve();
}
