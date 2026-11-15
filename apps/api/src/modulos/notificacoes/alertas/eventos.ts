import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../../../base/prisma.js';
import { registrarAlerta } from './registrar.js';

const NOME_TIPO = { reuniao: 'reunião', captacao: 'captação' } as const;

/** RN-58: as quatro etapas concluídas. Uma vez por onboarding. */
export async function verificarConclusao(
  prisma: PrismaClient,
  agenciaId: string,
  onboardingId: string,
  agora: Date,
): Promise<void> {
  const etapas = await prisma.etapaOnboarding.findMany({
    where: { agenciaId, onboardingId },
    select: { status: true },
  });
  if (etapas.length === 0 || etapas.some((e) => e.status !== 'concluida')) return;
  await registrarAlerta(
    prisma,
    { agenciaId, onboardingId, tipo: 'concluiu', chave: `concluiu:${onboardingId}` },
    agora,
  );
}

/** Liga os alertas que nascem de eventos de outros módulos (RN-58 e extras do PO). */
export function assinarEventosDeAlerta(app: FastifyInstance): void {
  const { prisma, eventos } = app.deps;
  const conclusao = (e: { agenciaId: string; ocorridoEm: Date; dados: { onboardingId: string } }) =>
    verificarConclusao(prisma, e.agenciaId, e.dados.onboardingId, e.ocorridoEm);

  eventos.assinar('onboarding.etapas_mudaram', conclusao);
  eventos.assinar('onboarding.status_alterado', conclusao);
  eventos.assinar('agendamento.criado', conclusao);

  eventos.assinar('acesso.marcado_invalido', (e) =>
    registrarAlerta(
      prisma,
      {
        agenciaId: e.agenciaId,
        onboardingId: e.dados.onboardingId,
        tipo: 'acesso_invalido',
        chave: `acesso_invalido:${e.dados.onboardingId}:${e.dados.plataforma}:${e.ocorridoEm.toISOString()}`,
        detalhe: e.dados.plataforma,
        usuarioId: e.dados.usuarioId,
      },
      e.ocorridoEm,
    ).then(() => undefined),
  );

  eventos.assinar('agendamento.nao_compareceu', (e) =>
    registrarAlerta(
      prisma,
      {
        agenciaId: e.agenciaId,
        onboardingId: e.dados.onboardingId,
        tipo: 'nao_compareceu',
        chave: `nao_compareceu:${e.dados.agendamentoId}`,
        detalhe: NOME_TIPO[e.dados.tipo],
        usuarioId: e.dados.usuarioId ?? null,
      },
      e.ocorridoEm,
    ).then(() => undefined),
  );

  eventos.assinar('notificacao.falhou', (e) =>
    registrarAlerta(
      prisma,
      {
        agenciaId: e.agenciaId,
        onboardingId: e.dados.onboardingId,
        tipo: 'mensagem_falhou',
        chave: `mensagem_falhou:${e.dados.notificacaoId}`,
      },
      e.ocorridoEm,
    ).then(() => undefined),
  );

  eventos.assinar('onboarding.novo_link_solicitado', (e) =>
    registrarAlerta(
      prisma,
      {
        agenciaId: e.agenciaId,
        onboardingId: e.dados.onboardingId,
        tipo: 'link_solicitado',
        chave: `link_solicitado:${e.dados.onboardingId}:${e.ocorridoEm.toISOString()}`,
      },
      e.ocorridoEm,
    ).then(() => undefined),
  );
}
