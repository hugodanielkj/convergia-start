import { dataLocal } from '@convergia/core/agenda';
import type { PublicadorEventos } from '@convergia/core/base';
import { dataNaMensagem, horaNaMensagem } from '@convergia/core/lembretes';
import { onboardingAtivo } from '@convergia/core/onboarding';
import { preencherTemplate } from '@convergia/core/templates';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';
import { linkAtual, urlDoLink } from '../../link/link-atual.js';
import { textoDaData } from '../../prazo/recalcular.js';
import { textoDoTemplate } from '../../templates/templates.js';
import { enfileirarNotificacao } from '../envio/enfileirar.js';
import { valoresDoOnboarding } from '../lembretes/varrer.js';

export interface DepsConfirmacao {
  readonly eventos: PublicadorEventos;
  readonly urlApp: string;
  readonly chaveLink: Uint8Array | null;
}

const MARCADOS = ['agendado', 'reagendado', 'realizado'] as const;

/** "2026-12-03" → "03/12/2026". */
const dataDoPrazo = (data: Date): string => textoDaData(data).split('-').reverse().join('/');

/**
 * Confirmação final com prazo (seção 8, critério 1 da seção 12): sai na hora, sem esperar a janela,
 * quando as 4 etapas estão concluídas e o prazo foi calculado. A chave inclui o prazo e o horário da
 * captação: reagendar a captação manda uma confirmação nova (RN-46); o resto nunca repete.
 */
export async function enfileirarConfirmacao(
  prisma: PrismaDaAgencia,
  deps: DepsConfirmacao,
  onboardingId: string,
  agora: Date,
): Promise<boolean> {
  const o = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: {
      statusGeral: true,
      etapas: { select: { status: true } },
      prazo: { select: { data: true, captacaoData: true } },
      agencia: { select: { fusoHorario: true } },
      agendamentos: {
        where: { status: { in: [...MARCADOS] } },
        orderBy: { inicio: 'desc' },
        select: { tipo: true, inicio: true, dadosCaptacao: { select: { local: true } } },
      },
    },
  });
  if (!o?.prazo || !onboardingAtivo(o.statusGeral)) return false;
  if (o.etapas.length === 0 || o.etapas.some((e) => e.status !== 'concluida')) return false;
  const reuniao = o.agendamentos.find((a) => a.tipo === 'reuniao');
  const captacao = o.agendamentos.find((a) => a.tipo === 'captacao');
  if (!reuniao || !captacao) return false;

  const fuso = o.agencia.fusoHorario;
  // Captação remarcada para outro dia: espera o prazo novo, que chega pelo evento do prazo.
  if (textoDaData(o.prazo.captacaoData) !== dataLocal(captacao.inicio, fuso)) return false;
  const link = await linkAtual(prisma, deps.chaveLink, onboardingId);
  const valores = {
    ...(await valoresDoOnboarding(prisma, onboardingId, link ? urlDoLink(deps.urlApp, link) : '')),
    data_reuniao: dataNaMensagem(reuniao.inicio, fuso),
    hora_reuniao: horaNaMensagem(reuniao.inicio, fuso),
    data_captacao: dataNaMensagem(captacao.inicio, fuso),
    hora_captacao: horaNaMensagem(captacao.inicio, fuso),
    local_captacao: captacao.dadosCaptacao?.local ?? 'local a combinar',
    prazo_liberacao: dataDoPrazo(o.prazo.data),
  };
  const corpo = preencherTemplate(await textoDoTemplate(prisma, 'confirmacao_prazo'), valores);
  const r = await enfileirarNotificacao(
    prisma,
    deps.eventos,
    deps.urlApp,
    {
      onboardingId,
      tipo: 'confirmacao_prazo',
      categoria: 'transacional',
      chave: `confirmacao_prazo:${onboardingId}:${textoDaData(o.prazo.data)}:${captacao.inicio.toISOString()}`,
      corpo,
    },
    agora,
  );
  return r.situacao === 'enfileirada';
}
