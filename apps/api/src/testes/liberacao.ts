import { hashToken } from '@convergia/core/link';
import { escopoAgencia } from '../base/escopo-agencia.js';
import type { PrismaClient } from '../base/prisma.js';
import { plataformasEscolhidas } from '../modulos/acessos/acessos.js';
import { garantirModeloPadrao } from '../modulos/formulario/modelo.js';

/**
 * Para testes de agenda, captação e prazo: deixa o onboarding do link pronto para agendar a
 * reunião (RN-79), como se o cliente tivesse enviado o formulário e a agência concedido os acessos.
 */
export async function liberarAteReuniao(prisma: PrismaClient, token: string): Promise<void> {
  const { agenciaId, onboardingId } = await enviarFormulario(prisma, token);
  const escopo = escopoAgencia(prisma, agenciaId);
  const plataformas = await plataformasEscolhidas(escopo, onboardingId);
  await prisma.acessoPlataforma.createMany({
    data: plataformas.map((plataforma) => ({
      agenciaId,
      onboardingId,
      plataforma,
      status: 'concedido' as const,
    })),
    skipDuplicates: true,
  });
}

/** Marca o formulário do onboarding do link como enviado, o que libera Acessos (RN-79). */
export async function enviarFormulario(prisma: PrismaClient, token: string) {
  const link = await prisma.linkOnboarding.findFirstOrThrow({
    where: { tokenHash: hashToken(token) },
    select: { agenciaId: true, onboardingId: true },
  });
  const { agenciaId, onboardingId } = link;
  const escopo = escopoAgencia(prisma, agenciaId);
  await garantirModeloPadrao(escopo, agenciaId);
  const versao = await escopo.versaoFormulario.findFirstOrThrow({ orderBy: { numero: 'desc' } });
  await prisma.respostaFormulario.upsert({
    where: { onboardingId },
    create: { agenciaId, onboardingId, versaoId: versao.id, respostas: {}, enviadaEm: new Date(0) },
    update: { enviadaEm: new Date(0) },
  });
  return link;
}
