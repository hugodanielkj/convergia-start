import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../../base/auth.js';
import { contarAvisosAbertos, listarAvisos, resolverAviso } from './consultar.js';
import { enviarEmailsPendentes } from './email.js';
import { assinarEventosDeAlerta } from './eventos.js';
import { varrerLembretesEsgotados, varrerPrazos, varrerSemAcao } from './varrer.js';

const INTERVALO_EMAIL_S = 30;
const INTERVALO_VARREDURA_S = 15 * 60;
const LOTE = 20;

const consulta = z.object({ situacao: z.enum(['abertos', 'resolvidos']).default('abertos') });
const parametros = z.object({ id: z.string().min(1).max(64) });

/** Roda `tarefa` de tempos em tempos, uma de cada vez, e para quando a API fecha. */
function repetir(
  app: FastifyInstance,
  segundos: number,
  nome: string,
  tarefa: () => Promise<void>,
) {
  let emAndamento = false;
  const relogio = setInterval(() => {
    if (emAndamento) return;
    emAndamento = true;
    tarefa()
      .catch((erro: unknown) => {
        app.log.error({ err: erro }, nome);
      })
      .finally(() => {
        emAndamento = false;
      });
  }, segundos * 1000);
  relogio.unref();
  app.addHook('onClose', () => {
    clearInterval(relogio);
    return Promise.resolve();
  });
}

/** Módulo notificacoes/alertas (S5-4): avisos internos no painel e por e-mail (RN-58). */
export default function alertas(app: FastifyInstance): Promise<void> {
  app.get('/alertas', { preHandler: exigirUsuario }, async (request) => {
    const { situacao } = consulta.parse(request.query);
    return {
      avisos: await listarAvisos(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        situacao,
      ),
    };
  });

  app.get('/alertas/contagem', { preHandler: exigirUsuario }, async (request) => ({
    abertos: await contarAvisosAbertos(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
    ),
  }));

  app.post('/alertas/:id/resolver', { preHandler: exigirUsuario }, async (request) => {
    const { id } = parametros.parse(request.params);
    await resolverAviso(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      id,
      app.deps.relogio.agora(),
    );
    return { ok: true };
  });

  assinarEventosDeAlerta(app);
  const { prisma, mensageria, relogio } = app.deps;
  repetir(app, INTERVALO_EMAIL_S, 'falha no e-mail de avisos', async () => {
    let feitos: number;
    do {
      feitos = await enviarEmailsPendentes(
        prisma,
        mensageria,
        app.deps.auth.urlApp,
        relogio.agora(),
        LOTE,
      );
    } while (feitos >= LOTE);
  });
  repetir(app, INTERVALO_VARREDURA_S, 'falha ao procurar avisos', async () => {
    const agora = relogio.agora();
    await varrerSemAcao(prisma, agora);
    await varrerLembretesEsgotados(prisma, agora);
    await varrerPrazos(prisma, agora);
  });
  return Promise.resolve();
}
