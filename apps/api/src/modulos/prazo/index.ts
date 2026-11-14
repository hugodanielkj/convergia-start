import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import { localizarLink } from '../link/localizar-link.js';
import { recalcularPrazo, textoDaData } from './recalcular.js';

const paramsPublicos = z.object({ token: z.string().min(1).max(100) });

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

  return Promise.resolve();
}
