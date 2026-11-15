import { hashToken } from '@convergia/core/link';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import type { PrismaClient } from '../../base/prisma.js';
import { localizarLink } from '../link/localizar-link.js';

type EtapaResumo = 'formulario' | 'acessos' | 'reuniao' | 'captacao';

export interface ResumoOnboarding {
  readonly empresa: string;
  /** Fuso da agência, para a página mostrar as datas como a agência combinou (D-14). */
  readonly fuso: string;
  readonly etapas: readonly { readonly etapa: EtapaResumo; readonly em: Date | null }[];
  readonly primeiroConteudoEm: Date | null;
  readonly concluidoEm: Date | null;
}

export type ResultadoResumo =
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'nao_concluido' }
  | { readonly tipo: 'concluido'; readonly resumo: ResumoOnboarding };

const HORARIO_VALENDO = ['agendado', 'reagendado', 'realizado'] as const;

/**
 * Resumo do onboarding concluído (RN-14): só etapas e datas, sem respostas nem arquivos
 * (decisão 2026-11-14-a-resumo-concluido). Vale com o link vencido; cancelado é link inválido.
 */
export async function resumoDoLink(
  prisma: PrismaClient,
  token: string,
  agora: Date,
): Promise<ResultadoResumo> {
  const localizado = await localizarLink(prisma, token, agora);
  if (localizado.situacao === 'invalido') return { tipo: 'invalido' };
  const { agenciaId, onboardingId } = localizado.link;
  const escopo = escopoAgencia(prisma, agenciaId);

  const onboarding = await escopo.onboarding.findFirstOrThrow({
    where: { id: onboardingId },
    select: {
      statusGeral: true,
      cliente: { select: { nomeEmpresa: true } },
      agencia: { select: { fusoHorario: true } },
    },
  });
  if (onboarding.statusGeral !== 'concluido') return { tipo: 'nao_concluido' };

  const [resposta, acesso, reuniao, captacao, entrega, encerramento] = await Promise.all([
    escopo.respostaFormulario.findFirst({ where: { onboardingId }, select: { enviadaEm: true } }),
    escopo.acessoPlataforma.findFirst({
      where: { onboardingId, status: 'concedido' },
      orderBy: { atualizadoEm: 'desc' },
      select: { atualizadoEm: true },
    }),
    ultimoHorario(escopo, onboardingId, 'reuniao'),
    ultimoHorario(escopo, onboardingId, 'captacao'),
    ultimaTransicao(escopo, onboardingId, 'primeiro_conteudo_entregue'),
    ultimaTransicao(escopo, onboardingId, 'concluido'),
  ]);

  return {
    tipo: 'concluido',
    resumo: {
      empresa: onboarding.cliente.nomeEmpresa,
      fuso: onboarding.agencia.fusoHorario,
      etapas: [
        { etapa: 'formulario', em: resposta?.enviadaEm ?? null },
        { etapa: 'acessos', em: acesso?.atualizadoEm ?? null },
        { etapa: 'reuniao', em: reuniao },
        { etapa: 'captacao', em: captacao },
      ],
      primeiroConteudoEm: entrega,
      concluidoEm: encerramento,
    },
  };
}

type Escopo = ReturnType<typeof escopoAgencia>;

async function ultimoHorario(
  escopo: Escopo,
  onboardingId: string,
  tipo: 'reuniao' | 'captacao',
): Promise<Date | null> {
  const agendamento = await escopo.agendamento.findFirst({
    where: { onboardingId, tipo, status: { in: [...HORARIO_VALENDO] } },
    orderBy: { inicio: 'desc' },
    select: { inicio: true },
  });
  return agendamento?.inicio ?? null;
}

async function ultimaTransicao(
  escopo: Escopo,
  onboardingId: string,
  para: 'primeiro_conteudo_entregue' | 'concluido',
): Promise<Date | null> {
  const transicao = await escopo.transicaoStatus.findFirst({
    where: { onboardingId, para },
    orderBy: { em: 'desc' },
    select: { em: true },
  });
  return transicao?.em ?? null;
}

/** O link é de um onboarding concluído? Então ele é só para leitura (RN-14). */
export async function linkDeOnboardingConcluido(
  prisma: PrismaClient,
  token: string,
): Promise<boolean> {
  const link = await prisma.linkOnboarding.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { onboarding: { select: { statusGeral: true } } },
  });
  return link?.onboarding.statusGeral === 'concluido';
}
