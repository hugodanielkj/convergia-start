import { FUSO_PADRAO } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';

/**
 * Exemplo do formato de módulo: cada pasta em src/modulos tem um index.ts que exporta
 * um plugin Fastify. O autoload registra todos; não há arquivo central de rotas (D-24).
 */
export default function saude(app: FastifyInstance): Promise<void> {
  app.get('/health', () => ({ status: 'ok', fuso: FUSO_PADRAO }));
  return Promise.resolve();
}
