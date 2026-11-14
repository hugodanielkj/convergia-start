import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeVerOnboarding,
  type PublicadorEventos,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import {
  destinoDaAcao,
  exigeAdmin,
  garantirTransicao,
  motivoDaAcao,
  proximoStatusAutomatico,
  venceuConclusaoAutomatica,
  type AcaoManual,
} from '@convergia/core/estados';
import type { StatusOnboarding } from '@convergia/core/onboarding';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';
import { dataDaEntrega, lerFatos, type TransacaoDaAgencia } from './fatos.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    /**
     * Toda mudança do status geral (RN-49). Lembretes, prazo e mensagens reagem a ela: pausado,
     * cancelado e concluído cessam lembretes (RN-53); cancelado avisa o cliente (S5).
     */
    'onboarding.status_alterado': {
      onboardingId: string;
      de: StatusOnboarding;
      para: StatusOnboarding;
      motivo: string | null;
      /** Agendamentos futuros cancelados junto com o onboarding (RN-53); vazio nos outros casos. */
      agendamentosCancelados: string[];
    };
    /**
     * Contrato para os módulos que mudam etapas ou agendamentos (as duas trilhas): publique este
     * evento depois de gravar e o status geral é recalculado (RN-49). `ator` como na auditoria.
     */
    'onboarding.etapas_mudaram': { onboardingId: string; ator: string };
  }
}

export interface Transicao {
  readonly onboardingId: string;
  readonly agenciaId: string;
  readonly de: StatusOnboarding;
  readonly para: StatusOnboarding;
  readonly motivo: string | null;
  readonly ator: string;
  readonly agora: Date;
}

/**
 * Grava a mudança de status: confere de novo o status atual (duas ações ao mesmo tempo não mudam
 * duas vezes), guarda o histórico e audita (RN-77). Devolve `false` se outro processo mudou antes.
 */
async function gravarTransicao(tx: TransacaoDaAgencia, t: Transicao): Promise<boolean> {
  const { count } = await tx.onboarding.updateMany({
    where: { id: t.onboardingId, statusGeral: t.de },
    data: { statusGeral: t.para },
  });
  if (count === 0) return false;
  await tx.transicaoStatus.create({
    data: {
      agenciaId: t.agenciaId,
      onboardingId: t.onboardingId,
      de: t.de,
      para: t.para,
      motivo: t.motivo,
      ator: t.ator,
      em: t.agora,
    },
  });
  await tx.auditoriaLog.create({
    data: {
      agenciaId: t.agenciaId,
      ator: t.ator,
      acao: 'onboarding.status_alterado',
      entidade: 'Onboarding',
      entidadeId: t.onboardingId,
      dados: { de: t.de, para: t.para, motivo: t.motivo },
      em: t.agora,
    },
  });
  return true;
}

/** RN-53: cancelar o onboarding cancela os agendamentos que ainda não aconteceram. */
async function cancelarAgendamentosFuturos(
  tx: TransacaoDaAgencia,
  t: Transicao,
): Promise<string[]> {
  const futuros = await tx.agendamento.findMany({
    where: {
      onboardingId: t.onboardingId,
      status: { in: ['agendado', 'reagendado'] },
      inicio: { gt: t.agora },
    },
    select: { id: true, tipo: true },
  });
  if (futuros.length === 0) return [];
  const ids = futuros.map((a) => a.id);
  await tx.agendamento.updateMany({ where: { id: { in: ids } }, data: { status: 'cancelado' } });
  await tx.auditoriaLog.createMany({
    data: futuros.map((a) => ({
      agenciaId: t.agenciaId,
      ator: t.ator,
      acao: 'agendamento.cancelado',
      entidade: 'Agendamento',
      entidadeId: a.id,
      dados: { tipo: a.tipo, motivo: 'onboarding_cancelado' },
      em: t.agora,
    })),
  });
  return ids;
}

function publicar(
  eventos: PublicadorEventos,
  t: Transicao,
  agendamentosCancelados: string[],
): Promise<void> {
  return eventos.publicar({
    tipo: 'onboarding.status_alterado',
    agenciaId: t.agenciaId,
    ocorridoEm: t.agora,
    dados: {
      onboardingId: t.onboardingId,
      de: t.de,
      para: t.para,
      motivo: t.motivo,
      agendamentosCancelados,
    },
  });
}

/** Avisa a máquina de estados que etapas ou agendamentos mudaram (evento `onboarding.etapas_mudaram`). */
export function avisarEtapasMudaram(
  eventos: PublicadorEventos,
  agenciaId: string,
  onboardingId: string,
  ator: string,
  agora: Date,
): Promise<void> {
  return eventos.publicar({
    tipo: 'onboarding.etapas_mudaram',
    agenciaId,
    ocorridoEm: agora,
    dados: { onboardingId, ator },
  });
}

