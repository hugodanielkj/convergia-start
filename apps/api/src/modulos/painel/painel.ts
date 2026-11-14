import type { UsuarioAutenticado } from '@convergia/core/base';
import {
  ETAPAS_ONBOARDING,
  STATUS_ONBOARDING,
  type StatusOnboarding,
  type TipoEtapa,
} from '@convergia/core/onboarding';
import { indicadoresAtencao, progressoEtapas, type IndicadorAtencao } from '@convergia/core/painel';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

const LIMITE = 200;
const dia = z.iso.date();

/** Filtros da RN-64. O de "indicador de prazo" entra com o prazo (S4-5); por ora vale a atenção. */
export const filtrosDoPainel = z.object({
  status: z
    .enum(STATUS_ONBOARDING as unknown as [StatusOnboarding, ...StatusOnboarding[]])
    .optional(),
  responsavelId: z.string().min(1).max(64).optional(),
  etapaPendente: z.enum(ETAPAS_ONBOARDING).optional(),
  de: dia.optional(),
  ate: dia.optional(),
  atencao: z.enum(['qualquer', 'acesso_invalido', 'link_expirado', 'parado']).optional(),
});
export type FiltrosDoPainel = z.infer<typeof filtrosDoPainel>;

export interface LinhaPainel {
  readonly id: string;
  readonly clienteId: string;
  readonly cliente: string;
  readonly responsavelId: string;
  readonly responsavel: string;
  readonly statusGeral: StatusOnboarding;
  readonly progresso: { concluidas: number; total: number };
  readonly etapas: { tipo: TipoEtapa; status: string }[];
  readonly criadoEm: Date;
  /** Chegam com a agenda (S3-4) e o prazo (S4-5); a coluna já existe no contrato. */
  readonly proximoCompromisso: null;
  readonly prazoLiberacao: null;
  readonly atencao: IndicadorAtencao[];
}

export async function listarOnboardings(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  filtros: FiltrosDoPainel,
  agora: Date,
): Promise<{
  onboardings: LinhaPainel[];
  limitado: boolean;
  responsaveis: { id: string; nome: string }[];
}> {
  const periodo: Prisma.DateTimeFilter = {};
  if (filtros.de) periodo.gte = new Date(`${filtros.de}T00:00:00.000Z`);
  if (filtros.ate)
    periodo.lt = new Date(new Date(`${filtros.ate}T00:00:00.000Z`).getTime() + 86_400_000);

  const where: Prisma.OnboardingWhereInput = {
    // RN-02: membro só enxerga os seus, mesmo que peça outro responsável.
    ...(usuario.papel === 'admin'
      ? filtros.responsavelId
        ? { responsavelId: filtros.responsavelId }
        : {}
      : { responsavelId: usuario.id }),
    ...(filtros.status ? { statusGeral: filtros.status } : {}),
    ...(filtros.etapaPendente
      ? { etapas: { some: { tipo: filtros.etapaPendente, status: { not: 'concluida' } } } }
      : {}),
    ...(Object.keys(periodo).length > 0 ? { criadoEm: periodo } : {}),
  };

  const [config, linhas] = await Promise.all([
    prisma.configAgencia.findFirst({ select: { diasSemAcaoParaAlerta: true } }),
    prisma.onboarding.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: LIMITE + 1,
      include: {
        cliente: { select: { nomeEmpresa: true } },
        responsavel: { select: { nome: true } },
        etapas: { select: { tipo: true, status: true, atualizadoEm: true } },
        link: { select: { expiraEm: true } },
      },
    }),
  ]);
  const limitado = linhas.length > LIMITE;
  const pagina = linhas.slice(0, LIMITE);

  const invalidos = await prisma.acessoPlataforma.findMany({
    where: { status: 'invalido', onboardingId: { in: pagina.map((o) => o.id) } },
    select: { onboardingId: true },
  });
  const comAcessoInvalido = new Set(invalidos.map((a) => a.onboardingId));
  const diasSemAcao = config?.diasSemAcaoParaAlerta ?? 3;

  const resultado = pagina.map((o): LinhaPainel => {
    const ultimaAtividade = o.etapas.reduce(
      (maisRecente, e) => (e.atualizadoEm > maisRecente ? e.atualizadoEm : maisRecente),
      o.atualizadoEm,
    );
    return {
      id: o.id,
      clienteId: o.clienteId,
      cliente: o.cliente.nomeEmpresa,
      responsavelId: o.responsavelId,
      responsavel: o.responsavel.nome,
      statusGeral: o.statusGeral,
      progresso: progressoEtapas(o.etapas),
      etapas: ETAPAS_ONBOARDING.map((tipo) => ({
        tipo,
        status: o.etapas.find((e) => e.tipo === tipo)?.status ?? 'pendente',
      })),
      criadoEm: o.criadoEm,
      proximoCompromisso: null,
      prazoLiberacao: null,
      atencao: indicadoresAtencao({
        statusGeral: o.statusGeral,
        acessoInvalido: comAcessoInvalido.has(o.id),
        linkExpirado: o.link !== null && o.link.expiraEm < agora,
        ultimaAtividade,
        agora,
        diasSemAcao,
      }),
    };
  });

  const filtro = filtros.atencao;
  const filtrados = !filtro
    ? resultado
    : resultado.filter((l) =>
        filtro === 'qualquer' ? l.atencao.length > 0 : l.atencao.includes(filtro),
      );
  // Para o filtro "responsável": só o admin escolhe; o membro só enxerga a si mesmo (RN-02).
  const responsaveis = await prisma.usuario.findMany({
    where: usuario.papel === 'admin' ? {} : { id: usuario.id },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
  return { onboardings: filtrados, limitado, responsaveis };
}
