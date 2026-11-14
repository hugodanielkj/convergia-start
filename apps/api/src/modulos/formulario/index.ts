import type { Respostas } from '@convergia/core/formulario';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { avisarEtapasMudaram } from '../onboarding/estados/status.js';
import {
  exigirAdmin,
  exigirUsuario,
  prismaDaRequisicao,
  usuarioDaRequisicao,
} from '../../base/auth.js';
import { comLinkValido } from '../consentimento/consentimento.js';
import { campoDeEntrada, obterModelo, publicarVersao, salvarRascunho } from './modelo.js';
import { lerCamposPadrao, lerPersonalizacao, salvarPersonalizacao } from './personalizacao.js';
import {
  enviarFormularioDoCliente,
  fecharFormulario,
  lerFormularioDoCliente,
  salvarRascunhoDoCliente,
  type ResultadoFormulario,
  type ResultadoGravacao,
} from './respostas.js';

const parametrosToken = z.object({ token: z.string().min(1).max(100) });
const parametrosOnboarding = z.object({ onboardingId: z.string().min(1).max(64) });
const valorResposta = z.union([z.string(), z.number(), z.array(z.string())]);
const corpoRespostas = z.object({ respostas: z.record(z.string().max(60), valorResposta) });

const semConsentimento = {
  erro: 'CONSENTIMENTO_PENDENTE',
  mensagem: 'Aceite o termo de consentimento antes de preencher o formulário',
};

function recusarLink(reply: FastifyReply, tipo: 'invalido' | 'expirado') {
  return tipo === 'invalido'
    ? reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' })
    : reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
}

function responderGravacao(reply: FastifyReply, resultado: ResultadoFormulario<ResultadoGravacao>) {
  if (resultado.tipo === 'sem_consentimento') return reply.status(409).send(semConsentimento);
  const gravacao = resultado.valor;
  switch (gravacao.tipo) {
    case 'invalido':
      return reply.status(422).send({ erro: 'RESPOSTAS_INVALIDAS', erros: gravacao.erros });
    case 'ja_enviado':
      return reply.status(409).send({
        erro: 'FORMULARIO_JA_ENVIADO',
        mensagem: 'O formulário já foi enviado; use o envio para editar',
      });
    case 'bloqueado':
      return reply.status(409).send({
        erro: gravacao.motivo === 'fechado' ? 'FORMULARIO_FECHADO' : 'REUNIAO_REALIZADA',
        mensagem: 'As respostas não podem mais ser editadas (RN-21)',
      });
    case 'gravado':
      return reply.status(200).send({ ok: true });
  }
}

const corpoRascunho = z.object({ campos: z.array(campoDeEntrada).max(100) });

