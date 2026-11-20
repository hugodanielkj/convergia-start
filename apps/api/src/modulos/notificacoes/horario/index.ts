import { dataNaMensagem, horaNaMensagem } from '@convergia/core/lembretes';
import { onboardingAtivo } from '@convergia/core/onboarding';
import { preencherTemplate } from '@convergia/core/templates';
import type { FastifyInstance } from 'fastify';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import { linkAtual, urlDoLink } from '../../link/link-atual.js';
import { textoDoTemplate } from '../../templates/templates.js';
import { enfileirarNotificacao } from '../envio/enfileirar.js';
import { valoresDoOnboarding } from '../lembretes/varrer.js';

const NOME_TIPO = { reuniao: 'reunião', captacao: 'captação' } as const;

/**
 * Módulo notificacoes/horario (S8-4): quando a agência muda o horário, o cliente recebe o aviso na
 * hora (template "horario_alterado"). Troca feita pelo próprio cliente não gera este aviso.
 */
export default function horario(app: FastifyInstance): Promise<void> {
  app.deps.eventos.assinar('agendamento.reagendado', async (e) => {
    if (!e.dados.porAgencia) return;
    const prisma = escopoAgencia(app.deps.prisma, e.agenciaId);
    const o = await prisma.onboarding.findFirst({
      where: { id: e.dados.onboardingId },
      select: { statusGeral: true, agencia: { select: { fusoHorario: true } } },
    });
    if (!o || !onboardingAtivo(o.statusGeral)) return;
    const inicio = new Date(e.dados.inicio);
    const fuso = o.agencia.fusoHorario;
    const link = await linkAtual(prisma, app.deps.chaveLink, e.dados.onboardingId);
    const url = link ? urlDoLink(app.deps.auth.urlApp, link) : '';
    const valores = {
      ...(await valoresDoOnboarding(prisma, e.dados.onboardingId, url)),
      tipo: NOME_TIPO[e.dados.tipo],
      data: dataNaMensagem(inicio, fuso),
      hora: horaNaMensagem(inicio, fuso),
    };
    await enfileirarNotificacao(
      prisma,
      app.deps.eventos,
      app.deps.auth.urlApp,
      {
        onboardingId: e.dados.onboardingId,
        tipo: 'horario_alterado',
        categoria: 'transacional',
        chave: `horario_alterado:${e.dados.agendamentoId}:${e.dados.inicio}`,
        corpo: preencherTemplate(await textoDoTemplate(prisma, 'horario_alterado'), valores),
      },
      e.ocorridoEm,
    );
  });
  return Promise.resolve();
}
