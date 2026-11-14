import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { consultarOptOut, pararLembretes } from './opt-out.js';
import { processarPendentes } from './processar.js';

const parametrosToken = z.object({ token: z.string().min(1).max(100) });

/** De quanto em quanto tempo o worker procura mensagens pendentes (retentativas e perdas). */
const INTERVALO_DO_WORKER_S = 30;
const LOTE = 20;

function ligarWorker(app: FastifyInstance): void {
  const { prisma, mensageria, eventos, relogio } = app.deps;
  let emAndamento = false;
  let pedidos = 0;
  async function rodar(): Promise<void> {
    pedidos += 1;
    if (emAndamento) return;
    emAndamento = true;
    try {
      let atendidos: number;
      do {
        atendidos = pedidos;
        let processadas: number;
        do {
          processadas = await processarPendentes(
            prisma,
            mensageria,
            eventos,
            relogio.agora(),
            LOTE,
          );
        } while (processadas >= LOTE);
      } while (pedidos !== atendidos);
    } catch (erro) {
      app.log.error({ err: erro }, 'falha no envio de notificações');
    } finally {
      emAndamento = false;
    }
  }
  eventos.assinar('notificacao.enfileirada', () => {
    void rodar();
    return Promise.resolve();
  });
  const relogioDoWorker = setInterval(() => void rodar(), INTERVALO_DO_WORKER_S * 1000);
  relogioDoWorker.unref();
  app.addHook('onClose', () => {
    clearInterval(relogioDoWorker);
    return Promise.resolve();
  });
}

/** Módulo notificacoes/envio (S5-2): fila de mensagens, worker e opt-out de lembretes (RN-60 a RN-62). */
export default function envio(app: FastifyInstance): Promise<void> {
  app.get('/publico/lembretes/:token', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const r = await consultarOptOut(app.deps.prisma, token);
    if (r.tipo === 'invalido')
      return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    return { empresa: r.empresa, desativado: r.desativado };
  });

  app.post('/publico/lembretes/:token/parar', async (request, reply) => {
    const { token } = parametrosToken.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const ok = await pararLembretes(app.deps.prisma, token, app.deps.relogio.agora());
    if (!ok) return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    return { desativado: true };
  });

  ligarWorker(app);
  return Promise.resolve();
}
