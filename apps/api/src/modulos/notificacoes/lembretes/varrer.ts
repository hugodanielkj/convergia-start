import type { PublicadorEventos } from '@convergia/core/base';
import { recebeLembretes } from '@convergia/core/estados';
import {
  LIMITES_LEMBRETES,
  dataNaMensagem,
  horaNaMensagem,
  janelaDaConfig,
  lembreteCompromissoDevido,
  lembretePendenciaDevido,
  textoPendencias,
} from '@convergia/core/lembretes';
import { STATUS_ONBOARDING } from '@convergia/core/onboarding';
import { preencherTemplate, type VariavelTemplate } from '@convergia/core/templates';
import { escopoAgencia, type PrismaDaAgencia } from '../../../base/escopo-agencia.js';
import type { PrismaClient } from '../../../base/prisma.js';
import { linkAtual, urlDoLink } from '../../link/link-atual.js';
import { textoDoTemplate } from '../../templates/templates.js';
import { enfileirarNotificacao } from '../envio/enfileirar.js';

export interface DepsLembretes {
  readonly prisma: PrismaClient;
  readonly eventos: PublicadorEventos;
  readonly urlApp: string;
  readonly chaveLink: Uint8Array | null;
  /** Só esta agência (testes rodam em paralelo no mesmo banco); sem valor, todas. */
  readonly soAgencia?: string;
}

const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;
/** Folga para o lembrete antecipado por causa da janela (uma semana cobre qualquer janela). */
const FOLGA_JANELA_DIAS = 8;

/** RN-53: status que ainda recebem lembretes. */
const STATUS_COM_LEMBRETE = STATUS_ONBOARDING.filter(recebeLembretes);

const NOME_TIPO: Readonly<Record<'reuniao' | 'captacao', string>> = {
  reuniao: 'reunião',
  captacao: 'captação',
};

async function jaExiste(prisma: PrismaClient, agenciaId: string, chave: string) {
  const n = await prisma.notificacao.findUnique({
    where: { agenciaId_chave: { agenciaId, chave } },
    select: { id: true },
  });
  return n !== null;
}

/** Nomes que os templates usam, lidos na hora (o cadastro pode ter mudado). */
export async function valoresDoOnboarding(
  prisma: PrismaDaAgencia,
  onboardingId: string,
  link: string,
): Promise<Partial<Record<VariavelTemplate, string>>> {
  const o = await prisma.onboarding.findFirstOrThrow({
    where: { id: onboardingId },
    select: {
      cliente: { select: { nomeEmpresa: true, nomeContato: true } },
      responsavel: { select: { nome: true } },
      agencia: { select: { nome: true } },
    },
  });
  return {
    nome_contato: o.cliente.nomeContato,
    nome_empresa: o.cliente.nomeEmpresa,
    nome_agencia: o.agencia.nome,
    responsavel: o.responsavel.nome,
    link_onboarding: link,
  };
}

/**
 * RN-56: lembrete de pendência que venceu desde o envio do convite, enquanto faltar etapa.
 * Sem o link cifrado não há como o cliente agir, então o lembrete não sai (2026-11-15-b).
 */
export async function varrerPendencias(deps: DepsLembretes, agora: Date): Promise<number> {
  const { prisma } = deps;
  const desde = new Date(
    agora.getTime() - (LIMITES_LEMBRETES.maxDiaPendencia + FOLGA_JANELA_DIAS) * MS_POR_DIA,
  );
  const convites = await prisma.notificacao.findMany({
    where: {
      ...(deps.soAgencia ? { agenciaId: deps.soAgencia } : {}),
      tipo: 'convite',
      status: 'enviada',
      enviadaEm: { gte: desde },
      onboarding: { statusGeral: { in: STATUS_COM_LEMBRETE } },
    },
    orderBy: { enviadaEm: 'asc' },
    select: {
      agenciaId: true,
      onboardingId: true,
      enviadaEm: true,
      agencia: { select: { config: true } },
    },
  });
  const primeiro = new Map<string, (typeof convites)[number]>();
  for (const c of convites) if (!primeiro.has(c.onboardingId)) primeiro.set(c.onboardingId, c);

  let enfileirados = 0;
  for (const c of primeiro.values()) {
    const config = c.agencia.config;
    if (!config || !c.enviadaEm) continue;
    const numero = lembretePendenciaDevido({
      conviteEnviadoEm: c.enviadaEm,
      dias: config.lembretesPendenciaDias,
      maximo: config.maxLembretesPendencia,
      agora,
    });
    if (numero === null) continue;
    const chave = `lembrete_pendencia:${c.onboardingId}:${String(numero)}`;
    if (await jaExiste(prisma, c.agenciaId, chave)) continue;

    const pendentes = await prisma.etapaOnboarding.findMany({
      where: { agenciaId: c.agenciaId, onboardingId: c.onboardingId, status: { not: 'concluida' } },
      select: { tipo: true },
    });
    if (pendentes.length === 0) continue;

    const escopo = escopoAgencia(prisma, c.agenciaId);
    const link = await linkAtual(escopo, deps.chaveLink, c.onboardingId);
    if (!link) continue;
    const valores = await valoresDoOnboarding(escopo, c.onboardingId, urlDoLink(deps.urlApp, link));
    const corpo = preencherTemplate(await textoDoTemplate(escopo, 'lembrete_pendencia'), {
      ...valores,
      pendencias: textoPendencias(pendentes.map((p) => p.tipo)),
    });
    const r = await enfileirarNotificacao(
      escopo,
      deps.eventos,
      deps.urlApp,
      {
        onboardingId: c.onboardingId,
        tipo: 'lembrete_pendencia',
        categoria: 'lembrete',
        chave,
        corpo,
        respeitarJanela: true,
      },
      agora,
    );
    if (r.situacao === 'enfileirada') enfileirados += 1;
  }
  return enfileirados;
}

