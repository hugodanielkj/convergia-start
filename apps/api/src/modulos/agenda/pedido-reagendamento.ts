import { avaliarReagendamento } from '@convergia/core/agenda';
import type { PublicadorEventos } from '@convergia/core/base';
import { escopoAgencia } from '../../base/escopo-agencia.js';
import type { PrismaClient } from '../../base/prisma.js';
import type { LinkLocalizado } from '../link/localizar-link.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    /** O cliente não pode mais reagendar sozinho e pediu à agência (S8-4): vira aviso (RN-58). */
    'agendamento.reagendamento_pedido': {
      agendamentoId: string;
      onboardingId: string;
      tipo: 'reuniao' | 'captacao';
      /** Horário atual: um pedido por horário. */
      inicio: string;
      motivo: string;
    };
  }
}

/** Chave do aviso do pedido: um por agendamento e horário. A agenda usa para dizer "já pedido". */
export const chavePedidoReagendamento = (agendamentoId: string, inicio: Date): string =>
  `pedido_reagendamento:${agendamentoId}:${inicio.toISOString()}`;

export type ResultadoPedido =
  | { readonly tipo: 'pedido' }
  | { readonly tipo: 'ainda_pode' }
  | { readonly tipo: 'nao_encontrado' };

/**
 * O cliente passou do limite de reagendamentos ou da antecedência (RN-35) e pede para reagendar,
 * com um motivo. Enquanto ainda pode reagendar sozinho, o pedido é recusado.
 */
export async function pedirReagendamento(
  prismaBruto: PrismaClient,
  eventos: PublicadorEventos,
  link: LinkLocalizado,
  agendamentoId: string,
  motivo: string,
  agora: Date,
): Promise<ResultadoPedido> {
  const prisma = escopoAgencia(prismaBruto, link.agenciaId);
  const [atual, config] = await Promise.all([
    prisma.agendamento.findFirst({
      where: {
        id: agendamentoId,
        onboardingId: link.onboardingId,
        status: { in: ['agendado', 'reagendado'] },
      },
    }),
    prisma.configAgencia.findFirstOrThrow(),
  ]);
  if (!atual) return { tipo: 'nao_encontrado' };
  const avaliacao = avaliarReagendamento({
    status: atual.status,
    reagendamentosFeitos: atual.reagendamentos,
    limiteReagendamentos: config.limiteReagendamentos,
    inicio: atual.inicio,
    agora,
    antecedenciaReagendamentoHoras: config.antecedenciaReagendamentoHoras,
  });
  if (avaliacao.ok) return { tipo: 'ainda_pode' };

  await prisma.auditoriaLog.create({
    data: {
      agenciaId: link.agenciaId,
      ator: `cliente:${link.onboardingId}`,
      acao: 'agendamento.reagendamento_pedido',
      entidade: 'Agendamento',
      entidadeId: atual.id,
      dados: { tipo: atual.tipo },
    },
  });
  await eventos.publicar({
    tipo: 'agendamento.reagendamento_pedido',
    agenciaId: link.agenciaId,
    ocorridoEm: agora,
    dados: {
      agendamentoId: atual.id,
      onboardingId: link.onboardingId,
      tipo: atual.tipo,
      inicio: atual.inicio.toISOString(),
      motivo,
    },
  });
  return { tipo: 'pedido' };
}
