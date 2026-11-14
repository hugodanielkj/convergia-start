import {
  avaliarReagendamento,
  dataLocal,
  reagendamentosRestantes,
  type MotivoReagendamentoNegado,
} from '@convergia/core/agenda';
import type { PublicadorEventos } from '@convergia/core/base';
import type { PrismaClient } from '../../base/prisma.js';
import type { LinkLocalizado } from '../link/localizar-link.js';
import { restricaoViolada } from './reservar.js';
import { carregarContexto, listarSlots, slotsLivres, type ListaDeSlots } from './slots-publicos.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    'agendamento.reagendado': {
      agendamentoId: string;
      onboardingId: string;
      tipo: 'reuniao' | 'captacao';
      inicioAnterior: string;
      inicio: string;
      fim: string;
    };
  }
}

export interface AgendamentoVisao {
  readonly id: string;
  readonly tipo: 'reuniao' | 'captacao';
  readonly inicio: string;
  readonly fim: string;
  readonly status: string;
  readonly reagendamentosRestantes: number;
}

export type ResultadoReagendamentoCliente =
  | { readonly tipo: 'reagendado'; readonly agendamento: AgendamentoVisao }
  | { readonly tipo: 'negado'; readonly motivo: MotivoReagendamentoNegado | 'mesmo_horario' }
  | { readonly tipo: 'indisponivel'; readonly lista: ListaDeSlots }
  | { readonly tipo: 'nao_encontrado' };

/**
 * O cliente troca o horário do próprio agendamento (RN-35, RN-36). O registro é o mesmo: muda de
 * horário, vai para `reagendado` e conta +1. O horário antigo fica livre na mesma gravação.
 * Duas trocas ao mesmo tempo são resolvidas pela fila por agência e pela restrição do banco (D-11);
 * a mesma pessoa trocando duas vezes ao mesmo tempo conta uma só, pela conferência do contador.
 */
export async function reagendarAgendamento(
  prismaBruto: PrismaClient,
  eventos: PublicadorEventos,
  link: LinkLocalizado,
  agendamentoId: string,
  entrada: { inicio: Date; fuso?: string | undefined },
  agora: Date,
): Promise<ResultadoReagendamentoCliente> {
  const contexto = await carregarContexto(prismaBruto, link.agenciaId);
  const { prisma, fusoAgencia } = contexto;

  const atual = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, onboardingId: link.onboardingId },
  });
  if (!atual) return { tipo: 'nao_encontrado' };

  const config = await prisma.configAgencia.findFirstOrThrow();
  const avaliacao = avaliarReagendamento({
    status: atual.status,
    reagendamentosFeitos: atual.reagendamentos,
    limiteReagendamentos: config.limiteReagendamentos,
    inicio: atual.inicio,
    agora,
    antecedenciaReagendamentoHoras: config.antecedenciaReagendamentoHoras,
  });
  if (!avaliacao.ok) return { tipo: 'negado', motivo: avaliacao.motivo };
  if (entrada.inicio.getTime() === atual.inicio.getTime())
    return { tipo: 'negado', motivo: 'mesmo_horario' };

  const indisponivel = async (): Promise<ResultadoReagendamentoCliente> => ({
    tipo: 'indisponivel',
    lista: await listarSlots(contexto, { tipo: atual.tipo, fuso: entrada.fuso }, agora, atual.id),
  });

  const dia = dataLocal(entrada.inicio, fusoAgencia);
  const livres = await slotsLivres(contexto, atual.tipo, dia, dia, agora, atual.id);
  const escolhido = livres.find((s) => s.inicio.getTime() === entrada.inicio.getTime());
  if (!escolhido) return indisponivel();

  try {
    const trocou = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.agenciaId}))`;
      // Só troca se o agendamento continua como o lemos: protege de duas trocas simultâneas.
      const { count } = await tx.agendamento.updateMany({
        where: {
          id: atual.id,
          status: { in: ['agendado', 'reagendado'] },
          reagendamentos: atual.reagendamentos,
        },
        data: {
          inicio: escolhido.inicio,
          fim: escolhido.fim,
          status: 'reagendado',
          reagendamentos: { increment: 1 },
        },
      });
      if (count === 0) return false;
      await tx.auditoriaLog.create({
        data: {
          agenciaId: link.agenciaId,
          ator: `cliente:${link.onboardingId}`,
          acao: 'agendamento.reagendado',
          entidade: 'Agendamento',
          entidadeId: atual.id,
          dados: { tipo: atual.tipo, reagendamentos: atual.reagendamentos + 1 },
        },
      });
      return true;
    });
    // Perdeu para uma troca simultânea do mesmo agendamento: o estado mudou, o cliente reavalia.
    if (!trocou) return { tipo: 'negado', motivo: 'status_invalido' };
  } catch (erro) {
    if (restricaoViolada(erro) === 'agendamentos_sem_sobreposicao') return indisponivel();
    throw erro;
  }

  await eventos.publicar({
    tipo: 'agendamento.reagendado',
    agenciaId: link.agenciaId,
    ocorridoEm: agora,
    dados: {
      agendamentoId: atual.id,
      onboardingId: link.onboardingId,
      tipo: atual.tipo,
      inicioAnterior: atual.inicio.toISOString(),
      inicio: escolhido.inicio.toISOString(),
      fim: escolhido.fim.toISOString(),
    },
  });
  return {
    tipo: 'reagendado',
    agendamento: {
      id: atual.id,
      tipo: atual.tipo,
      inicio: escolhido.inicio.toISOString(),
      fim: escolhido.fim.toISOString(),
      status: 'reagendado',
      reagendamentosRestantes: avaliacao.restantesDepois,
    },
  };
}

export interface AgendamentoDoCliente extends AgendamentoVisao {
  readonly podeReagendar: boolean;
  /** Por que não pode reagendar, para a tela mandar o cliente falar com a agência. */
  readonly motivoNegado?: MotivoReagendamentoNegado;
}

/** Agendamentos do onboarding do link, com o que o cliente pode fazer com cada um (RN-35). */
export async function listarAgendamentosDoCliente(
  prismaBruto: PrismaClient,
  link: LinkLocalizado,
  agora: Date,
): Promise<AgendamentoDoCliente[]> {
  const { prisma } = await carregarContexto(prismaBruto, link.agenciaId);
  const config = await prisma.configAgencia.findFirstOrThrow();
  const agendamentos = await prisma.agendamento.findMany({
    where: { onboardingId: link.onboardingId },
    orderBy: [{ inicio: 'asc' }],
  });
  return agendamentos.map((a) => {
    const avaliacao = avaliarReagendamento({
      status: a.status,
      reagendamentosFeitos: a.reagendamentos,
      limiteReagendamentos: config.limiteReagendamentos,
      inicio: a.inicio,
      agora,
      antecedenciaReagendamentoHoras: config.antecedenciaReagendamentoHoras,
    });
    return {
      id: a.id,
      tipo: a.tipo,
      inicio: a.inicio.toISOString(),
      fim: a.fim.toISOString(),
      status: a.status,
      reagendamentosRestantes: reagendamentosRestantes(
        a.reagendamentos,
        config.limiteReagendamentos,
      ),
      podeReagendar: avaliacao.ok,
      ...(avaliacao.ok ? {} : { motivoNegado: avaliacao.motivo }),
    };
  });
}
