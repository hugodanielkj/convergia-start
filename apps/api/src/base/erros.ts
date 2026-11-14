import {
  NaoAutenticadoError,
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
} from '@convergia/core/base';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';

export interface RespostaErro {
  erro: string;
  mensagem: string;
  detalhes?: unknown;
}

/** Converte erros de domínio em respostas HTTP. Erros inesperados viram 500 sem detalhes. */
export function registrarTratamentoDeErros(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError | Error>((erro, request, reply) => {
    if (erro instanceof RegraVioladaError) {
      return reply.status(422).send({ erro: erro.codigo, mensagem: erro.message });
    }
    if (erro instanceof ZodError) {
      return reply
        .status(400)
        .send({ erro: 'VALIDACAO', mensagem: 'Dados inválidos', detalhes: z.flattenError(erro) });
    }
    if (erro instanceof NaoEncontradoError) {
      return reply.status(404).send({ erro: 'NAO_ENCONTRADO', mensagem: erro.message });
    }
    if (erro instanceof NaoAutenticadoError) {
      return reply.status(401).send({ erro: 'NAO_AUTENTICADO', mensagem: erro.message });
    }
    if (erro instanceof ProibidoError) {
      return reply.status(403).send({ erro: erro.codigo, mensagem: erro.message });
    }
    const status = 'statusCode' in erro ? erro.statusCode : undefined;
    if (typeof status === 'number' && status < 500) {
      return reply.status(status).send({ erro: 'REQUISICAO', mensagem: erro.message });
    }
    request.log.error({ err: erro }, 'erro inesperado');
    return reply.status(500).send({ erro: 'INTERNO', mensagem: 'Erro interno' });
  });
}
