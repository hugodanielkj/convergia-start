import { dataLocal, type Bloqueio } from '@convergia/core/agenda';
import { indicadorPrazo, type IndicadorPrazo } from '@convergia/core/prazo';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { textoDaData } from './recalcular.js';

/** Status em que não há mais prazo a acompanhar: conteúdo entregue ou onboarding encerrado. */
const SEM_ACOMPANHAMENTO = new Set(['primeiro_conteudo_entregue', 'concluido', 'cancelado']);

export interface PrazoComIndicador {
  readonly data: string;
  readonly origem: 'calculado' | 'manual';
  readonly justificativa: string | null;
  /** RN-48; nulo quando já não há o que acompanhar. */
  readonly indicador: IndicadorPrazo | null;
}

/**
 * Prazo e indicador de cada onboarding pedido (RN-48), para o painel (RN-63, RN-64) e o detalhe.
 * Onboarding sem captação agendada não aparece no resultado (RN-45).
 */
export async function prazosDosOnboardings(
  prisma: PrismaDaAgencia,
  agenciaId: string,
  onboardings: readonly { readonly id: string; readonly statusGeral: string }[],
  agora: Date,
): Promise<Map<string, PrazoComIndicador>> {
  if (onboardings.length === 0) return new Map();
  const [agencia, registros, bloqueiosDb] = await Promise.all([
    prisma.agencia.findUniqueOrThrow({ where: { id: agenciaId }, select: { fusoHorario: true } }),
    prisma.prazoLiberacao.findMany({
      where: { onboardingId: { in: onboardings.map((o) => o.id) } },
    }),
    prisma.bloqueio.findMany(),
  ]);
  const bloqueios: Bloqueio[] = bloqueiosDb.map((b) => ({
    dataInicio: textoDaData(b.dataInicio),
    dataFim: textoDaData(b.dataFim),
    motivo: b.motivo,
  }));
  const hoje = dataLocal(agora, agencia.fusoHorario);
  const status = new Map(onboardings.map((o) => [o.id, o.statusGeral]));

  return new Map(
    registros.map((r) => {
      const data = textoDaData(r.data);
      const encerrado = SEM_ACOMPANHAMENTO.has(status.get(r.onboardingId) ?? '');
      return [
        r.onboardingId,
        {
          data,
          origem: r.origem,
          justificativa: r.justificativa,
          indicador: indicadorPrazo({ prazo: data, hoje, bloqueios, entregue: encerrado }),
        },
      ];
    }),
  );
}
