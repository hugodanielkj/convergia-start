import { TIPOS_TEMPLATE, VARIAVEIS_TEMPLATE, validarTemplate } from '@convergia/core/templates';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAdmin, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import {
  listarTemplates,
  previaDoTemplate,
  restaurarTemplate,
  salvarTemplate,
} from './templates.js';

const parametros = z.object({ tipo: z.enum(TIPOS_TEMPLATE) });
const corpo = z.object({ texto: z.string().max(5000) });

/** Módulo templates (S5-1): textos das mensagens editáveis pela agência (RN-55, seção 8). */
export default function templates(app: FastifyInstance): Promise<void> {
  app.get('/templates', { preHandler: exigirAdmin }, async (request) => ({
    templates: await listarTemplates(prismaDaRequisicao(app, request)),
    variaveis: VARIAVEIS_TEMPLATE,
  }));

  app.put('/templates/:tipo', { preHandler: exigirAdmin }, async (request, reply) => {
    const { tipo } = parametros.parse(request.params);
    const { texto } = corpo.parse(request.body);
    const r = await salvarTemplate(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      tipo,
      texto,
    );
    if (r.tipo === 'invalido')
      return reply.status(422).send({ erro: 'TEMPLATE_INVALIDO', erros: r.erros });
    return { ok: true };
  });

  app.delete('/templates/:tipo', { preHandler: exigirAdmin }, async (request) => {
    const { tipo } = parametros.parse(request.params);
    await restaurarTemplate(prismaDaRequisicao(app, request), usuarioDaRequisicao(request), tipo);
    return { ok: true };
  });

  app.post('/templates/:tipo/previa', { preHandler: exigirAdmin }, (request) => {
    const { tipo } = parametros.parse(request.params);
    const { texto } = corpo.parse(request.body);
    return { previa: previaDoTemplate(tipo, texto), erros: validarTemplate(tipo, texto) };
  });

  return Promise.resolve();
}
