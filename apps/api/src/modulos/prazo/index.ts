import { NaoEncontradoError } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import { localizarLink } from '../link/localizar-link.js';
import { ajustarPrazo } from './ajustar.js';
import { prazosDosOnboardings } from './consultar.js';
import { recalcularPrazo, textoDaData } from './recalcular.js';

const paramsPublicos = z.object({ token: z.string().min(1).max(100) });
const paramsOnboarding = z.object({ id: z.string().min(1).max(64) });
// Os limites só barram entradas absurdas; as regras do ajuste são do core (RN-47).
const corpoAjuste = z.object({ data: z.string().max(10), justificativa: z.string().max(2000) });

/**
 * Módulo prazo (S4-5): calcula a data de liberação dos primeiros conteúdos quando a captação é
 * agendada e recalcula quando ela muda de dia, é cancelada ou o cliente não comparece
 * (RN-43 a RN-46). Reage aos eventos da agenda; não é chamado por ela.
 */
export default function prazo(app: FastifyInstance): Promise<void> {
  const { eventos, prisma, relogio } = app.deps;

  const aoMudarCaptacao = async (evento: {
    agenciaId: string;
    dados: { onboardingId: string; tipo: 'reuniao' | 'captacao' };
  }): Promise<void> => {
    if (evento.dados.tipo !== 'captacao') return;
    await recalcularPrazo(
      prisma,
      eventos,
      evento.agenciaId,
      evento.dados.onboardingId,
      relogio.agora(),
    );
  };
  eventos.assinar('agendamento.criado', aoMudarCaptacao);
  eventos.assinar('agendamento.reagendado', aoMudarCaptacao);
  eventos.assinar('agendamento.cancelado', aoMudarCaptacao);
  eventos.assinar('agendamento.nao_compareceu', aoMudarCaptacao);

  // Página do cliente (RN-45): o prazo só aparece depois que a captação foi agendada.
  app.get('/publico/onboardings/:token/prazo', async (request, reply) => {
    const { token } = paramsPublicos.parse(request.params);
    void reply.header('cache-control', 'no-store');
    const link = await localizarLink(prisma, token, relogio.agora());
    if (link.situacao === 'invalido') {
      return reply.status(404).send({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
    if (link.situacao === 'expirado') {
      return reply.status(410).send({ erro: 'LINK_EXPIRADO', mensagem: 'Este link expirou' });
    }
    const { agenciaId, onboardingId } = link.link;
    const registro = await escopoAgencia(prisma, agenciaId).prazoLiberacao.findUnique({
      where: { onboardingId },
      select: { data: true },
    });
    return registro ? { definido: true, data: textoDaData(registro.data) } : { definido: false };
  });

  // Agência: prazo e indicador do onboarding (RN-48) e ajuste manual com justificativa (RN-47).
  app.get('/onboardings/:id/prazo', { preHandler: exigirUsuario }, async (request) => {
    const { id } = paramsOnboarding.parse(request.params);
    const usuario = usuarioDaRequisicao(request);
    const banco = prismaDaRequisicao(app, request);
    const onboarding = await banco.onboarding.findUnique({
      where: { id },
      select: { id: true, statusGeral: true, responsavelId: true },
    });
    // Membro só vê os seus (RN-02); o que não pode ver responde como inexistente.
    if (!onboarding || (usuario.papel !== 'admin' && onboarding.responsavelId !== usuario.id)) {
      throw new NaoEncontradoError('Onboarding');
    }
    const prazo = (
      await prazosDosOnboardings(banco, usuario.agenciaId, [onboarding], relogio.agora())
    ).get(id);
    return prazo ? { definido: true, ...prazo } : { definido: false };
  });

  app.post('/onboardings/:id/prazo/ajuste', { preHandler: exigirUsuario }, async (request) => {
    const { id } = paramsOnboarding.parse(request.params);
    const corpo = corpoAjuste.parse(request.body);
    return ajustarPrazo(
      prismaDaRequisicao(app, request),
      eventos,
      usuarioDaRequisicao(request),
      id,
      corpo,
      relogio.agora(),
    );
  });

  return Promise.resolve();
}
