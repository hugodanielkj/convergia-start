import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeAlterarConfiguracoes,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { onboardingAtivo } from '@convergia/core/onboarding';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { prepararLink, type LinkEmitido } from './emitir-link.js';

/**
 * Troca o token do onboarding por um novo (RN-12). Como o banco guarda só o hash e há um único
 * registro por onboarding, o token anterior deixa de valer na mesma gravação. Só o Admin ou o
 * responsável pelo onboarding podem regenerar (RN-02, RN-12). A regeneração é auditada (RN-77).
 */
export async function regenerarLink(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  agora: Date,
): Promise<LinkEmitido> {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    select: { responsavelId: true, statusGeral: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeAlterarConfiguracoes(usuario) && onboarding.responsavelId !== usuario.id) {
    throw new ProibidoError('RN-02');
  }
  if (!onboardingAtivo(onboarding.statusGeral)) {
    throw new RegraVioladaError('RN-12', 'Onboarding encerrado não tem link ativo');
  }

  const { emitido, dados } = await prepararLink(prisma, usuario.agenciaId, agora);
  await prisma.$transaction([
    prisma.linkOnboarding.upsert({
      where: { onboardingId },
      create: { ...dados, onboardingId },
      update: { tokenHash: dados.tokenHash, expiraEm: dados.expiraEm, regeneradoEm: agora },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'link.regenerado',
        entidade: 'Onboarding',
        entidadeId: onboardingId,
      },
    }),
  ]);
  return emitido;
}
