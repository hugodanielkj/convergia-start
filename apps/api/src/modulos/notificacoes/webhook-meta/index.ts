import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assinaturaValida } from './assinatura.js';
import { eventosDoPayload } from './eventos-meta.js';
import { aplicarEventosMeta } from './tratar.js';

const consulta = z.object({
  'hub.mode': z.string().optional(),
  'hub.verify_token': z.string().optional(),
  'hub.challenge': z.string().optional(),
});

/** Webhook do WhatsApp oficial (RN-61, RN-62): verificação, status de entrega e "PARAR". Público. */
export default function webhookMeta(app: FastifyInstance): Promise<void> {
  const config = app.deps.webhookWhatsapp;
  if (!config) return Promise.resolve();

  app.get('/publico/webhooks/meta-whatsapp', (request, reply) => {
    const q = consulta.parse(request.query);
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === config.verifyToken) {
      return reply.type('text/plain').send(q['hub.challenge'] ?? '');
    }
    return reply.status(403).send({ erro: 'NAO_AUTORIZADO' });
  });

  // Escopo próprio: a assinatura vale sobre o corpo cru, então o JSON chega como Buffer.
  void app.register((rota, _opcoes, pronto) => {
    rota.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, corpo, feito) => {
      feito(null, corpo);
    });
    rota.post('/publico/webhooks/meta-whatsapp', async (request, reply) => {
      const cru = request.body;
      const cabecalho = request.headers['x-hub-signature-256'];
      if (
        !Buffer.isBuffer(cru) ||
        !assinaturaValida(
          cru,
          typeof cabecalho === 'string' ? cabecalho : undefined,
          config.appSecret,
        )
      ) {
        return reply.status(401).send({ erro: 'ASSINATURA_INVALIDA' });
      }
      let payload: unknown;
      try {
        payload = JSON.parse(cru.toString('utf8'));
      } catch {
        return reply.status(400).send({ erro: 'CORPO_INVALIDO' });
      }
      const { prisma, eventos, relogio } = app.deps;
      await aplicarEventosMeta(prisma, eventos, eventosDoPayload(payload), relogio.agora());
      return { ok: true };
    });
    pronto();
  });
  return Promise.resolve();
}
