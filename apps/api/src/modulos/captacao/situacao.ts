import type { PrismaClient } from '../../base/prisma.js';
import type { LinkLocalizado } from '../link/localizar-link.js';
import { carregarContexto, inicioDaReuniao } from '../agenda/slots-publicos.js';

export type SituacaoCaptacao = 'bloqueada' | 'pendente' | 'agendada' | 'realizada';

export interface VisaoCaptacao {
  readonly situacao: SituacaoCaptacao;
  /** Por que está bloqueada, em palavras para o cliente (RN-39). */
  readonly motivoBloqueio?: string;
  /** Dias mínimos entre a reunião e a captação, para a tela explicar a regra. */
  readonly intervaloDiasMin: number;
  readonly agendamento?: {
    readonly id: string;
    readonly inicio: string;
    readonly fim: string;
    readonly status: string;
    readonly dados: {
      readonly presencial: boolean;
      readonly local: string | null;
      readonly contatoLocal: string | null;
      readonly observacoes: string | null;
    } | null;
  };
}

/** Situação da etapa "captação" do cliente dono do link (RN-39, RN-40). */
export async function situacaoDaCaptacao(
  prismaBruto: PrismaClient,
  link: LinkLocalizado,
): Promise<VisaoCaptacao> {
  const { prisma, intervaloReuniaoCaptacaoDiasMin: intervaloDiasMin } = await carregarContexto(
    prismaBruto,
    link.agenciaId,
  );
  const captacoes = await prisma.agendamento.findMany({
    where: { onboardingId: link.onboardingId, tipo: 'captacao' },
    orderBy: { inicio: 'desc' },
    include: { dadosCaptacao: true },
  });
  const ativa = captacoes.find((a) => a.status === 'agendado' || a.status === 'reagendado');
  const realizada = captacoes.find((a) => a.status === 'realizado');
  const marcada = ativa ?? realizada;
  if (marcada) {
    const d = marcada.dadosCaptacao;
    return {
      situacao: ativa ? 'agendada' : 'realizada',
      intervaloDiasMin,
      agendamento: {
        id: marcada.id,
        inicio: marcada.inicio.toISOString(),
        fim: marcada.fim.toISOString(),
        status: marcada.status,
        dados: d && {
          presencial: d.presencial,
          local: d.local,
          contatoLocal: d.contatoLocal,
          observacoes: d.observacoes,
        },
      },
    };
  }

  if ((await inicioDaReuniao(prisma, link.onboardingId)) === null) {
    return {
      situacao: 'bloqueada',
      motivoBloqueio:
        'Agende primeiro a reunião de alinhamento. Depois você escolhe a data da captação.',
      intervaloDiasMin,
    };
  }
  return { situacao: 'pendente', intervaloDiasMin };
}
