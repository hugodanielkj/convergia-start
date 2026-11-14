import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAdmin, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { campoDeEntrada, obterModelo, publicarVersao, salvarRascunho } from './modelo.js';

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

  return Promise.resolve();
}
