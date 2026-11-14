import { NaoEncontradoError, ProibidoError, podeVerOnboarding } from '@convergia/core/base';
import type { UsuarioAutenticado } from '@convergia/core/base';
import { interpretarAtor, type TipoAtor } from '@convergia/core/lgpd';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export interface FiltrosAuditoria {
  readonly de?: Date | undefined;
  readonly ate?: Date | undefined;
  /** Ação exata (`etapa.reaberta`) ou um grupo terminado em ponto (`onboarding.`). */
  readonly acao?: string | undefined;
  readonly limite: number;
}

export interface ItemAuditoria {
  readonly id: string;
  readonly em: Date;
  readonly acao: string;
  readonly entidade: string;
  readonly ator: { readonly tipo: TipoAtor; readonly nome: string | null };
  readonly dados: unknown;
}

/** IDs que a auditoria usa para falar de um onboarding: ele, o cliente e os agendamentos. */
export async function entidadesDoOnboarding(
  prisma: PrismaDaAgencia,
  onboardingId: string,
  clienteId: string,
): Promise<string[]> {
  const agendamentos = await prisma.agendamento.findMany({
    where: { onboardingId },
    select: { id: true },
  });
  return [onboardingId, clienteId, ...agendamentos.map((a) => a.id)];
}

/** Nome de quem agiu: o usuário da equipe, o contato do cliente ou nenhum (sistema). */
async function nomesDosAtores(
  prisma: PrismaDaAgencia,
  atores: readonly string[],
  nomeContato: string,
): Promise<(ator: string) => { tipo: TipoAtor; nome: string | null }> {
  const ids = [
    ...new Set(
      atores.map(interpretarAtor).flatMap((a) => (a.tipo === 'usuario' && a.id ? [a.id] : [])),
    ),
  ];
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: ids } },
    select: { id: true, nome: true },
  });
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  return (ator) => {
    const { tipo, id } = interpretarAtor(ator);
    if (tipo === 'usuario') return { tipo, nome: (id && nomes.get(id)) ?? null };
    if (tipo === 'cliente') return { tipo, nome: nomeContato };
    return { tipo, nome: null };
  };
}

/**
 * Auditoria consultável de um onboarding (RN-77), da mais recente para a mais antiga. É a linha do
 * tempo do detalhe (S4-2). Admin ou responsável (RN-02), só da própria agência (RN-75).
 */
export async function listarAuditoriaDoOnboarding(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  filtros: FiltrosAuditoria,
): Promise<ItemAuditoria[]> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: { responsavelId: true, clienteId: true, cliente: { select: { nomeContato: true } } },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, onboarding.responsavelId)) throw new ProibidoError('RN-02');

  const ids = await entidadesDoOnboarding(prisma, onboardingId, onboarding.clienteId);
  const { de, ate, acao } = filtros;
  const registros = await prisma.auditoriaLog.findMany({
    where: {
      entidadeId: { in: ids },
      ...(de || ate ? { em: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } } : {}),
      ...(acao ? { acao: acao.endsWith('.') ? { startsWith: acao } : acao } : {}),
    },
    orderBy: [{ em: 'desc' }, { id: 'desc' }],
    take: filtros.limite,
  });
  const atorDe = await nomesDosAtores(
    prisma,
    registros.map((r) => r.ator),
    onboarding.cliente.nomeContato,
  );
  return registros.map((r) => ({
    id: r.id,
    em: r.em,
    acao: r.acao,
    entidade: r.entidade,
    ator: atorDe(r.ator),
    dados: r.dados,
  }));
}
