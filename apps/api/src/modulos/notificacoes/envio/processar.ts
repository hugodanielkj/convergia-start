import type { Canal, Mensageria, PublicadorEventos } from '@convergia/core/base';
import { ordemDosCanais, proximoPasso, type EstadoEnvio } from '@convergia/core/envio';
import type { PrismaClient } from '../../../base/prisma.js';

/** Por quanto tempo uma tentativa "reserva" a mensagem, para dois workers não a pegarem juntos. */
const RESERVA_MINUTOS = 2;
const MS_POR_MINUTO = 60_000;
/** O erro guardado é um resumo curto, nunca a resposta inteira do provedor. */
const ERRO_MAX = 200;

/** Reserva a mensagem se ela ainda está pendente, vencida e livre. Devolve `false` se outro pegou. */
async function reservar(prisma: PrismaClient, id: string, agora: Date): Promise<boolean> {
  const { count } = await prisma.notificacao.updateMany({
    where: {
      id,
      status: 'pendente',
      OR: [{ reservadaAte: null }, { reservadaAte: { lt: agora } }],
    },
    data: { reservadaAte: new Date(agora.getTime() + RESERVA_MINUTOS * MS_POR_MINUTO) },
  });
  return count === 1;
}

/**
 * Tenta enviar uma mensagem (RN-60 a RN-62): canal padrão da agência, retentativa com espera e,
 * esgotado, o canal alternativo. O contato sai do cadastro na hora de cada tentativa.
 */
export async function processarNotificacao(
  prisma: PrismaClient,
  mensageria: Mensageria,
  eventos: PublicadorEventos,
  id: string,
  agora: Date,
): Promise<'enviada' | 'aguardando' | 'falhou' | 'ignorada'> {
  if (!(await reservar(prisma, id, agora))) return 'ignorada';
  const n = await prisma.notificacao.findUniqueOrThrow({
    where: { id },
    include: {
      onboarding: { select: { cliente: { select: { whatsapp: true, email: true } } } },
      agencia: { select: { config: { select: { canalNotificacaoPadrao: true } } } },
    },
  });
  const padrao: Canal = n.agencia.config?.canalNotificacaoPadrao ?? 'whatsapp';
  const contatos = n.onboarding.cliente;
  const canais = ordemDosCanais(contatos, padrao);
  let estado: EstadoEnvio = {
    indice: n.canalIndice,
    tentativas: n.tentativas,
    semCredencial: n.semCredencial,
    houveFalha: n.houveFalha,
  };
  let total = n.totalTentativas;

  for (;;) {
    const canal = canais[estado.indice];
    const destinatario = canal ? contatos[canal] : null;
    const resultado =
      canal && destinatario
        ? await mensageria.enviar({
            canal,
            destinatario,
            corpo: n.corpo,
            tipo: n.tipo,
            ...(n.assunto ? { assunto: n.assunto } : {}),
          })
        : ({ ok: false, erro: 'sem_contato', temporario: false } as const);
    if (canal) total += 1;
    const passo = proximoPasso(estado, canais, resultado, agora);

    if (passo.acao === 'trocar_canal') {
      estado = passo.estado;
      continue;
    }
    const comum = { totalTentativas: total, reservadaAte: null, ...(canal ? { canal } : {}) };
    if (passo.acao === 'enviada') {
      await prisma.notificacao.update({
        where: { id },
        data: {
          ...comum,
          status: 'enviada',
          idExterno: passo.idExterno,
          enviadaEm: agora,
          erro: null,
          proximaTentativaEm: null,
        },
      });
      await eventos.publicar({
        tipo: 'notificacao.enviada',
        agenciaId: n.agenciaId,
        ocorridoEm: agora,
        dados: { notificacaoId: id, onboardingId: n.onboardingId, canal: passo.canal },
      });
      return 'enviada';
    }
    if (passo.acao === 'aguardar') {
      await prisma.notificacao.update({
        where: { id },
        data: {
          ...comum,
          canalIndice: passo.estado.indice,
          tentativas: passo.estado.tentativas,
          semCredencial: [...passo.estado.semCredencial],
          houveFalha: passo.estado.houveFalha,
          proximaTentativaEm: passo.em,
          erro: passo.erro.slice(0, ERRO_MAX),
        },
      });
      return 'aguardando';
    }
    await prisma.notificacao.update({
      where: { id },
      data: {
        ...comum,
        status: 'falhou',
        erro: passo.erro.slice(0, ERRO_MAX),
        proximaTentativaEm: null,
      },
    });
    await eventos.publicar({
      tipo: 'notificacao.falhou',
      agenciaId: n.agenciaId,
      ocorridoEm: agora,
      dados: {
        notificacaoId: id,
        onboardingId: n.onboardingId,
        erro: passo.erro.slice(0, ERRO_MAX),
      },
    });
    return 'falhou';
  }
}

/** Rotina do sistema: tenta as pendentes vencidas de todas as agências, em lotes. */
export async function processarPendentes(
  prisma: PrismaClient,
  mensageria: Mensageria,
  eventos: PublicadorEventos,
  agora: Date,
  lote: number,
): Promise<number> {
  const vencidas = await prisma.notificacao.findMany({
    where: {
      status: 'pendente',
      proximaTentativaEm: { lte: agora },
      OR: [{ reservadaAte: null }, { reservadaAte: { lt: agora } }],
    },
    orderBy: { proximaTentativaEm: 'asc' },
    take: lote,
    select: { id: true },
  });
  for (const { id } of vencidas) await processarNotificacao(prisma, mensageria, eventos, id, agora);
  return vencidas.length;
}
