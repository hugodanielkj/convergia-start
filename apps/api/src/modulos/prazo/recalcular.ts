import { dataLocal, type Bloqueio } from '@convergia/core/agenda';
import type { PublicadorEventos } from '@convergia/core/base';
import { calcularPrazoLiberacao, prazoMudou } from '@convergia/core/prazo';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import type { PrismaClient } from '../../base/prisma.js';

// Evento para as mensagens ao cliente (S5): `anterior` nulo é o prazo comunicado pela primeira
// vez (RN-45); com valor, é um recálculo ou ajuste (RN-46, RN-47); `data` nula, prazo desfeito.
declare module '@convergia/core/base' {
  interface MapaEventos {
    'prazo.alterado': {
      onboardingId: string;
      data: string | null;
      anterior: string | null;
      origem: 'calculado' | 'manual';
    };
  }
}

/** Data `YYYY-MM-DD` de uma coluna `@db.Date` (o Prisma devolve meia-noite UTC). */
export const textoDaData = (data: Date): string => data.toISOString().slice(0, 10);
export const colunaDeData = (data: string): Date => new Date(`${data}T00:00:00.000Z`);

export type ResultadoRecalculo =
  | { readonly mudou: false; readonly data: string | null }
  | { readonly mudou: true; readonly data: string | null; readonly anterior: string | null };

/**
 * Deixa o prazo do onboarding coerente com a captação (RN-43 a RN-46). Pode ser chamada quantas
 * vezes for preciso: lê o estado atual e só grava se algo mudou.
 * - Sem captação marcada ou feita: não há prazo (RN-45); um prazo anterior é desfeito.
 * - Captação no mesmo dia da usada no cálculo: o prazo fica como está, inclusive um ajuste manual.
 * - Captação em outro dia: recalcula com o prazo de produção e os bloqueios de agora.
 */
export async function recalcularPrazo(
  prismaBruto: PrismaClient,
  eventos: PublicadorEventos,
  agenciaId: string,
  onboardingId: string,
  agora: Date,
): Promise<ResultadoRecalculo> {
  const prisma = escopoAgencia(prismaBruto, agenciaId);
  const [agencia, config, bloqueiosDb] = await Promise.all([
    prismaBruto.agencia.findUniqueOrThrow({
      where: { id: agenciaId },
      select: { fusoHorario: true },
    }),
    prisma.configAgencia.findFirstOrThrow({ select: { prazoProducaoDiasUteis: true } }),
    prisma.bloqueio.findMany(),
  ]);
  const bloqueios: Bloqueio[] = bloqueiosDb.map((b) => ({
    dataInicio: textoDaData(b.dataInicio),
    dataFim: textoDaData(b.dataFim),
    motivo: b.motivo,
  }));

  const resultado = await prisma.$transaction(async (tx) => {
    // Dois eventos do mesmo onboarding ao mesmo tempo (ex.: reagendou duas vezes) entram em fila.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`prazo:${onboardingId}`}))`;
    const captacoes = await tx.agendamento.findMany({
      where: {
        onboardingId,
        tipo: 'captacao',
        status: { in: ['agendado', 'reagendado', 'realizado'] },
      },
      orderBy: { inicio: 'desc' },
      select: { inicio: true, status: true },
    });
    const captacao = captacoes.find((c) => c.status !== 'realizado') ?? captacoes[0];
    const atual = await tx.prazoLiberacao.findUnique({ where: { onboardingId } });
    const anterior = atual ? textoDaData(atual.data) : null;

    if (!captacao) {
      if (!atual) return { mudou: false as const, data: null };
      await tx.prazoLiberacao.delete({ where: { onboardingId } });
      await auditar(tx, agenciaId, onboardingId, 'prazo.removido', { anterior });
      return { mudou: true as const, data: null, anterior };
    }

    const dataCaptacao = dataLocal(captacao.inicio, agencia.fusoHorario);
    if (atual && textoDaData(atual.captacaoData) === dataCaptacao) {
      return { mudou: false as const, data: anterior };
    }

    const diasUteis = config.prazoProducaoDiasUteis;
    const novo = calcularPrazoLiberacao(dataCaptacao, diasUteis, bloqueios);
    const dados = {
      data: colunaDeData(novo),
      origem: 'calculado' as const,
      captacaoData: colunaDeData(dataCaptacao),
      diasUteis,
      justificativa: null,
    };
    await tx.prazoLiberacao.upsert({
      where: { onboardingId },
      create: { agenciaId, onboardingId, ...dados },
      update: dados,
    });
    if (!prazoMudou(anterior, novo)) return { mudou: false as const, data: novo };
    await auditar(tx, agenciaId, onboardingId, atual ? 'prazo.recalculado' : 'prazo.calculado', {
      anterior,
      data: novo,
      captacao: dataCaptacao,
      diasUteis,
    });
    return { mudou: true as const, data: novo, anterior };
  });

  if (resultado.mudou) {
    await eventos.publicar({
      tipo: 'prazo.alterado',
      agenciaId,
      ocorridoEm: agora,
      dados: {
        onboardingId,
        data: resultado.data,
        anterior: resultado.anterior,
        origem: 'calculado',
      },
    });
  }
  return resultado;
}

type Transacao = Parameters<Parameters<ReturnType<typeof escopoAgencia>['$transaction']>[0]>[0];

async function auditar(
  tx: Transacao,
  agenciaId: string,
  onboardingId: string,
  acao: string,
  dados: Record<string, string | number | null>,
): Promise<void> {
  await tx.auditoriaLog.create({
    data: {
      agenciaId,
      ator: 'sistema',
      acao,
      entidade: 'Onboarding',
      entidadeId: onboardingId,
      dados,
    },
  });
}
