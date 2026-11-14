import { RegraVioladaError } from '@convergia/core/base';
import {
  acessosAvisados,
  etapaInicial,
  liberacaoEtapas,
  type EtapaCliente,
  type FatosLiberacao,
  type SituacaoLiberacao,
} from '@convergia/core/liberacao';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { situacoesEscolhidas } from '../acessos/acessos.js';

/** Agendamento que conta como "feito" para a liberação (RN-79): marcado, remarcado ou realizado. */
const VALE = ['agendado', 'reagendado', 'realizado'] as const;

export async function fatosDoOnboarding(
  prisma: PrismaDaAgencia,
  onboardingId: string,
): Promise<FatosLiberacao> {
  const [resposta, acessos, agendamentos] = await Promise.all([
    prisma.respostaFormulario.findFirst({ where: { onboardingId }, select: { enviadaEm: true } }),
    situacoesEscolhidas(prisma, onboardingId),
    prisma.agendamento.findMany({
      where: { onboardingId, status: { in: [...VALE] } },
      select: { tipo: true },
    }),
  ]);
  return {
    formularioEnviado: (resposta?.enviadaEm ?? null) !== null,
    acessosAvisados: acessosAvisados(acessos),
    reuniaoAgendada: agendamentos.some((a) => a.tipo === 'reuniao'),
    captacaoAgendada: agendamentos.some((a) => a.tipo === 'captacao'),
  };
}

export interface EtapaDoCliente extends SituacaoLiberacao {
  /** Status da etapa no onboarding (RN-06): pendente, em_andamento, concluida, bloqueada. */
  readonly status: string;
}

export interface EtapasDoCliente {
  readonly etapas: EtapaDoCliente[];
  /** Onde a página abre (RN-79). */
  readonly atual: EtapaCliente;
}

export async function etapasDoCliente(
  prisma: PrismaDaAgencia,
  onboardingId: string,
): Promise<EtapasDoCliente> {
  const [fatos, linhas] = await Promise.all([
    fatosDoOnboarding(prisma, onboardingId),
    prisma.etapaOnboarding.findMany({
      where: { onboardingId },
      select: { tipo: true, status: true },
    }),
  ]);
  const situacoes = liberacaoEtapas(fatos);
  return {
    etapas: situacoes.map((s) => ({
      ...s,
      status: linhas.find((l) => l.tipo === s.etapa)?.status ?? 'pendente',
    })),
    atual: etapaInicial(situacoes),
  };
}

const NOME: Record<EtapaCliente, string> = {
  formulario: 'o formulário',
  acessos: 'os acessos',
  reuniao: 'a reunião',
  captacao: 'a captação',
};

/**
 * Contrato para os módulos das etapas (RN-79): recusa a ação numa etapa ainda bloqueada. As
 * etapas anteriores precisam estar concluídas.
 */
export async function exigirEtapaLiberada(
  prisma: PrismaDaAgencia,
  onboardingId: string,
  etapa: EtapaCliente,
): Promise<void> {
  const situacao = liberacaoEtapas(await fatosDoOnboarding(prisma, onboardingId)).find(
    (s) => s.etapa === etapa,
  );
  if (situacao?.liberada) return;
  throw new RegraVioladaError(
    'RN-79',
    `Conclua as etapas anteriores antes de ${etapa === 'acessos' ? 'informar' : 'agendar'} ${NOME[etapa]}`,
  );
}
