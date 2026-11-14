import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  exigirAdmin,
  exigirUsuario,
  prismaDaRequisicao,
  usuarioDaRequisicao,
} from '../../base/auth.js';
import { listarAuditoriaDoOnboarding } from './auditoria.js';
import { excluirDadosDoCliente } from './excluir.js';
import { exportarDadosDoCliente } from './exportar.js';

const parametrosOnboarding = z.object({ id: z.string().min(1).max(64) });
const parametrosCliente = z.object({ clienteId: z.string().min(1).max(64) });
const filtrosAuditoria = z.object({
  de: z.iso.datetime({ offset: true }).optional(),
  ate: z.iso.datetime({ offset: true }).optional(),
  acao: z
    .string()
    .regex(/^[a-z_.]+$/)
    .max(60)
    .optional(),
  limite: z.coerce.number().int().min(1).max(500).default(200),
});
const corpoExclusao = z.object({ confirmacao: z.string().max(200) });

const data = (iso: string | undefined) => (iso ? new Date(iso) : undefined);

/** Módulo lgpd (S4-3): auditoria consultável, exportação e exclusão dos dados (RN-73, RN-77). */
export default function lgpd(app: FastifyInstance): Promise<void> {
  app.get('/onboardings/:id/auditoria', { preHandler: exigirUsuario }, async (request) => {
    const { id } = parametrosOnboarding.parse(request.params);
    const f = filtrosAuditoria.parse(request.query);
    const itens = await listarAuditoriaDoOnboarding(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      id,
      { de: data(f.de), ate: data(f.ate), acao: f.acao, limite: f.limite },
    );
    return { itens };
  });

  app.get(
    '/clientes/:clienteId/exportacao',
    { preHandler: exigirAdmin },
    async (request, reply) => {
      const { clienteId } = parametrosCliente.parse(request.params);
      const { nomeArquivo, conteudo } = await exportarDadosDoCliente(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        clienteId,
        app.deps.relogio.agora(),
      );
      return reply
        .header('content-disposition', `attachment; filename="${nomeArquivo}"`)
        .header('cache-control', 'private, no-store')
        .send(conteudo);
    },
  );

  app.post('/clientes/:clienteId/exclusao', { preHandler: exigirAdmin }, async (request) => {
    const { clienteId } = parametrosCliente.parse(request.params);
    const { confirmacao } = corpoExclusao.parse(request.body);
    return excluirDadosDoCliente(
      prismaDaRequisicao(app, request),
      app.deps.armazenamento,
      app.deps.eventos,
      usuarioDaRequisicao(request),
      clienteId,
      confirmacao,
      app.deps.relogio.agora(),
    );
  });

  return Promise.resolve();
}
