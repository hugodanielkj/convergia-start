import {
  destinatariosDoAlerta,
  ehTipoAlerta,
  proximoPassoEmailAlerta,
  textoDoAlerta,
} from '@convergia/core/alertas';
import type { Mensageria } from '@convergia/core/base';
import { ERRO_CANAL_NAO_CONFIGURADO } from '@convergia/core/envio';
import type { PrismaClient } from '../../../base/prisma.js';

const RESERVA_MS = 2 * 60_000;
const ERRO_MAX = 200;

async function reservar(prisma: PrismaClient, id: string, agora: Date): Promise<boolean> {
  const { count } = await prisma.alertaInterno.updateMany({
    where: {
      id,
      email: 'pendente',
      OR: [{ emailReservadoAte: null }, { emailReservadoAte: { lt: agora } }],
    },
    data: { emailReservadoAte: new Date(agora.getTime() + RESERVA_MS) },
  });
  return count === 1;
}

/**
 * Manda o e-mail de um aviso ao responsável (ou aos Admins, se ele estiver inativo), com
 * retentativa. Sem destinatário, o aviso fica só no painel.
 */
export async function enviarEmailDoAlerta(
  prisma: PrismaClient,
  mensageria: Mensageria,
  urlApp: string,
  id: string,
  agora: Date,
): Promise<'enviado' | 'aguardando' | 'falhou' | 'dispensado' | 'ignorado'> {
  if (!(await reservar(prisma, id, agora))) return 'ignorado';
  const alerta = await prisma.alertaInterno.findUniqueOrThrow({
    where: { id },
    include: {
      onboarding: {
        select: {
          cliente: { select: { nomeEmpresa: true } },
          responsavel: { select: { email: true, ativo: true } },
        },
      },
    },
  });
  const admins = await prisma.usuario.findMany({
    where: { agenciaId: alerta.agenciaId, papel: 'admin' },
    select: { email: true, ativo: true },
  });
  const para = destinatariosDoAlerta(alerta.onboarding.responsavel, admins);
  if (para.length === 0 || !ehTipoAlerta(alerta.tipo)) {
    await prisma.alertaInterno.update({
      where: { id },
      data: { email: 'dispensado', emailProximaEm: null, emailReservadoAte: null },
    });
    return 'dispensado';
  }

  const texto = textoDoAlerta(alerta.tipo, alerta.onboarding.cliente.nomeEmpresa, alerta.detalhe);
  const corpo = `${texto}\n\nVeja o onboarding: ${urlApp.replace(/\/$/, '')}/onboardings/${alerta.onboardingId}`;
  let erro: string | null = null;
  for (const destinatario of para) {
    const r = await mensageria.enviar({
      canal: 'email',
      destinatario,
      assunto: `Aviso: ${texto}`,
      corpo,
      tipo: 'alerta_interno',
    });
    if (!r.ok) erro = r.erro;
  }
  const passo = proximoPassoEmailAlerta(
    alerta.emailTentativas,
    erro === null
      ? { ok: true }
      : { ok: false, semCredencial: erro === ERRO_CANAL_NAO_CONFIGURADO },
    agora,
  );
  const comum = { emailReservadoAte: null, emailErro: erro?.slice(0, ERRO_MAX) ?? null };
  if (passo.acao === 'enviado') {
    await prisma.alertaInterno.update({
      where: { id },
      data: { ...comum, email: 'enviado', emailProximaEm: null },
    });
    return 'enviado';
  }
  if (passo.acao === 'falhou') {
    await prisma.alertaInterno.update({
      where: { id },
      data: { ...comum, email: 'falhou', emailProximaEm: null, emailTentativas: { increment: 1 } },
    });
    return 'falhou';
  }
  await prisma.alertaInterno.update({
    where: { id },
    data: {
      ...comum,
      emailProximaEm: passo.em,
      ...(passo.contaTentativa ? { emailTentativas: { increment: 1 } } : {}),
    },
  });
  return 'aguardando';
}

/** Rotina do sistema: e-mails de aviso vencidos, de todas as agências. */
export async function enviarEmailsPendentes(
  prisma: PrismaClient,
  mensageria: Mensageria,
  urlApp: string,
  agora: Date,
  lote: number,
): Promise<number> {
  const pendentes = await prisma.alertaInterno.findMany({
    where: {
      email: 'pendente',
      emailProximaEm: { lte: agora },
      OR: [{ emailReservadoAte: null }, { emailReservadoAte: { lt: agora } }],
    },
    orderBy: { emailProximaEm: 'asc' },
    take: lote,
    select: { id: true },
  });
  for (const { id } of pendentes) await enviarEmailDoAlerta(prisma, mensageria, urlApp, id, agora);
  return pendentes.length;
}
