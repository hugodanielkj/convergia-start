import {
  agruparPorDia,
  dataLocal,
  gerarSlots,
  horaLocal,
  instanteLocal,
  type Bloqueio,
} from '@convergia/core/agenda';
import { escopoAgencia, type PrismaDaAgencia } from '../../base/escopo-agencia.js';
import type { PrismaClient } from '../../base/prisma.js';

export type TipoAtendimento = 'reuniao' | 'captacao';

/** Quantos dias a lista de horários cobre quando o cliente não escolhe o período (paginação da tela). */
export const DIAS_PADRAO_DA_LISTA = 14;

const MS_DIA = 24 * 60 * 60 * 1000;

export interface SlotVisao {
  readonly inicio: string;
  readonly fim: string;
  /** Hora no fuso mostrado, `HH:mm`. */
  readonly hora: string;
}

export interface ListaDeSlots {
  /** Fuso em que `data` e `hora` estão (RN-32). */
  readonly fuso: string;
  readonly dias: readonly { readonly data: string; readonly slots: readonly SlotVisao[] }[];
}

export interface ConsultaSlots {
  readonly tipo: TipoAtendimento;
  readonly de?: string | undefined;
  readonly ate?: string | undefined;
  /** Fuso do cliente; sem ele vale o da agência. */
  readonly fuso?: string | undefined;
}

export interface ContextoDaAgenda {
  readonly prisma: PrismaDaAgencia;
  readonly fusoAgencia: string;
  readonly antecedenciaMinimaHoras: number;
  readonly duracaoPadraoMinutos: Record<TipoAtendimento, number>;
}

/** Configuração da agência dona do link: fuso, antecedência e durações (RN-30, RN-31, RN-32). */
export async function carregarContexto(
  prismaBruto: PrismaClient,
  agenciaId: string,
): Promise<ContextoDaAgenda> {
  const prisma = escopoAgencia(prismaBruto, agenciaId);
  const [agencia, config] = await Promise.all([
    prismaBruto.agencia.findUniqueOrThrow({
      where: { id: agenciaId },
      select: { fusoHorario: true },
    }),
    prisma.configAgencia.findFirstOrThrow(),
  ]);
  return {
    prisma,
    fusoAgencia: agencia.fusoHorario,
    antecedenciaMinimaHoras: config.antecedenciaMinimaHoras,
    duracaoPadraoMinutos: {
      reuniao: config.duracaoReuniaoMinutos,
      captacao: config.duracaoCaptacaoMinutos,
    },
  };
}

const textoDaData = (data: Date): string => data.toISOString().slice(0, 10);

/** Slots livres da agência para o período, já tirando os horários ocupados (RN-30 a RN-33). */
export async function slotsLivres(
  contexto: ContextoDaAgenda,
  tipo: TipoAtendimento,
  de: string,
  ate: string,
  agora: Date,
  /** Agendamento que está sendo remarcado: o horário dele não conta como ocupado. */
  ignorarAgendamentoId?: string,
) {
  const { prisma, fusoAgencia } = contexto;
  const [janelas, bloqueiosDb] = await Promise.all([
    prisma.disponibilidade.findMany({ where: { tipo } }),
    prisma.bloqueio.findMany(),
  ]);
  const bloqueios: Bloqueio[] = bloqueiosDb.map((b) => ({
    dataInicio: textoDaData(b.dataInicio),
    dataFim: textoDaData(b.dataFim),
    motivo: b.motivo,
  }));

  // Agendamentos de qualquer tipo ocupam a agenda: o profissional é um só (D-02).
  const inicioDoPeriodo =
    instanteLocal(de, '00:00', fusoAgencia) ?? new Date(Date.parse(`${de}T00:00:00Z`) - MS_DIA);
  const fimDoPeriodo = new Date(inicioDoPeriodo.getTime() + 64 * MS_DIA);
  const ocupados = await prisma.agendamento.findMany({
    where: {
      status: { in: ['agendado', 'reagendado'] },
      inicio: { lt: fimDoPeriodo },
      fim: { gt: inicioDoPeriodo },
      ...(ignorarAgendamentoId === undefined ? {} : { id: { not: ignorarAgendamentoId } }),
    },
    select: { inicio: true, fim: true },
  });

  return gerarSlots({
    janelas: janelas.map((j) => ({
      diaSemana: j.diaSemana,
      horaInicio: j.horaInicio,
      horaFim: j.horaFim,
      ...(j.duracaoMinutos === null ? {} : { duracaoMinutos: j.duracaoMinutos }),
    })),
    bloqueios,
    ocupados,
    agora,
    antecedenciaMinimaHoras: contexto.antecedenciaMinimaHoras,
    duracaoPadraoMinutos: contexto.duracaoPadraoMinutos[tipo],
    fusoAgencia,
    de,
    ate,
  });
}

/** Lista de horários no fuso pedido, agrupados por dia (RN-32). Período padrão: hoje + duas semanas. */
export async function listarSlots(
  contexto: ContextoDaAgenda,
  consulta: ConsultaSlots,
  agora: Date,
  ignorarAgendamentoId?: string,
): Promise<ListaDeSlots> {
  const fuso = consulta.fuso ?? contexto.fusoAgencia;
  const hoje = dataLocal(agora, contexto.fusoAgencia);
  const de = consulta.de ?? hoje;
  const ate =
    consulta.ate ??
    textoDaData(new Date(Date.parse(`${de}T00:00:00Z`) + (DIAS_PADRAO_DA_LISTA - 1) * MS_DIA));

  const slots = await slotsLivres(contexto, consulta.tipo, de, ate, agora, ignorarAgendamentoId);
  return {
    fuso,
    dias: agruparPorDia(slots, fuso).map((dia) => ({
      data: dia.data,
      slots: dia.slots.map((s) => ({
        inicio: s.inicio.toISOString(),
        fim: s.fim.toISOString(),
        hora: horaLocal(s.inicio, fuso),
      })),
    })),
  };
}
