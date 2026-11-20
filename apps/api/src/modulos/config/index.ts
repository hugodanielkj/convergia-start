import { LIMITES_CONFIG_GERAL, NOME_AGENCIA_MAX } from '@convergia/core/config';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAdmin, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { lerConfigGeral, salvarConfigGeral } from './config-geral.js';

// A forma vem do Zod; os limites de cada campo, de `core/config` (validados no caso de uso).
const numero = z.number();
const esquemaConfigGeral = z.object({
  nomeAgencia: z.string().max(200),
  canalNotificacaoPadrao: z.enum(['whatsapp', 'email']),
  prazoProducaoDiasUteis: numero,
  validadeLinkDias: numero,
  antecedenciaMinimaHoras: numero,
  intervaloReuniaoCaptacaoDiasMin: numero,
  limiteReagendamentos: numero,
  antecedenciaReagendamentoHoras: numero,
  duracaoReuniaoMinutos: numero,
  duracaoCaptacaoMinutos: numero,
  diasSemAcaoParaAlerta: numero,
  intervaloMinimoReenvioHoras: numero,
  diasConclusaoAutomatica: numero,
});

/** Módulo config (S8-2): Configurações › Geral da agência (RN-03, D-09). */
export default function config(app: FastifyInstance): Promise<void> {
  app.get('/config/geral', { preHandler: exigirAdmin }, async (request) => ({
    config: await lerConfigGeral(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request).agenciaId,
    ),
    // A tela usa os mesmos limites nos campos, sem duplicar a regra.
    limites: LIMITES_CONFIG_GERAL,
    nomeMax: NOME_AGENCIA_MAX,
  }));

  app.put('/config/geral', { preHandler: exigirAdmin }, async (request, reply) => {
    const r = await salvarConfigGeral(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      esquemaConfigGeral.parse(request.body),
    );
    if (!r.ok) return reply.status(422).send({ erro: 'RN-03', erros: r.erros });
    return { config: r.config };
  });

  return Promise.resolve();
}
