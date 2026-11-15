import {
  NaoEncontradoError,
  ProibidoError,
  podeAlterarConfiguracoes,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { decifrarToken } from '@convergia/core/link';
import { onboardingAtivo } from '@convergia/core/onboarding';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { CAMINHO_PAGINA_CLIENTE, type LinkEmitido } from './emitir-link.js';

/**
 * O link vigente do onboarding, montado a partir do token cifrado (2026-11-15-b-link-cifrado).
 * `null` sem a chave, em link anterior à cifra ou em onboarding encerrado: aí só regenerando.
 */
export async function linkAtual(
  prisma: PrismaDaAgencia,
  chaveLink: Uint8Array | null,
  onboardingId: string,
): Promise<LinkEmitido | null> {
  if (!chaveLink) return null;
  const link = await prisma.linkOnboarding.findFirst({
    where: { onboardingId },
    select: { tokenCifrado: true, expiraEm: true, onboarding: { select: { statusGeral: true } } },
  });
  if (!link?.tokenCifrado || !onboardingAtivo(link.onboarding.statusGeral)) return null;
  const token = decifrarToken(link.tokenCifrado, chaveLink);
  if (!token) return null;
  return { token, caminho: `${CAMINHO_PAGINA_CLIENTE}/${token}`, expiraEm: link.expiraEm };
}

/** URL completa do link, para as mensagens ao cliente. */
export function urlDoLink(urlApp: string, link: LinkEmitido): string {
  return `${urlApp.replace(/\/$/, '')}${link.caminho}`;
}

/** "Copiar link" no detalhe: só o Admin e o responsável, como na regeneração (RN-02, RN-12). */
export async function linkParaCopiar(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  chaveLink: Uint8Array | null,
  onboardingId: string,
): Promise<Omit<LinkEmitido, 'token'> | null> {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    select: { responsavelId: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeAlterarConfiguracoes(usuario) && onboarding.responsavelId !== usuario.id) {
    throw new ProibidoError('RN-02');
  }
  const link = await linkAtual(prisma, chaveLink, onboardingId);
  return link ? { caminho: link.caminho, expiraEm: link.expiraEm } : null;
}
