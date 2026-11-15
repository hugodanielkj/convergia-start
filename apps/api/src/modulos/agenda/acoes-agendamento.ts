import { mudancaDeStatusPermitida, type StatusAgendamento } from '@convergia/core/agenda';
import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeAlterarConfiguracoes,
  type PublicadorEventos,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { PENDENTE_NO_CALENDARIO } from './reagendar.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    'agendamento.cancelado': AgendamentoDoEvento;
    'agendamento.realizado': AgendamentoDoEvento;
    'agendamento.nao_compareceu': AgendamentoDoEvento;
  }
}

interface AgendamentoDoEvento {
  agendamentoId: string;
  onboardingId: string;
  tipo: 'reuniao' | 'captacao';
  /** Quem marcou, quando foi alguém da agência (o alerta da S5-4 usa, RN-58). */
  usuarioId?: string;
}

export type AcaoDaAgencia = 'cancelar' | 'realizado' | 'nao_compareceu';

type EventoDaAcao =
  'agendamento.cancelado' | 'agendamento.realizado' | 'agendamento.nao_compareceu';

// O mesmo nome serve para a auditoria e para o evento.
const DESTINO: Record<AcaoDaAgencia, { status: StatusAgendamento; evento: EventoDaAcao }> = {
  cancelar: { status: 'cancelado', evento: 'agendamento.cancelado' },
  realizado: { status: 'realizado', evento: 'agendamento.realizado' },
  nao_compareceu: { status: 'nao_compareceu', evento: 'agendamento.nao_compareceu' },
};

/**
 * A agência cancela, conclui ou marca a falta de um agendamento (RN-36, RN-37). Vale para o Admin e
 * para o responsável pelo onboarding (RN-02). Os três são estados finais, e o horário volta a ficar
 * livre porque o agendamento deixa de ser ativo. O evento alimenta o calendário e a mensagem
 * automática de reagendamento da falta (RN-37).
 */
export async function mudarStatusDoAgendamento(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  usuario: UsuarioAutenticado,
  agendamentoId: string,
  acao: AcaoDaAgencia,
  motivo: string | undefined,
  agora: Date,
): Promise<{ id: string; status: StatusAgendamento }> {
  const agendamento = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { onboarding: { select: { responsavelId: true } } },
  });
  if (!agendamento) throw new NaoEncontradoError('Agendamento');
  if (!podeAlterarConfiguracoes(usuario) && agendamento.onboarding.responsavelId !== usuario.id) {
    throw new ProibidoError('RN-02');
  }

  const { status, evento } = DESTINO[acao];
  if (!mudancaDeStatusPermitida(agendamento.status, status)) {
    throw new RegraVioladaError('RN-36', 'Este agendamento já foi encerrado e não pode mais mudar');
  }

  await prisma.$transaction([
    prisma.agendamento.updateMany({
      // Confere o status de novo: duas ações ao mesmo tempo não encerram duas vezes.
      where: { id: agendamentoId, status: { in: ['agendado', 'reagendado'] } },
      data: {
        status,
        ...PENDENTE_NO_CALENDARIO,
        ...(acao === 'cancelar' && motivo !== undefined ? { motivoCancelamento: motivo } : {}),
      },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: evento,
        entidade: 'Agendamento',
        entidadeId: agendamentoId,
        dados: { tipo: agendamento.tipo },
      },
    }),
  ]);
  await eventos.publicar({
    tipo: evento,
    agenciaId: usuario.agenciaId,
    ocorridoEm: agora,
    dados: {
      agendamentoId,
      onboardingId: agendamento.onboardingId,
      tipo: agendamento.tipo,
      usuarioId: usuario.id,
    },
  });
  return { id: agendamentoId, status };
}
