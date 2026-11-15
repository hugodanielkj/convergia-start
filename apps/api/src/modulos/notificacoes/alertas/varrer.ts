import { lembretesEsgotados, semAcaoHaDias } from '@convergia/core/alertas';
import { recebeLembretes } from '@convergia/core/estados';
import { totalLembretesPendencia } from '@convergia/core/lembretes';
import { STATUS_ONBOARDING } from '@convergia/core/onboarding';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import type { PrismaClient } from '../../../base/prisma.js';
import { prazosDosOnboardings } from '../../prazo/consultar.js';
import { registrarAlerta } from './registrar.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
/** Até quanto tempo para trás procurar o último lembrete enviado. */
const JANELA_ESGOTADOS_DIAS = 60;
const STATUS_ATIVOS = STATUS_ONBOARDING.filter(recebeLembretes);

/** RN-58: o cliente abriu o link e não avança há `diasSemAcaoParaAlerta` dias. Uma vez por pausa. */
export async function varrerSemAcao(
  prisma: PrismaClient,
  agora: Date,
  soAgencia?: string,
): Promise<number> {
  const abertos = await prisma.primeiroAcesso.findMany({
    where: soAgencia ? { agenciaId: soAgencia } : {},
    select: { onboardingId: true, em: true },
  });
  const abertoEm = new Map(abertos.map((a) => [a.onboardingId, a.em]));
  const onboardings = await prisma.onboarding.findMany({
    where: {
      id: { in: [...abertoEm.keys()] },
      statusGeral: { in: STATUS_ATIVOS },
      etapas: { some: { status: { not: 'concluida' } } },
    },
    select: {
      id: true,
      agenciaId: true,
      atualizadoEm: true,
      etapas: { select: { atualizadoEm: true } },
      agencia: { select: { config: { select: { diasSemAcaoParaAlerta: true } } } },
    },
  });
  let novos = 0;
  for (const o of onboardings) {
    const dias = o.agencia.config?.diasSemAcaoParaAlerta;
    const aberto = abertoEm.get(o.id);
    if (dias === undefined || !aberto) continue;
    const ultima = [aberto, o.atualizadoEm, ...o.etapas.map((e) => e.atualizadoEm)].reduce(
      (a, b) => (b > a ? b : a),
    );
    if (!semAcaoHaDias(ultima, agora, dias)) continue;
    const criado = await registrarAlerta(
      prisma,
      {
        agenciaId: o.agenciaId,
        onboardingId: o.id,
        tipo: 'sem_acao',
        chave: `sem_acao:${o.id}:${ultima.toISOString()}`,
      },
      agora,
    );
    if (criado) novos += 1;
  }
  return novos;
}

/** RN-56/58: o último lembrete automático saiu há 24h e ainda falta etapa. */
export async function varrerLembretesEsgotados(
  prisma: PrismaClient,
  agora: Date,
  soAgencia?: string,
): Promise<number> {
  const enviados = await prisma.notificacao.findMany({
    where: {
      ...(soAgencia ? { agenciaId: soAgencia } : {}),
      tipo: 'lembrete_pendencia',
      status: 'enviada',
      enviadaEm: { gte: new Date(agora.getTime() - JANELA_ESGOTADOS_DIAS * MS_POR_DIA) },
      onboarding: {
        statusGeral: { in: STATUS_ATIVOS },
        etapas: { some: { status: { not: 'concluida' } } },
      },
    },
    select: {
      agenciaId: true,
      onboardingId: true,
      chave: true,
      enviadaEm: true,
      agencia: {
        select: {
          config: { select: { lembretesPendenciaDias: true, maxLembretesPendencia: true } },
        },
      },
    },
  });
  let novos = 0;
  for (const n of enviados) {
    const config = n.agencia.config;
    if (!config || !n.enviadaEm) continue;
    const total = totalLembretesPendencia(
      config.lembretesPendenciaDias,
      config.maxLembretesPendencia,
    );
    if (total === 0 || n.chave !== `lembrete_pendencia:${n.onboardingId}:${String(total)}`)
      continue;
    if (!lembretesEsgotados(n.enviadaEm, agora)) continue;
    const criado = await registrarAlerta(
      prisma,
      {
        agenciaId: n.agenciaId,
        onboardingId: n.onboardingId,
        tipo: 'lembretes_esgotados',
        chave: `lembretes_esgotados:${n.onboardingId}`,
      },
      agora,
    );
    if (criado) novos += 1;
  }
  return novos;
}

/** RN-58: prazo de liberação em `atencao` ou `atrasado` (RN-48). Um aviso por indicador e data. */
export async function varrerPrazos(
  prisma: PrismaClient,
  agora: Date,
  soAgencia?: string,
): Promise<number> {
  const prazos = await prisma.prazoLiberacao.findMany({
    where: {
      ...(soAgencia ? { agenciaId: soAgencia } : {}),
      onboarding: { statusGeral: { notIn: ['concluido', 'cancelado'] } },
    },
    select: { agenciaId: true, onboarding: { select: { id: true, statusGeral: true } } },
  });
  const porAgencia = new Map<string, { id: string; statusGeral: string }[]>();
  for (const p of prazos) {
    porAgencia.set(p.agenciaId, [...(porAgencia.get(p.agenciaId) ?? []), p.onboarding]);
  }
  let novos = 0;
  for (const [agenciaId, onboardings] of porAgencia) {
    const calculados = await prazosDosOnboardings(
      escopoAgencia(prisma, agenciaId),
      agenciaId,
      onboardings,
      agora,
    );
    for (const [onboardingId, prazo] of calculados) {
      if (prazo.indicador !== 'atencao' && prazo.indicador !== 'atrasado') continue;
      const tipo = prazo.indicador === 'atencao' ? 'prazo_atencao' : 'prazo_atrasado';
      const criado = await registrarAlerta(
        prisma,
        { agenciaId, onboardingId, tipo, chave: `${tipo}:${onboardingId}:${prazo.data}` },
        agora,
      );
      if (criado) novos += 1;
    }
  }
  return novos;
}
