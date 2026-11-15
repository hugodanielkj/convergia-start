import { ehTipoAlerta, textoDoAlerta, type TipoAlerta } from '@convergia/core/alertas';
import { NaoEncontradoError, type UsuarioAutenticado } from '@convergia/core/base';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';

const LIMITE = 100;

export interface AvisoVisao {
  readonly id: string;
  readonly tipo: TipoAlerta;
  readonly texto: string;
  readonly onboardingId: string;
  readonly criadoEm: Date;
  readonly resolvidoEm: Date | null;
}

/** RN-02: o Admin vê os avisos de todos; o membro, só os dos seus onboardings. */
const doUsuario = (usuario: UsuarioAutenticado) =>
  usuario.papel === 'admin' ? {} : { onboarding: { responsavelId: usuario.id } };

export async function listarAvisos(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  situacao: 'abertos' | 'resolvidos',
): Promise<AvisoVisao[]> {
  const alertas = await prisma.alertaInterno.findMany({
    where: { ...doUsuario(usuario), resolvidoEm: situacao === 'abertos' ? null : { not: null } },
    orderBy: situacao === 'abertos' ? { criadoEm: 'desc' } : { resolvidoEm: 'desc' },
    take: LIMITE,
    include: { onboarding: { select: { cliente: { select: { nomeEmpresa: true } } } } },
  });
  return alertas.flatMap((a) =>
    ehTipoAlerta(a.tipo)
      ? [
          {
            id: a.id,
            tipo: a.tipo,
            texto: textoDoAlerta(a.tipo, a.onboarding.cliente.nomeEmpresa, a.detalhe),
            onboardingId: a.onboardingId,
            criadoEm: a.criadoEm,
            resolvidoEm: a.resolvidoEm,
          },
        ]
      : [],
  );
}

export function contarAvisosAbertos(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
): Promise<number> {
  return prisma.alertaInterno.count({ where: { ...doUsuario(usuario), resolvidoEm: null } });
}

/** "Resolver" tira o aviso da lista para todos (decisão do PO). */
export async function resolverAviso(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  id: string,
  agora: Date,
): Promise<void> {
  const { count } = await prisma.alertaInterno.updateMany({
    where: { id, ...doUsuario(usuario), resolvidoEm: null },
    data: { resolvidoEm: agora, resolvidoPor: `usuario:${usuario.id}` },
  });
  if (count === 0) {
    const existe = await prisma.alertaInterno.count({ where: { id, ...doUsuario(usuario) } });
    if (existe === 0) throw new NaoEncontradoError('Aviso');
  }
}
