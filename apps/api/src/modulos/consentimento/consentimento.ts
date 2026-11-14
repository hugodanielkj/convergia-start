import { aceiteValido, statusAposPrimeiroAcesso } from '@convergia/core/consentimento';
import type { PrismaClient } from '../../base/prisma.js';
import { localizarLink, type LinkLocalizado } from '../link/localizar-link.js';

export type ResultadoLink<T> =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'expirado' }
  | { readonly tipo: 'ok'; readonly valor: T };

/** Resolve o token e só segue se o link vale (RN-11, RN-13). */
export async function comLinkValido<T>(
  prisma: PrismaClient,
  token: string,
  agora: Date,
  acao: (link: LinkLocalizado) => Promise<T>,
): Promise<ResultadoLink<T>> {
  const localizado = await localizarLink(prisma, token, agora);
  if (localizado.situacao !== 'valido') return { tipo: localizado.situacao };
  return { tipo: 'ok', valor: await acao(localizado.link) };
}

const atorCliente = (onboardingId: string): string => `cliente:${onboardingId}`;

/**
 * Registra a primeira abertura do link e inicia o andamento (RN-50). A chave única de
 * `primeiros_acessos` garante que, mesmo com várias abertas ao mesmo tempo, só uma conta.
 */
export async function registrarPrimeiroAcesso(
  prisma: PrismaClient,
  link: LinkLocalizado,
  agora: Date,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.primeiroAcesso.createMany({
      data: [{ onboardingId: link.onboardingId, agenciaId: link.agenciaId, em: agora }],
      skipDuplicates: true,
    });
    if (count === 0) return false;

    const onboarding = await tx.onboarding.findUniqueOrThrow({
      where: { id: link.onboardingId },
      select: { statusGeral: true },
    });
    const novo = statusAposPrimeiroAcesso(onboarding.statusGeral);
    if (novo !== onboarding.statusGeral) {
      await tx.onboarding.updateMany({
        where: { id: link.onboardingId, statusGeral: onboarding.statusGeral },
        data: { statusGeral: novo },
      });
    }
    await tx.auditoriaLog.create({
      data: {
        agenciaId: link.agenciaId,
        ator: atorCliente(link.onboardingId),
        acao: 'onboarding.primeiro_acesso',
        entidade: 'Onboarding',
        entidadeId: link.onboardingId,
        dados: { de: onboarding.statusGeral, para: novo },
      },
    });
    return true;
  });
}

/** Quando o cliente aceitou a versão vigente do termo, ou `null` se ainda não aceitou. */
export async function aceiteDoCliente(
  prisma: PrismaClient,
  link: LinkLocalizado,
  versao: string,
): Promise<Date | null> {
  const registro = await prisma.consentimentoCliente.findUnique({
    where: { onboardingId_versaoTermo: { onboardingId: link.onboardingId, versaoTermo: versao } },
  });
  return registro?.aceitoEm ?? null;
}

export type ResultadoAceite = 'registrado' | 'ja_aceito' | 'termo_desatualizado';

/** Grava o aceite do termo: data, hora e versão (RN-72). Aceitar de novo não muda nada. */
export async function aceitarTermo(
  prisma: PrismaClient,
  link: LinkLocalizado,
  versao: string,
  agora: Date,
): Promise<ResultadoAceite> {
  if (!aceiteValido(versao)) return 'termo_desatualizado';
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.consentimentoCliente.createMany({
      data: [
        {
          agenciaId: link.agenciaId,
          onboardingId: link.onboardingId,
          versaoTermo: versao,
          aceitoEm: agora,
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) return 'ja_aceito';
    await tx.auditoriaLog.create({
      data: {
        agenciaId: link.agenciaId,
        ator: atorCliente(link.onboardingId),
        acao: 'consentimento.aceito',
        entidade: 'Onboarding',
        entidadeId: link.onboardingId,
        dados: { versaoTermo: versao },
      },
    });
    return 'registrado';
  });
}
