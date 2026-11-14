import { randomUUID } from 'node:crypto';
import { dataLocal } from '@convergia/core/agenda';
import type { PublicadorEventos } from '@convergia/core/base';
import type { PrismaClient } from '../../base/prisma.js';
import type { LinkLocalizado } from '../link/localizar-link.js';
import {
  carregarContexto,
  listarSlots,
  slotsLivres,
  type ListaDeSlots,
  type TipoAtendimento,
} from './slots-publicos.js';

// Evento para a integração com o calendário (S3-4) e as notificações (S5).
declare module '@convergia/core/base' {
  interface MapaEventos {
    'agendamento.criado': {
      agendamentoId: string;
      onboardingId: string;
      tipo: 'reuniao' | 'captacao';
      inicio: string;
      fim: string;
    };
  }
}

export interface EntradaReserva {
  readonly tipo: TipoAtendimento;
  readonly inicio: Date;
  /** Fuso do cliente, só para a lista atualizada devolvida quando o horário foi perdido. */
  readonly fuso?: string | undefined;
}

export type ResultadoReserva =
  | {
      readonly tipo: 'criado';
      readonly agendamento: {
        id: string;
        tipo: TipoAtendimento;
        inicio: string;
        fim: string;
        status: string;
      };
    }
  | { readonly tipo: 'indisponivel'; readonly lista: ListaDeSlots }
  | { readonly tipo: 'ja_agendado' };

const RESTRICAO_SOBREPOSICAO = 'agendamentos_sem_sobreposicao';
const RESTRICAO_UM_POR_TIPO = 'agendamentos_um_ativo_por_tipo';

/** O banco recusou a gravação por uma das travas da tabela `agendamentos`? Devolve o nome dela. */
export function restricaoViolada(erro: unknown): string | null {
  const texto = JSON.stringify(erro, Object.getOwnPropertyNames(erro));
  for (const nome of [RESTRICAO_SOBREPOSICAO, RESTRICAO_UM_POR_TIPO]) {
    if (texto.includes(nome)) return nome;
  }
  return null;
}

/**
 * Reserva um horário para o cliente dono do link (RN-33). Confere que o horário é mesmo um slot
 * livre; a garantia contra overbooking não depende dessa conferência: se dois clientes passarem
 * por ela ao mesmo tempo, a restrição de exclusão do banco deixa só um gravar (D-11) e o outro
 * recebe a lista atualizada. Um onboarding tem no máximo um agendamento ativo por tipo.
 */
export async function reservarSlot(
  prismaBruto: PrismaClient,
  eventos: PublicadorEventos,
  link: LinkLocalizado,
  entrada: EntradaReserva,
  agora: Date,
): Promise<ResultadoReserva> {
  const contexto = await carregarContexto(prismaBruto, link.agenciaId);
  const { prisma, fusoAgencia } = contexto;
  const indisponivel = async (): Promise<ResultadoReserva> => ({
    tipo: 'indisponivel',
    lista: await listarSlots(contexto, { tipo: entrada.tipo, fuso: entrada.fuso }, agora),
  });

  const jaTem = await prisma.agendamento.findFirst({
    where: {
      onboardingId: link.onboardingId,
      tipo: entrada.tipo,
      status: { in: ['agendado', 'reagendado'] },
    },
    select: { id: true },
  });
  if (jaTem) return { tipo: 'ja_agendado' };

  const dia = dataLocal(entrada.inicio, fusoAgencia);
  const livres = await slotsLivres(contexto, entrada.tipo, dia, dia, agora);
  const escolhido = livres.find((s) => s.inicio.getTime() === entrada.inicio.getTime());
  if (!escolhido) return indisponivel();

  try {
    const id = randomUUID();
    const agendamento = await prisma.$transaction(async (tx) => {
      // As reservas da mesma agência entram uma de cada vez. Sem isto, duas gravações do mesmo
      // horário podem ficar esperando uma pela outra dentro da restrição de exclusão, e o banco
      // desfaz uma delas com "deadlock" em vez de "horário ocupado". A trava é solta no fim da
      // transação; a restrição continua como a garantia final (D-11).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.agenciaId}))`;
      const criado = await tx.agendamento.create({
        data: {
          id,
          agenciaId: link.agenciaId,
          onboardingId: link.onboardingId,
          tipo: entrada.tipo,
          inicio: escolhido.inicio,
          fim: escolhido.fim,
        },
      });
      await tx.auditoriaLog.create({
        data: {
          agenciaId: link.agenciaId,
          ator: `cliente:${link.onboardingId}`,
          acao: 'agendamento.criado',
          entidade: 'Agendamento',
          entidadeId: id,
          dados: { tipo: entrada.tipo },
        },
      });
      return criado;
    });
    await eventos.publicar({
      tipo: 'agendamento.criado',
      agenciaId: link.agenciaId,
      ocorridoEm: agora,
      dados: {
        agendamentoId: agendamento.id,
        onboardingId: link.onboardingId,
        tipo: entrada.tipo,
        inicio: escolhido.inicio.toISOString(),
        fim: escolhido.fim.toISOString(),
      },
    });
    return {
      tipo: 'criado',
      agendamento: {
        id: agendamento.id,
        tipo: entrada.tipo,
        inicio: escolhido.inicio.toISOString(),
        fim: escolhido.fim.toISOString(),
        status: agendamento.status,
      },
    };
  } catch (erro) {
    const restricao = restricaoViolada(erro);
    if (restricao === RESTRICAO_SOBREPOSICAO) return indisponivel();
    if (restricao === RESTRICAO_UM_POR_TIPO) return { tipo: 'ja_agendado' };
    throw erro;
  }
}
