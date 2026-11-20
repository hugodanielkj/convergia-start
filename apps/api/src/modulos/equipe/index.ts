import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAdmin, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import {
  EmailEmUsoError,
  cadastrarPessoa,
  desativarPessoa,
  editarPessoa,
  listarEquipe,
  listarResponsaveis,
  reativarPessoa,
  trocarResponsavel,
} from './equipe.js';

const papel = z.enum(['admin', 'membro']);
const id = z.object({ id: z.string().min(1).max(64) });
const esquemaNova = z.object({
  nome: z.string().max(200),
  email: z.string().max(320),
  papel,
});
const esquemaEdicao = z.object({ nome: z.string().max(200), papel });
const esquemaDesativar = z.object({ novoResponsavelId: z.string().min(1).max(64).optional() });
const esquemaResponsavel = z.object({ responsavelId: z.string().min(1).max(64) });

/** Módulo equipe (S8-1): cadastro, papel, desativação e responsável do onboarding (RN-03, RN-08). */
export default function equipe(app: FastifyInstance): Promise<void> {
  const ctx = (request: Parameters<typeof prismaDaRequisicao>[1]) => ({
    prisma: prismaDaRequisicao(app, request),
    usuario: usuarioDaRequisicao(request),
  });

  app.get('/equipe', { preHandler: exigirAdmin }, async (request) => ({
    pessoas: await listarEquipe(prismaDaRequisicao(app, request)),
  }));

  app.get('/equipe/responsaveis', { preHandler: exigirAdmin }, async (request) => ({
    responsaveis: await listarResponsaveis(prismaDaRequisicao(app, request)),
  }));

  app.post('/equipe', { preHandler: exigirAdmin }, async (request, reply) => {
    const dados = esquemaNova.parse(request.body);
    const { prisma, usuario } = ctx(request);
    try {
      const pessoa = await cadastrarPessoa(prisma, app.deps.prisma, usuario, dados);
      return await reply.status(201).send({ pessoa });
    } catch (erro) {
      if (erro instanceof EmailEmUsoError) {
        return reply
          .status(409)
          .send({ erro: 'EMAIL_EM_USO', mensagem: 'Este e-mail já está cadastrado' });
      }
      throw erro;
    }
  });

  app.patch('/equipe/:id', { preHandler: exigirAdmin }, async (request) => {
    const { prisma, usuario } = ctx(request);
    await editarPessoa(
      prisma,
      usuario,
      id.parse(request.params).id,
      esquemaEdicao.parse(request.body),
    );
    return { ok: true };
  });

  app.post('/equipe/:id/desativar', { preHandler: exigirAdmin }, async (request) => {
    const { prisma, usuario } = ctx(request);
    const { novoResponsavelId } = esquemaDesativar.parse(request.body ?? {});
    return desativarPessoa(prisma, usuario, id.parse(request.params).id, novoResponsavelId);
  });

  app.post('/equipe/:id/reativar', { preHandler: exigirAdmin }, async (request) => {
    const { prisma, usuario } = ctx(request);
    await reativarPessoa(prisma, usuario, id.parse(request.params).id);
    return { ok: true };
  });

  app.put('/onboardings/:id/responsavel', { preHandler: exigirAdmin }, async (request) => {
    const { prisma, usuario } = ctx(request);
    const { responsavelId } = esquemaResponsavel.parse(request.body);
    await trocarResponsavel(prisma, usuario, id.parse(request.params).id, responsavelId);
    return { ok: true };
  });

  return Promise.resolve();
}
