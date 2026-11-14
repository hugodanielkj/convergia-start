import type { FastifyInstance } from 'fastify';
import { processarPendentes } from './sincronizar-calendario.js';

/** De quanto em quanto tempo o worker procura agendamentos pendentes (retentativas e perdas de evento). */
const INTERVALO_DO_WORKER_S = 30;
/** Quantas pendências cada rodada pega; se o lote vier cheio, há mais esperando e a rodada continua. */
const LOTE = 20;

/**
 * Liga a sincronização com o calendário (RN-34, RN-67): reage na hora a agendamentos criados,
 * reagendados e cancelados e varre as pendências de tempos em tempos, o que cobre as retentativas
 * e um processo que caiu no meio. Sem calendário configurado não faz nada: o agendamento fica
 * pendente e é enviado quando houver credenciais.
 */
export function ligarSincronizacaoDoCalendario(app: FastifyInstance): void {
  const { calendario, eventos, prisma, relogio } = app.deps;
  if (calendario === null) return;
  const ativo = calendario; // a checagem acima não vale dentro das funções abaixo

  let emAndamento = false;
  // Cada chamada durante uma rodada soma um pedido; se chegou algum, roda mais uma vez, sem empilhar.
  let pedidos = 0;
  async function rodar(): Promise<void> {
    pedidos += 1;
    if (emAndamento) return;
    emAndamento = true;
    try {
      let atendidos: number;
      do {
        atendidos = pedidos;
        let processados: number;
        do {
          processados = await processarPendentes(prisma, ativo, eventos, relogio.agora(), LOTE);
        } while (processados >= LOTE);
      } while (pedidos !== atendidos);
    } catch (erro) {
      app.log.error({ err: erro }, 'falha ao sincronizar o calendário');
    } finally {
      emAndamento = false;
    }
  }

  const aoMudar = (): Promise<void> => {
    void rodar();
    return Promise.resolve();
  };
  eventos.assinar('agendamento.criado', aoMudar);
  eventos.assinar('agendamento.reagendado', aoMudar);
  eventos.assinar('agendamento.cancelado', aoMudar);

  const relogioDoWorker = setInterval(() => void rodar(), INTERVALO_DO_WORKER_S * 1000);
  relogioDoWorker.unref();
  app.addHook('onClose', () => {
    clearInterval(relogioDoWorker);
    return Promise.resolve();
  });
}
