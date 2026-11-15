import type { FastifyInstance } from 'fastify';
import { exigirAdmin, prismaDaRequisicao, usuarioDaRequisicao } from '../../../base/auth.js';
import { esquemaConfigLembretes, lerConfigLembretes, salvarConfigLembretes } from './config.js';
import { varrerCompromissos, varrerPendencias, type DepsLembretes } from './varrer.js';

/** De quanto em quanto tempo o worker procura lembretes vencidos. */
const INTERVALO_DO_WORKER_S = 60;

function ligarWorker(app: FastifyInstance): void {
  const deps: DepsLembretes = {
    prisma: app.deps.prisma,
    eventos: app.deps.eventos,
    urlApp: app.deps.auth.urlApp,
    chaveLink: app.deps.chaveLink,
  };
  let emAndamento = false;
  async function rodar(): Promise<void> {
    if (emAndamento) return;
    emAndamento = true;
    try {
      const agora = app.deps.relogio.agora();
      await varrerPendencias(deps, agora);
      await varrerCompromissos(deps, agora);
    } catch (erro) {
      app.log.error({ err: erro }, 'falha ao procurar lembretes');
    } finally {
      emAndamento = false;
    }
  }
  const relogioDoWorker = setInterval(() => void rodar(), INTERVALO_DO_WORKER_S * 1000);
  relogioDoWorker.unref();
  app.addHook('onClose', () => {
    clearInterval(relogioDoWorker);
    return Promise.resolve();
  });
}

/** Módulo notificacoes/lembretes (S5-3): pendência, compromisso e janela de envio (RN-56, RN-57, RN-59). */
export default function lembretes(app: FastifyInstance): Promise<void> {
  app.get('/config/lembretes', { preHandler: exigirAdmin }, async (request) => ({
    config: await lerConfigLembretes(prismaDaRequisicao(app, request)),
  }));

  app.put('/config/lembretes', { preHandler: exigirAdmin }, async (request, reply) => {
    const config = esquemaConfigLembretes.parse(request.body);
    const erro = await salvarConfigLembretes(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      config,
    );
    if (erro) return reply.status(422).send({ erro: 'RN-59', motivo: erro });
    return { config };
  });

  ligarWorker(app);
  return Promise.resolve();
}