/**
 * RN-57: lembrete antes de reunião e captação, antecipado se cairia fora da janela (RN-59). A chave
 * leva o horário do compromisso, então um reagendamento gera lembretes para o horário novo.
 */
export async function varrerCompromissos(deps: DepsLembretes, agora: Date): Promise<number> {
  const { prisma } = deps;
  const ate = new Date(
    agora.getTime() +
      LIMITES_LEMBRETES.maxHorasCompromisso * MS_POR_HORA +
      FOLGA_JANELA_DIAS * MS_POR_DIA,
  );
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      ...(deps.soAgencia ? { agenciaId: deps.soAgencia } : {}),
      status: { in: ['agendado', 'reagendado'] },
      inicio: { gt: agora, lte: ate },
      onboarding: { statusGeral: { in: STATUS_COM_LEMBRETE } },
    },
    select: {
      id: true,
      agenciaId: true,
      onboardingId: true,
      tipo: true,
      inicio: true,
      criadoEm: true,
      atualizadoEm: true,
      reagendamentos: true,
      dadosCaptacao: { select: { local: true } },
      agencia: { select: { fusoHorario: true, config: true } },
    },
  });

  let enfileirados = 0;
  for (const a of agendamentos) {
    const config = a.agencia.config;
    if (!config) continue;
    const fuso = a.agencia.fusoHorario;
    const momento = lembreteCompromissoDevido({
      inicio: a.inicio,
      // Reagendado: o horário atual foi marcado na última alteração do agendamento.
      marcadoEm: a.reagendamentos > 0 ? a.atualizadoEm : a.criadoEm,
      horas: config.lembretesCompromissoHoras,
      janela: janelaDaConfig(config, fuso),
      agora,
    });
    if (!momento) continue;
    const chave = `lembrete_compromisso:${a.id}:${a.inicio.toISOString()}:${String(momento.horas)}`;
    if (await jaExiste(prisma, a.agenciaId, chave)) continue;

    const escopo = escopoAgencia(prisma, a.agenciaId);
    const link = await linkAtual(escopo, deps.chaveLink, a.onboardingId);
    if (!link) continue;
    const valores = await valoresDoOnboarding(escopo, a.onboardingId, urlDoLink(deps.urlApp, link));
    // Só o endereço que o cliente informou: a reunião não tem link no sistema (decisão do PO).
    const local = a.dadosCaptacao?.local;
    const corpo = preencherTemplate(await textoDoTemplate(escopo, 'lembrete_compromisso'), {
      ...valores,
      tipo: NOME_TIPO[a.tipo],
      data: dataNaMensagem(a.inicio, fuso),
      hora: horaNaMensagem(a.inicio, fuso),
      ...(a.tipo === 'captacao' && local ? { local_captacao: local } : {}),
    });
    const r = await enfileirarNotificacao(
      escopo,
      deps.eventos,
      deps.urlApp,
      {
        onboardingId: a.onboardingId,
        tipo: 'lembrete_compromisso',
        categoria: 'lembrete',
        chave,
        corpo,
        respeitarJanela: true,
      },
      agora,
    );
    if (r.situacao === 'enfileirada') enfileirados += 1;
  }
  return enfileirados;
}
