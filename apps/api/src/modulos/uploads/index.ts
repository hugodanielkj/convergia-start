import multipart from '@fastify/multipart';
import { TERMO_ATUAL } from '@convergia/core/consentimento';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { escopoAgencia, type PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { aceiteDoCliente, comLinkValido } from '../consentimento/consentimento.js';
import { configDeUpload, receberArquivo, type AutorUpload } from './receber-arquivo.js';

const parametrosCliente = z.object({ clienteId: z.string().min(1).max(64) });
const parametrosArquivo = z.object({ id: z.string().min(1).max(64) });
const parametrosToken = z.object({ token: z.string().min(1).max(100) });

const MB = 1024 * 1024;

interface Resposta {
  readonly status: number;
  readonly corpo: unknown;
}

const semArquivo: Resposta = {
  status: 400,
  corpo: { erro: 'SEM_ARQUIVO', mensagem: 'Nenhum arquivo enviado' },
};

/** Lê o arquivo da requisição, valida (RN-20) e guarda. Usado pela agência e pelo cliente. */
async function tratarEnvio(
  app: FastifyInstance,
  request: FastifyRequest,
  prisma: PrismaDaAgencia,
  clienteId: string,
  autor: AutorUpload,
): Promise<Resposta> {
  const config = await configDeUpload(prisma);
  if (!request.isMultipart()) return semArquivo;

  const parte = await request.file({ limits: { fileSize: config.tamanhoMaxMb * MB } });
  if (!parte) return semArquivo;
  // toBuffer lança se passar do limite; o conteúdo não é guardado nesse caso.
  const conteudo = await parte.toBuffer().catch((erro: unknown) => {
    if (parte.file.truncated) return null;
    throw erro;
  });
  if (conteudo === null) {
    return {
      status: 413,
      corpo: { erro: 'grande_demais', mensagem: 'Arquivo acima do limite', regra: 'RN-20' },
    };
  }

  const resultado = await receberArquivo(
    prisma,
    app.deps.armazenamento,
    autor,
    { clienteId, nome: parte.filename, tipoDeclarado: parte.mimetype, conteudo },
    config,
  );
  if (resultado.tipo === 'recusado') {
    const status = resultado.erro === 'grande_demais' ? 413 : 422;
    return { status, corpo: { erro: resultado.erro, regra: 'RN-20' } };
  }
  return { status: 201, corpo: { arquivo: resultado.arquivo } };
}

/** Módulo uploads (S2-4): envio com validação no servidor (RN-20) e download pela agência. */
export default async function uploads(app: FastifyInstance): Promise<void> {
  // Teto absoluto do parser; o limite de verdade é o da agência, aplicado em cada envio.
  await app.register(multipart, { limits: { files: 1, fields: 5, fileSize: 100 * MB } });

  app.post(
    '/clientes/:clienteId/arquivos',
    { preHandler: exigirUsuario },
    async (request, reply) => {
      const { clienteId } = parametrosCliente.parse(request.params);
      const usuario = usuarioDaRequisicao(request);
      const { status, corpo } = await tratarEnvio(
        app,
        request,
        prismaDaRequisicao(app, request),
        clienteId,
        { agenciaId: usuario.agenciaId, ator: `usuario:${usuario.id}` },
      );
      return reply.status(status).send(corpo);
    },
  );

  // Rota pública (S2-3): o cliente envia logo e manual pelo link, só depois de aceitar o termo.
  app.post('/publico/onboardings/:token/arquivos', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const resultado = await comLinkValido(
      app.deps.prisma,
      token,
      app.deps.relogio.agora(),
      async (link): Promise<Resposta> => {
        if ((await aceiteDoCliente(app.deps.prisma, link, TERMO_ATUAL.versao)) === null) {
          return {
            status: 409,
            corpo: { erro: 'CONSENTIMENTO_PENDENTE', mensagem: 'Aceite o termo antes de enviar' },
          };
        }
        const onboarding = await app.deps.prisma.onboarding.findUniqueOrThrow({
          where: { id: link.onboardingId },
          select: { clienteId: true },
        });
        return tratarEnvio(
          app,
          request,
          escopoAgencia(app.deps.prisma, link.agenciaId),
          onboarding.clienteId,
          { agenciaId: link.agenciaId, ator: `cliente:${link.onboardingId}` },
        );
      },
    );
    if (resultado.tipo === 'invalido') {
      return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
    if (resultado.tipo === 'expirado') {
      return reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
    }
    return reply.status(resultado.valor.status).send(resultado.valor.corpo);
  });

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
