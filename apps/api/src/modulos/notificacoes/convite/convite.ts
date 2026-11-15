import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeAlterarConfiguracoes,
  type PublicadorEventos,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { recebeLembretes } from '@convergia/core/estados';
import {
  dataNaMensagem,
  horaNaMensagem,
  janelaDaConfig,
  proximoHorarioPermitido,
  reenvioBloqueadoAte,
  textoPendencias,
} from '@convergia/core/lembretes';
import { onboardingAtivo } from '@convergia/core/onboarding';
import { preencherTemplate } from '@convergia/core/templates';
import { registrarAuditoria } from '../../../base/auditoria.js';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';
import { linkAtual, urlDoLink } from '../../link/link-atual.js';
import { textoDoTemplate } from '../../templates/templates.js';
import { enfileirarNotificacao } from '../envio/enfileirar.js';
import { valoresDoOnboarding } from '../lembretes/varrer.js';

export interface DepsConvite {
  readonly eventos: PublicadorEventos;
  readonly urlApp: string;
  readonly chaveLink: Uint8Array | null;
}

/** Quando a mensagem sai, pela janela de envio da agência (RN-59). */
async function quandoSai(prisma: PrismaDaAgencia, agora: Date): Promise<Date> {
  const [config, agencia] = await Promise.all([
    prisma.configAgencia.findFirstOrThrow(),
    prisma.agencia.findFirstOrThrow({ select: { fusoHorario: true } }),
  ]);
  return proximoHorarioPermitido(agora, janelaDaConfig(config, agencia.fusoHorario)) ?? agora;
}

/**
 * RN-09: põe o convite na fila com o link do cliente. Respeita a janela (RN-59). A `chave` evita
 * mandar o mesmo convite duas vezes. Devolve quando ele deve sair.
 */
export async function enfileirarConvite(
  prisma: PrismaDaAgencia,
  deps: DepsConvite,
  onboardingId: string,
  urlLink: string,
  chave: string,
  agora: Date,
): Promise<Date> {
  const valores = await valoresDoOnboarding(prisma, onboardingId, urlLink);
  const corpo = preencherTemplate(await textoDoTemplate(prisma, 'convite'), valores);
  await enfileirarNotificacao(
    prisma,
    deps.eventos,
    deps.urlApp,
    {
      onboardingId,
      tipo: 'convite',
      categoria: 'transacional',
      chave,
      corpo,
      respeitarJanela: true,
    },
    agora,
  );
  return quandoSai(prisma, agora);
}

type Reenvio = 'convite' | 'lembrete_pendencia';

/** Admin ou responsável, onboarding ativo e link recuperável; respeita o intervalo (RN-66). */
async function prepararReenvio(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  deps: DepsConvite,
  onboardingId: string,
  tipo: Reenvio,
  agora: Date,
) {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    select: { responsavelId: true, statusGeral: true, agencia: { select: { fusoHorario: true } } },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeAlterarConfiguracoes(usuario) && onboarding.responsavelId !== usuario.id) {
    throw new ProibidoError('RN-02');
  }
  if (!onboardingAtivo(onboarding.statusGeral)) {
    throw new RegraVioladaError('RN-53', 'Onboarding encerrado não recebe mensagens');
  }
  const config = await prisma.configAgencia.findFirstOrThrow({
    select: { intervaloMinimoReenvioHoras: true },
  });
  const ultima = await prisma.notificacao.findFirst({
    where: { onboardingId, tipo, status: { not: 'cancelada' } },
    orderBy: { criadoEm: 'desc' },
    select: { criadoEm: true },
  });
  const ate = reenvioBloqueadoAte(
    ultima?.criadoEm ?? null,
    config.intervaloMinimoReenvioHoras,
    agora,
  );
  if (ate) {
    const fuso = onboarding.agencia.fusoHorario;
    throw new RegraVioladaError(
      'RN-66',
      `Aguarde para reenviar: liberado em ${dataNaMensagem(ate, fuso)} às ${horaNaMensagem(ate, fuso)}`,
    );
  }
  const link = await linkAtual(prisma, deps.chaveLink, onboardingId);
  if (!link) {
    throw new RegraVioladaError(
      'RN-12',
      'O link atual não pode ser recuperado. Use "Regenerar link" e envie o link novo.',
    );
  }
  return { onboarding, url: urlDoLink(deps.urlApp, link) };
}

/** Ação rápida "Reenviar convite" (RN-65, RN-66). Auditada (RN-77). */
export async function reenviarConvite(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  deps: DepsConvite,
  onboardingId: string,
  agora: Date,
): Promise<Date> {
  const { url } = await prepararReenvio(prisma, usuario, deps, onboardingId, 'convite', agora);
  const enviaEm = await enfileirarConvite(
    prisma,
    deps,
    onboardingId,
    url,
    `convite:${onboardingId}:manual:${agora.toISOString()}`,
    agora,
  );
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'convite.reenviado',
    entidade: 'Onboarding',
    entidadeId: onboardingId,
  });
  return enviaEm;
}

/**
 * Ação rápida "Reenviar lembrete" (RN-65, RN-66): o lembrete de pendência na hora (respeitando a
 * janela), sem contar no máximo dos automáticos. Obedece ao opt-out (RN-61). Auditada (RN-77).
 */
export async function reenviarLembrete(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  deps: DepsConvite,
  onboardingId: string,
  agora: Date,
): Promise<Date> {
  const { onboarding, url } = await prepararReenvio(
    prisma,
    usuario,
    deps,
    onboardingId,
    'lembrete_pendencia',
    agora,
  );
  if (!recebeLembretes(onboarding.statusGeral)) {
    throw new RegraVioladaError('RN-53', 'Onboarding pausado não recebe lembretes');
  }
  const pendentes = await prisma.etapaOnboarding.findMany({
    where: { onboardingId, status: { not: 'concluida' } },
    select: { tipo: true },
  });
  if (pendentes.length === 0) {
    throw new RegraVioladaError('RN-56', 'Não há etapa pendente para lembrar');
  }
  const valores = await valoresDoOnboarding(prisma, onboardingId, url);
  const corpo = preencherTemplate(await textoDoTemplate(prisma, 'lembrete_pendencia'), {
    ...valores,
    pendencias: textoPendencias(pendentes.map((p) => p.tipo)),
  });
  const r = await enfileirarNotificacao(
    prisma,
    deps.eventos,
    deps.urlApp,
    {
      onboardingId,
      tipo: 'lembrete_pendencia',
      categoria: 'lembrete',
      chave: `lembrete_pendencia:${onboardingId}:manual:${agora.toISOString()}`,
      corpo,
      respeitarJanela: true,
    },
    agora,
  );
  if (r.situacao === 'opt_out') {
    throw new RegraVioladaError('RN-61', 'O cliente pediu para não receber lembretes');
  }
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'lembrete.reenviado',
    entidade: 'Onboarding',
    entidadeId: onboardingId,
  });
  return quandoSai(prisma, agora);
}
