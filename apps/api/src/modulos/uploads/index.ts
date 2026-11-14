import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { configDeUpload, receberArquivo } from './receber-arquivo.js';

const parametrosCliente = z.object({ clienteId: z.string().min(1).max(64) });
const parametrosArquivo = z.object({ id: z.string().min(1).max(64) });

const MB = 1024 * 1024;

/** Módulo uploads (S2-4): envio com validação no servidor (RN-20) e download pela agência. */
export default async function uploads(app: FastifyInstance): Promise<void> {
  // Teto absoluto do parser; o limite de verdade é o da agência, aplicado em cada envio.
  await app.register(multipart, { limits: { files: 1, fields: 5, fileSize: 100 * MB } });

  app.post(
    '/clientes/:clienteId/arquivos',
    { preHandler: exigirUsuario },
    async (request, reply) => {
      const { clienteId } = parametrosCliente.parse(request.params);
      const prisma = prismaDaRequisicao(app, request);
      const config = await configDeUpload(prisma);
      if (!request.isMultipart()) {
        return reply.status(400).send({ erro: 'SEM_ARQUIVO', mensagem: 'Nenhum arquivo enviado' });
      }

      const parte = await request.file({ limits: { fileSize: config.tamanhoMaxMb * MB } });
      if (!parte) {
        return reply.status(400).send({ erro: 'SEM_ARQUIVO', mensagem: 'Nenhum arquivo enviado' });
      }
      // toBuffer lança se passar do limite; o conteúdo não é guardado nesse caso.
      const conteudo = await parte.toBuffer().catch((erro: unknown) => {
        if (parte.file.truncated) return null;
        throw erro;
      });
      if (conteudo === null) {
        return reply
          .status(413)
          .send({ erro: 'grande_demais', mensagem: 'Arquivo acima do limite' });
      }

      const resultado = await receberArquivo(
        prisma,
        app.deps.armazenamento,
        usuarioDaRequisicao(request),
        { clienteId, nome: parte.filename, tipoDeclarado: parte.mimetype, conteudo },
        config,
      );
      if (resultado.tipo === 'recusado') {
        const status = resultado.erro === 'grande_demais' ? 413 : 422;
        return reply.status(status).send({ erro: resultado.erro, regra: 'RN-20' });
      }
      return reply.status(201).send({ arquivo: resultado.arquivo });
    },
  );

  app.get('/arquivos/:id', { preHandler: exigirUsuario }, async (request, reply) => {
    const { id } = parametrosArquivo.parse(request.params);
    const arquivo = await prismaDaRequisicao(app, request).arquivo.findFirst({ where: { id } });
    const conteudo = arquivo ? await app.deps.armazenamento.ler(arquivo.chave) : null;
    if (!arquivo || !conteudo) {
      return reply.status(404).send({ erro: 'NAO_ENCONTRADO', mensagem: 'Arquivo não encontrado' });
    }
    return reply
      .header('content-type', arquivo.tipo)
      .header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nomeOriginal)}`,
      )
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'private, no-store')
      .send(Buffer.from(conteudo));
  });
}
