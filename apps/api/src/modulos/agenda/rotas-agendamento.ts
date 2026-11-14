import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fusoValido } from '@convergia/core/base';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { localizarLink } from '../link/localizar-link.js';
import { mudarStatusDoAgendamento, type AcaoDaAgencia } from './acoes-agendamento.js';
import { listarAgendamentosDoCliente, reagendarAgendamento } from './reagendar.js';

const idDaRota = z.string().min(1).max(64);
const paramsDoCliente = z.object({ token: z.string().min(1).max(100), id: idDaRota.optional() });
const corpoReagendar = z.object({
  inicio: z.iso.datetime(),
  fuso: z.string().max(64).refine(fusoValido, 'Fuso inválido').optional(),
});
const corpoCancelar = z.object({ motivo: z.string().trim().min(1).max(200) });

const MENSAGEM_NEGADO = {
  limite_atingido: 'Você não pode mais reagendar por aqui. Entre em contato com a agência.',
  prazo_encerrado: 'Já é tarde demais para reagendar por aqui. Entre em contato com a agência.',
  status_invalido: 'Este agendamento não pode ser reagendado. Entre em contato com a agência.',
  mesmo_horario: 'Escolha um horário diferente do atual.',
} as const;

/**
 * Reagendamento pelo cliente (S3-5, RN-35, RN-36) e ações da agência sobre o agendamento
 * (cancelar, realizado, não compareceu: RN-36, RN-37).
 */
export function registrarRotasAgendamento(app: FastifyInstance): void {
  // Rotas públicas: o token do link é a única credencial e só alcança o próprio onboarding (RN-13).
  async function comLinkValido(token: string) {
    const link = await localizarLink(app.deps.prisma, token, app.deps.relogio.agora());
    return link.situacao === 'valido'
      ? { ok: true as const, link: link.link }
      : { ok: false as const, situacao: link.situacao };
  }

  app.get('/publico/onboardings/:token/agendamentos', async (request, reply) => {
    const { token } = paramsDoCliente.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const valido = await comLinkValido(token);
    if (!valido.ok) {
      return valido.situacao === 'expirado'
        ? reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' })
        : reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
    return {
      agendamentos: await listarAgendamentosDoCliente(
        app.deps.prisma,
        valido.link,
        app.deps.relogio.agora(),
      ),
    };
  });

  app.post('/publico/onboardings/:token/agendamentos/:id/reagendar', async (request, reply) => {
    const { token, id } = paramsDoCliente.parse(request.params);
    const corpo = corpoReagendar.parse(request.body);
    void reply.header('cache-control', 'no-store');
    const valido = await comLinkValido(token);
    if (!valido.ok) {
      return valido.situacao === 'expirado'
        ? reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' })
        : reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }

    const resultado = await reagendarAgendamento(
      app.deps.prisma,
      app.deps.eventos,
      valido.link,
      idDaRota.parse(id),
      { inicio: new Date(corpo.inicio), fuso: corpo.fuso },
      app.deps.relogio.agora(),
    );
    switch (resultado.tipo) {
      case 'reagendado':
        return { agendamento: resultado.agendamento };
      case 'negado':
        return reply.status(422).send({
          erro: 'REAGENDAMENTO_NEGADO',
          motivo: resultado.motivo,
          mensagem: MENSAGEM_NEGADO[resultado.motivo],
        });
      case 'indisponivel':
        return reply.status(409).send({
          erro: 'SLOT_INDISPONIVEL',
          mensagem: 'Este horário acabou de ser reservado. Escolha outro.',
          ...resultado.lista,
        });
      case 'nao_encontrado':
        return reply
          .status(404)
          .send({ erro: 'AGENDAMENTO_NAO_ENCONTRADO', mensagem: 'Agendamento não encontrado' });
    }
  });

  // Ações da agência: Admin ou responsável pelo onboarding (RN-02).
  const acoes: readonly { caminho: string; acao: AcaoDaAgencia }[] = [
    { caminho: 'cancelar', acao: 'cancelar' },
    { caminho: 'realizado', acao: 'realizado' },
    { caminho: 'nao-compareceu', acao: 'nao_compareceu' },
  ];
  for (const { caminho, acao } of acoes) {
    app.post(`/agendamentos/:id/${caminho}`, { preHandler: exigirUsuario }, async (request) => {
      const { id } = z.object({ id: idDaRota }).parse(request.params);
      const motivo = acao === 'cancelar' ? corpoCancelar.parse(request.body).motivo : undefined;
      const resultado = await mudarStatusDoAgendamento(
        prismaDaRequisicao(app, request),
        app.deps.eventos,
        usuarioDaRequisicao(request),
        id,
        acao,
        motivo,
        app.deps.relogio.agora(),
      );
      return { agendamento: resultado };
    });
  }
}
