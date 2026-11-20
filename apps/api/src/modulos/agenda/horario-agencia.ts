import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeAlterarConfiguracoes,
  type PublicadorEventos,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { instanteLocal } from '@convergia/core/agenda';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { PENDENTE_NO_CALENDARIO } from './reagendar.js';
import { restricaoViolada } from './reservar.js';

/** Conflita com outro agendamento ativo da agência (restrição do banco, D-11). */
export class HorarioOcupadoError extends Error {
  override readonly name = 'HorarioOcupadoError';
}

/**
 * A agência muda o horário de uma reunião ou captação (S8-4): qualquer data e hora futura, mesmo
 * fora do horário de atendimento, sem bater com outro agendamento. Não gasta o limite do cliente
 * (RN-35). O evento recalcula o prazo da captação (RN-46) e avisa o cliente do novo horário.
 */
export async function alterarHorarioPelaAgencia(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  usuario: UsuarioAutenticado,
  agendamentoId: string,
  novo: { data: string; hora: string },
  agora: Date,
): Promise<{ id: string; inicio: string; fim: string }> {
  const atual = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      onboarding: { select: { responsavelId: true } },
      agencia: { select: { fusoHorario: true } },
    },
  });
  if (!atual) throw new NaoEncontradoError('Agendamento');
  if (!podeAlterarConfiguracoes(usuario) && atual.onboarding.responsavelId !== usuario.id) {
    throw new ProibidoError('RN-02');
  }
  if (atual.status !== 'agendado' && atual.status !== 'reagendado') {
    throw new RegraVioladaError('RN-36', 'Este agendamento já foi encerrado e não pode mais mudar');
  }
  const inicio = instanteLocal(novo.data, novo.hora, atual.agencia.fusoHorario);
  if (!inicio) throw new RegraVioladaError('RN-35', 'Data ou hora inválida');
  if (inicio.getTime() <= agora.getTime()) {
    throw new RegraVioladaError('RN-35', 'Escolha uma data e hora no futuro');
  }
  if (inicio.getTime() === atual.inicio.getTime()) {
    throw new RegraVioladaError('RN-35', 'Escolha um horário diferente do atual');
  }
  const fim = new Date(inicio.getTime() + (atual.fim.getTime() - atual.inicio.getTime()));

  try {
    await prisma.$transaction([
      prisma.agendamento.updateMany({
        where: { id: agendamentoId, status: { in: ['agendado', 'reagendado'] } },
        // Sem `reagendamentos: increment`: a troca pela agência não gasta o limite do cliente.
        data: { inicio, fim, status: 'reagendado', ...PENDENTE_NO_CALENDARIO },
      }),
      prisma.auditoriaLog.create({
        data: {
          agenciaId: usuario.agenciaId,
          ator: `usuario:${usuario.id}`,
          acao: 'agendamento.horario_alterado',
          entidade: 'Agendamento',
          entidadeId: agendamentoId,
          dados: { tipo: atual.tipo, de: atual.inicio.toISOString(), para: inicio.toISOString() },
        },
      }),
    ]);
  } catch (erro) {
    if (restricaoViolada(erro) === 'agendamentos_sem_sobreposicao') throw new HorarioOcupadoError();
    throw erro;
  }

  await eventos.publicar({
    tipo: 'agendamento.reagendado',
    agenciaId: usuario.agenciaId,
    ocorridoEm: agora,
    dados: {
      agendamentoId,
      onboardingId: atual.onboardingId,
      tipo: atual.tipo,
      inicioAnterior: atual.inicio.toISOString(),
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      porAgencia: true,
    },
  });
  return { id: agendamentoId, inicio: inicio.toISOString(), fim: fim.toISOString() };
}
