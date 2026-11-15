import { randomBytes } from 'node:crypto';
import { NaoEncontradoError, type PublicadorEventos } from '@convergia/core/base';
import {
  bloqueadaPorOptOut,
  comRodapeOptOut,
  type CategoriaNotificacao,
} from '@convergia/core/envio';
import { recebeLembretes } from '@convergia/core/estados';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    /** Há mensagem nova na fila: o worker de envio tenta na hora. */
    'notificacao.enfileirada': { notificacaoId: string; onboardingId: string };
    'notificacao.enviada': {
      notificacaoId: string;
      onboardingId: string;
      canal: 'whatsapp' | 'email';
    };
    /** Falhou em todos os canais (RN-60, RN-62): alerta interno da S5-4. */
    'notificacao.falhou': { notificacaoId: string; onboardingId: string; erro: string };
  }
}

export interface NovaNotificacao {
  readonly onboardingId: string;
  /** Tipo do template ou do evento (ex.: "convite", "lembrete_pendencia"). */
  readonly tipo: string;
  readonly categoria: CategoriaNotificacao;
  /**
   * Chave de idempotência: a mesma chave nunca gera duas mensagens para a agência. Ex.:
   * `lembrete_pendencia:<onboardingId>:1`. Quem enfileira escolhe a chave.
   */
  readonly chave: string;
  readonly assunto?: string;
  /** Texto final, já com as variáveis preenchidas (`preencherTemplate`). */
  readonly corpo: string;
  /** RN-59: só sai no horário permitido (convite automático, lembretes, reenvios). */
  readonly respeitarJanela?: boolean;
}

export type ResultadoEnfileirar =
  | { readonly situacao: 'enfileirada'; readonly id: string }
  | { readonly situacao: 'duplicada' }
  | { readonly situacao: 'opt_out' }
  | { readonly situacao: 'sem_lembretes' };

const TOKEN_BYTES = 32;

/** Token do link "parar de receber lembretes" do onboarding, criado na primeira vez (RN-61). */
export async function tokenOptOut(
  prisma: PrismaDaAgencia,
  agenciaId: string,
  onboardingId: string,
) {
  const existente = await prisma.preferenciaEnvio.findFirst({ where: { onboardingId } });
  if (existente) return existente;
  return prisma.preferenciaEnvio.upsert({
    where: { onboardingId },
    create: {
      agenciaId,
      onboardingId,
      tokenOptOut: randomBytes(TOKEN_BYTES).toString('base64url'),
    },
    update: {},
  });
}

/**
 * Contrato de envio para as duas trilhas (RN-60 a RN-62): registra a mensagem em `Notificacao` e o
 * worker envia pelo canal padrão da agência, com retentativa e canal alternativo. Lembrete respeita
 * o opt-out e o status do onboarding (RN-53, RN-61) e ganha o link para parar.
 */
export async function enfileirarNotificacao(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  urlApp: string,
  nova: NovaNotificacao,
  agora: Date,
): Promise<ResultadoEnfileirar> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: nova.onboardingId },
    select: { agenciaId: true, statusGeral: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');

  let corpo = nova.corpo;
  if (nova.categoria === 'lembrete') {
    if (!recebeLembretes(onboarding.statusGeral)) return { situacao: 'sem_lembretes' };
    const pref = await tokenOptOut(prisma, onboarding.agenciaId, nova.onboardingId);
    if (bloqueadaPorOptOut(nova.categoria, pref.lembretesDesativadosEm !== null)) {
      return { situacao: 'opt_out' };
    }
    corpo = comRodapeOptOut(
      corpo,
      `${urlApp.replace(/\/$/, '')}/parar-lembretes/${pref.tokenOptOut}`,
    );
  }

  const criadas = await prisma.notificacao.createManyAndReturn({
    data: [
      {
        agenciaId: onboarding.agenciaId,
        onboardingId: nova.onboardingId,
        tipo: nova.tipo,
        categoria: nova.categoria,
        chave: nova.chave,
        assunto: nova.assunto ?? null,
        corpo,
        respeitarJanela: nova.respeitarJanela ?? false,
        // Relógio da aplicação, não do banco: o intervalo de reenvio (RN-66) compara com ele.
        criadoEm: agora,
        proximaTentativaEm: agora,
      },
    ],
    skipDuplicates: true,
    select: { id: true },
  });
  const criada = criadas[0];
  if (!criada) return { situacao: 'duplicada' };
  await eventos.publicar({
    tipo: 'notificacao.enfileirada',
    agenciaId: onboarding.agenciaId,
    ocorridoEm: agora,
    dados: { notificacaoId: criada.id, onboardingId: nova.onboardingId },
  });
  return { situacao: 'enfileirada', id: criada.id };
}
