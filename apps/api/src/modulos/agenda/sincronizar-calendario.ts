import {
  FalhaCalendarioError,
  decidirDepoisDeFalha,
  type Calendario,
  type EventoCalendario,
} from '@convergia/core/calendario';
import type { PublicadorEventos } from '@convergia/core/base';
import type { PrismaClient } from '../../base/prisma.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    /** O calendário falhou de vez para este agendamento: a agência precisa agir (S5-4). */
    'agendamento.calendario_falhou': { agendamentoId: string; onboardingId: string };
  }
}

/** Por quanto tempo uma sincronização "reserva" o agendamento, para dois workers não o pegarem juntos. */
const RESERVA_DO_WORKER_MIN = 2;
const MS_POR_MINUTO = 60 * 1000;
/** O erro guardado no agendamento é um resumo curto, nunca o corpo da resposta do Google. */
const ERRO_MAX = 200;

export type ResultadoSincronizacao = 'sincronizado' | 'adiado' | 'falhou' | 'ignorado';

const ATIVOS = ['agendado', 'reagendado'] as const;

/**
 * Leva o estado de um agendamento para o calendário externo (RN-34, RN-36, RN-67): cria o evento,
 * atualiza o mesmo evento ao reagendar ou o remove ao cancelar. Falha do calendário nunca desfaz
 * o agendamento: o `evento_externo_id` fica pendente e a tentativa se repete com espera crescente
 * até desistir e avisar a agência. É seguro chamar várias vezes (idempotente por reserva).
 */
export async function sincronizarAgendamento(
  prisma: PrismaClient,
  calendario: Calendario,
  eventos: PublicadorEventos,
  agendamentoId: string,
  agora: Date,
): Promise<ResultadoSincronizacao> {
  // Reserva: só um worker por vez pega este agendamento, e só se já puder ser tentado.
  const reserva = await prisma.agendamento.updateMany({
    where: {
      id: agendamentoId,
      calendarioSituacao: 'pendente',
      OR: [
        { calendarioProximaTentativaEm: null },
        { calendarioProximaTentativaEm: { lte: agora } },
      ],
    },
    data: {
      calendarioProximaTentativaEm: new Date(
        agora.getTime() + RESERVA_DO_WORKER_MIN * MS_POR_MINUTO,
      ),
    },
  });
  if (reserva.count === 0) return 'ignorado';

  const agendamento = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      onboarding: { include: { cliente: { select: { nomeEmpresa: true, email: true } } } },
    },
  });
  // Apagado entre a reserva e a leitura (ex.: exclusão de dados do cliente, RN-73): nada a enviar.
  if (!agendamento) return 'ignorado';
  const ativo = (ATIVOS as readonly string[]).includes(agendamento.status);
  const evento: EventoCalendario = {
    titulo: `${agendamento.tipo === 'reuniao' ? 'Reunião' : 'Captação'} de onboarding: ${agendamento.onboarding.cliente.nomeEmpresa}`,
    inicio: agendamento.inicio,
    fim: agendamento.fim,
    convidados:
      agendamento.onboarding.cliente.email === null ? [] : [agendamento.onboarding.cliente.email],
    // Reunião é online (D-03); captação é presencial e o local entra na S4-4.
    comVideochamada: agendamento.tipo === 'reuniao',
  };

  try {
    let eventoExternoId = agendamento.eventoExternoId;
    let localOuLink = agendamento.localOuLink;

    if (ativo && eventoExternoId === null) {
      const criado = await calendario.criarEvento(evento);
      eventoExternoId = criado.id;
      localOuLink = criado.linkVideochamada ?? localOuLink;
    } else if (ativo && eventoExternoId !== null) {
      await calendario.atualizarEvento(eventoExternoId, evento);
    } else if (agendamento.status === 'cancelado' && eventoExternoId !== null) {
      await calendario.cancelarEvento(eventoExternoId);
    }
    // Realizado e não compareceu mantêm o evento como histórico; nada a enviar.

    // `updateMany` não falha se o agendamento foi apagado enquanto o calendário respondia.
    await prisma.agendamento.updateMany({
      where: { id: agendamentoId },
      data: {
        eventoExternoId,
        localOuLink,
        calendarioSituacao: 'sincronizado',
        calendarioProximaTentativaEm: null,
        calendarioErro: null,
      },
    });
    return 'sincronizado';
  } catch (erro) {
    // Erro que não é da integração (rede, bug) é tratado como transitório: melhor repetir que perder.
    const transitoria = erro instanceof FalhaCalendarioError ? erro.transitoria : true;
    const resumo = (erro instanceof Error ? erro.message : 'Erro desconhecido').slice(0, ERRO_MAX);
    const decisao = decidirDepoisDeFalha({
      tentativasFeitas: agendamento.calendarioTentativas,
      transitoria,
      agora,
    });

    if (decisao.tipo === 'tentar_de_novo') {
      await prisma.agendamento.updateMany({
        where: { id: agendamentoId },
        data: {
          calendarioTentativas: { increment: 1 },
          calendarioProximaTentativaEm: decisao.em,
          calendarioErro: resumo,
        },
      });
      return 'adiado';
    }

    await prisma.$transaction([
      prisma.agendamento.updateMany({
        where: { id: agendamentoId },
        data: {
          calendarioSituacao: 'falhou',
          calendarioTentativas: { increment: 1 },
          calendarioProximaTentativaEm: null,
          calendarioErro: resumo,
        },
      }),
      prisma.auditoriaLog.create({
        data: {
          agenciaId: agendamento.agenciaId,
          ator: 'sistema',
          acao: 'agendamento.calendario_falhou',
          entidade: 'Agendamento',
          entidadeId: agendamentoId,
        },
      }),
    ]);
    await eventos.publicar({
      tipo: 'agendamento.calendario_falhou',
      agenciaId: agendamento.agenciaId,
      ocorridoEm: agora,
      dados: { agendamentoId, onboardingId: agendamento.onboardingId },
    });
    return 'falhou';
  }
}

/** Sincroniza os agendamentos pendentes que já podem ser tentados. Devolve quantos foram processados. */
export async function processarPendentes(
  prisma: PrismaClient,
  calendario: Calendario,
  eventos: PublicadorEventos,
  agora: Date,
  limite = 20,
): Promise<number> {
  const pendentes = await prisma.agendamento.findMany({
    where: {
      calendarioSituacao: 'pendente',
      OR: [
        { calendarioProximaTentativaEm: null },
        { calendarioProximaTentativaEm: { lte: agora } },
      ],
    },
    orderBy: { criadoEm: 'asc' },
    take: limite,
    select: { id: true },
  });
  let processados = 0;
  for (const { id } of pendentes) {
    if ((await sincronizarAgendamento(prisma, calendario, eventos, id, agora)) !== 'ignorado') {
      processados += 1;
    }
  }
  return processados;
}
