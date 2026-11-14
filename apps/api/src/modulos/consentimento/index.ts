import { TERMO_ATUAL } from '@convergia/core/consentimento';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  aceiteDoCliente,
  aceitarTermo,
  comLinkValido,
  registrarPrimeiroAcesso,
} from './consentimento.js';

const parametrosToken = z.object({ token: z.string().min(1).max(100) });
const corpoAceite = z.object({ versao: z.string().min(1).max(40) });

/** Respostas de link que não vale; iguais às da consulta pública do módulo link. */
function recusarLink(reply: FastifyReply, tipo: 'invalido' | 'expirado') {
  return tipo === 'invalido'
    ? reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' })
    : reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
}

/**
 * Módulo consentimento (S2-1): primeira abertura do link (RN-50) e aceite do termo (RN-72).
 * Rotas públicas, sem login (RN-01): o token da URL é a única credencial.
 */
export default function consentimento(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', (_request, reply, payload, feito) => {
    // A URL carrega a credencial: nada de guardar a resposta em cache.
    void reply.header('cache-control', 'no-store');
    feito(null, payload);
  });

  app.post('/publico/onboardings/:token/abrir', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const resultado = await comLinkValido(
      app.deps.prisma,
      token,
      app.deps.relogio.agora(),
      (link) =>
        registrarPrimeiroAcesso(app.deps.prisma, app.deps.eventos, link, app.deps.relogio.agora()),
    );
    if (resultado.tipo !== 'ok') return recusarLink(reply, resultado.tipo);
    return { primeiroAcesso: resultado.valor };
  });

  app.get('/publico/onboardings/:token/consentimento', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const resultado = await comLinkValido(
      app.deps.prisma,
      token,
      app.deps.relogio.agora(),
      (link) => aceiteDoCliente(app.deps.prisma, link, TERMO_ATUAL.versao),
    );
    if (resultado.tipo !== 'ok') return recusarLink(reply, resultado.tipo);
    return {
      termo: { versao: TERMO_ATUAL.versao, texto: TERMO_ATUAL.texto },
      aceitoEm: resultado.valor,
    };
  });

  app.post('/publico/onboardings/:token/consentimento', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    const { versao } = corpoAceite.parse(request.body);
    const resultado = await comLinkValido(
      app.deps.prisma,
      token,
      app.deps.relogio.agora(),
      (link) => aceitarTermo(app.deps.prisma, link, versao, app.deps.relogio.agora()),
    );
    if (resultado.tipo !== 'ok') return recusarLink(reply, resultado.tipo);
    switch (resultado.valor) {
      case 'termo_desatualizado':
        return reply.status(409).send({
          erro: 'TERMO_DESATUALIZADO',
          mensagem: 'O termo mudou. Recarregue a página para ler a versão atual.',
        });
      case 'ja_aceito':
        return reply.status(200).send({ aceito: true });
      case 'registrado':
        return reply.status(201).send({ aceito: true });
    }
  });

  return Promise.resolve();
}