const TENTATIVAS_RECALCULO = 3;

/**
 * Recalcula o status geral a partir das etapas e dos agendamentos (RN-49 a RN-51) e grava se mudou.
 * Contrato para os outros módulos: chame depois de mudar etapa ou agendamento, fora da transação.
 * Pausado, cancelado e concluído não mudam por aqui.
 */
export async function recalcularStatus(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  onboardingId: string,
  ator: string,
  agora: Date,
): Promise<StatusOnboarding> {
  for (let tentativa = 1; ; tentativa++) {
    const resultado = await prisma.$transaction(async (tx) => {
      const onboarding = await tx.onboarding.findFirst({
        where: { id: onboardingId },
        select: { statusGeral: true, agenciaId: true },
      });
      if (!onboarding) throw new NaoEncontradoError('Onboarding');
      const de = onboarding.statusGeral;
      const para = proximoStatusAutomatico(de, await lerFatos(tx, onboardingId));
      if (para === de) return { status: de, transicao: null };
      const t = {
        onboardingId,
        agenciaId: onboarding.agenciaId,
        de,
        para,
        motivo: null,
        ator,
        agora,
      };
      return (await gravarTransicao(tx, t)) ? { status: para, transicao: t } : null;
    });
    if (resultado) {
      if (resultado.transicao) await publicar(eventos, resultado.transicao, []);
      return resultado.status;
    }
    // Outro processo mudou o status no meio; com poucas tentativas, a última leitura vence.
    if (tentativa >= TENTATIVAS_RECALCULO) {
      throw new RegraVioladaError('RN-49', 'O status mudou ao mesmo tempo; tente de novo');
    }
  }
}

/** Ação da agência sobre o status: pausar, retomar, cancelar, registrar entrega ou encerrar. */
export async function executarAcao(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  acao: AcaoManual,
  motivoInformado: string | undefined,
  agora: Date,
): Promise<StatusOnboarding> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: { responsavelId: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, onboarding.responsavelId)) throw new ProibidoError('RN-02');
  if (exigeAdmin(acao) && usuario.papel !== 'admin') throw new ProibidoError('RN-53');
  const motivo = motivoDaAcao(acao, motivoInformado);

  const { t, cancelados } = await prisma.$transaction(async (tx) => {
    const atual = await tx.onboarding.findFirstOrThrow({
      where: { id: onboardingId },
      select: { statusGeral: true },
    });
    const para = destinoDaAcao(acao, atual.statusGeral, await lerFatos(tx, onboardingId));
    const transicao: Transicao = {
      onboardingId,
      agenciaId: usuario.agenciaId,
      de: atual.statusGeral,
      para,
      motivo,
      ator: `usuario:${usuario.id}`,
      agora,
    };
    if (!(await gravarTransicao(tx, transicao))) {
      throw new RegraVioladaError('RN-49', 'O status mudou enquanto você agia; atualize a página');
    }
    const ids = para === 'cancelado' ? await cancelarAgendamentosFuturos(tx, transicao) : [];
    return { t: transicao, cancelados: ids };
  });
  await publicar(eventos, t, cancelados);
  return t.para;
}

/**
 * RN-52: conclui sozinho quem está em `primeiro_conteudo_entregue` há `diasConclusaoAutomatica`
 * dias. Roda para todas as agências (worker do sistema), sempre pelo cliente escopado de cada uma.
 */
export async function concluirVencidos(
  prismaDaAgencia: (agenciaId: string) => PrismaDaAgencia,
  agencias: readonly { agenciaId: string; dias: number }[],
  eventos: PublicadorEventos,
  agora: Date,
): Promise<number> {
  let concluidos = 0;
  for (const { agenciaId, dias } of agencias) {
    const prisma = prismaDaAgencia(agenciaId);
    const candidatos = await prisma.onboarding.findMany({
      where: { statusGeral: 'primeiro_conteudo_entregue' },
      select: { id: true },
    });
    for (const { id } of candidatos) {
      const t = await prisma.$transaction(async (tx) => {
        // A última entrega vale: retomar de uma pausa recomeça a contagem.
        const entregueEm = await dataDaEntrega(tx, id);
        if (!entregueEm || !venceuConclusaoAutomatica(entregueEm, agora, dias)) return null;
        const transicao: Transicao = {
          onboardingId: id,
          agenciaId,
          de: 'primeiro_conteudo_entregue',
          para: 'concluido',
          motivo: null,
          ator: 'sistema',
          agora,
        };
        garantirTransicao(transicao.de, transicao.para);
        return (await gravarTransicao(tx, transicao)) ? transicao : null;
      });
      if (t) {
        concluidos++;
        await publicar(eventos, t, []);
      }
    }
  }
  return concluidos;
}
