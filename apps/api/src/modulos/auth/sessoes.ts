import { createHash, randomBytes } from 'node:crypto';
import type { Relogio } from '@convergia/core/base';
import type { ResolvedorSessao } from '../../base/auth.js';
import type { PrismaClient } from '../../base/prisma.js';

export const COOKIE_SESSAO = 'sessao';

/** Token aleatório de 256 bits, em base64url. */
export const tokenAleatorio = (): string => randomBytes(32).toString('base64url');

/** O banco guarda só o hash do token: um vazamento do banco não dá acesso a sessões. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export async function criarSessao(
  prisma: PrismaClient,
  usuario: { id: string; agenciaId: string },
  agora: Date,
  duracaoHoras: number,
): Promise<{ token: string; expiraEm: Date }> {
  const token = tokenAleatorio();
  const expiraEm = new Date(agora.getTime() + duracaoHoras * 3_600_000);
  await prisma.sessao.create({
    data: { id: hashToken(token), usuarioId: usuario.id, agenciaId: usuario.agenciaId, expiraEm },
  });
  return { token, expiraEm };
}

/** Lê o cookie de sessão e devolve o usuário, se a sessão existir, não tiver expirado e o usuário estiver ativo. */
export function resolvedorSessaoCookie(prisma: PrismaClient, relogio: Relogio): ResolvedorSessao {
  return async (request) => {
    const token = request.cookies[COOKIE_SESSAO];
    if (!token) return null;
    const sessao = await prisma.sessao.findUnique({
      where: { id: hashToken(token) },
      include: { usuario: true },
    });
    if (!sessao || sessao.expiraEm <= relogio.agora() || !sessao.usuario.ativo) return null;
    const { id, agenciaId, nome, email, papel } = sessao.usuario;
    return { id, agenciaId, nome, email, papel };
  };
}