/** Módulo formulario (S2-2): modelo de formulário versionado e editável (RN-15, RN-16, RN-19). */
export default function formulario(app: FastifyInstance): Promise<void> {
  app.get('/formulario/modelo', { preHandler: exigirAdmin }, (request) =>
    obterModelo(prismaDaRequisicao(app, request), usuarioDaRequisicao(request)),
  );

  app.put('/formulario/modelo/rascunho', { preHandler: exigirAdmin }, async (request, reply) => {
    const { campos } = corpoRascunho.parse(request.body);
    const resultado = await salvarRascunho(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      campos,
    );
    if (resultado.tipo === 'invalido') {
      return reply.status(422).send({ erro: 'MODELO_INVALIDO', erros: resultado.erros });
    }
    return reply.status(200).send({ ok: true });
  });

  app.post('/formulario/modelo/publicar', { preHandler: exigirAdmin }, async (request, reply) => {
    const resultado = await publicarVersao(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
    );
    switch (resultado.tipo) {
      case 'sem_alteracoes':
        return reply
          .status(422)
          .send({ erro: 'SEM_ALTERACOES', mensagem: 'Não há alterações para publicar' });
      case 'invalido':
        return reply.status(422).send({ erro: 'MODELO_INVALIDO', erros: resultado.erros });
      case 'publicada':
        return reply.status(201).send({ numero: resultado.numero });
    }
  });

  // Perguntas só deste cliente (S6-2, RN-15). Qualquer usuário cadastra cliente, então o ponto de
  // partida (campos ativos do padrão) não exige admin; editar exige admin ou responsável (RN-02).
  app.get('/formulario/padrao', { preHandler: exigirUsuario }, (request) =>
    lerCamposPadrao(prismaDaRequisicao(app, request), usuarioDaRequisicao(request).agenciaId),
  );

  app.get(
    '/onboardings/:onboardingId/formulario/personalizacao',
    { preHandler: exigirUsuario },
    (request) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      return lerPersonalizacao(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        onboardingId,
      );
    },
  );

  app.put(
    '/onboardings/:onboardingId/formulario/personalizacao',
    { preHandler: exigirUsuario },
    async (request, reply) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      const { campos } = corpoRascunho.parse(request.body);
      const r = await salvarPersonalizacao(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        onboardingId,
        campos,
      );
      switch (r.tipo) {
        case 'travada':
          return reply.status(409).send({
            erro: 'PERSONALIZACAO_TRAVADA',
            mensagem: 'O cliente já começou a responder; as perguntas não podem mais mudar (RN-15)',
          });
        case 'invalida':
          return reply.status(422).send({ erro: 'MODELO_INVALIDO', erros: r.erros });
        case 'salva':
          return reply.status(201).send(r.estado);
        case 'sem_alteracoes':
          return reply.status(200).send(r.estado);
      }
    },
  );

  // Rotas públicas (S2-3): o token da URL é a única credencial (RN-01).
  app.addHook('onSend', (request, reply, payload, feito) => {
    if (request.url.startsWith('/publico/')) void reply.header('cache-control', 'no-store');
    feito(null, payload);
  });

  app.get('/publico/onboardings/:token/formulario', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const r = await comLinkValido(app.deps.prisma, token, app.deps.relogio.agora(), (link) =>
      lerFormularioDoCliente(app.deps.prisma, link),
    );
    if (r.tipo !== 'ok') return recusarLink(reply, r.tipo);
    if (r.valor.tipo === 'sem_consentimento') return reply.status(409).send(semConsentimento);
    return r.valor.valor;
  });

  app.put('/publico/onboardings/:token/formulario/rascunho', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const { respostas } = corpoRespostas.parse(request.body);
    const r = await comLinkValido(app.deps.prisma, token, app.deps.relogio.agora(), (link) =>
      salvarRascunhoDoCliente(app.deps.prisma, link, respostas as Respostas),
    );
    if (r.tipo !== 'ok') return recusarLink(reply, r.tipo);
    return responderGravacao(reply, r.valor);
  });

  app.post('/publico/onboardings/:token/formulario/enviar', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const { respostas } = corpoRespostas.parse(request.body);
    const agora = app.deps.relogio.agora();
    const r = await comLinkValido(app.deps.prisma, token, agora, async (link) => {
      const g = await enviarFormularioDoCliente(app.deps.prisma, link, respostas, agora);
      if (g.tipo === 'ok' && g.valor.tipo === 'gravado') {
        const ator = `cliente:${link.onboardingId}`;
        await avisarEtapasMudaram(app.deps.eventos, link.agenciaId, link.onboardingId, ator, agora);
      }
      return g;
    });
    if (r.tipo !== 'ok') return recusarLink(reply, r.tipo);
    return responderGravacao(reply, r.valor);
  });

  // A agência trava as edições do cliente (RN-21).
  app.post(
    '/onboardings/:onboardingId/formulario/fechar',
    { preHandler: exigirUsuario },
    async (request) => {
      const { onboardingId } = parametrosOnboarding.parse(request.params);
      await fecharFormulario(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        onboardingId,
        app.deps.relogio.agora(),
      );
      return { ok: true };
    },
  );

  return Promise.resolve();
}
