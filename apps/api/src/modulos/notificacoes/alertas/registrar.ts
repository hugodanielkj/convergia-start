import { alertaPedeEmail, type TipoAlerta } from '@convergia/core/alertas';
import type { PrismaClient } from '../../../base/prisma.js';

export interface NovoAlerta {
  readonly agenciaId: string;
  readonly onboardingId: string;
  readonly tipo: TipoAlerta;
  /** Idempotência: o mesmo fato nunca gera dois avisos. */
  readonly chave: string;
  readonly detalhe?: string;
  /** Quem da agência fez a ação que gerou o aviso, quando há. */
  readonly usuarioId?: string | null;
}

/** Registra um aviso interno (RN-58) e deixa o e-mail na fila do worker. `false` = já existia. */
export async function registrarAlerta(
  prisma: PrismaClient,
  novo: NovoAlerta,
  agora: Date,
): Promise<boolean> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: novo.onboardingId, agenciaId: novo.agenciaId },
    select: { responsavelId: true },
  });
  if (!onboarding) return false;
  const pedeEmail = alertaPedeEmail(novo.tipo, onboarding.responsavelId, novo.usuarioId ?? null);
  const { count } = await prisma.alertaInterno.createMany({
    data: [
      {
        agenciaId: novo.agenciaId,
        onboardingId: novo.onboardingId,
        tipo: novo.tipo,
        chave: novo.chave,
        detalhe: novo.detalhe ?? null,
        criadoEm: agora,
        email: pedeEmail ? 'pendente' : 'dispensado',
        emailProximaEm: pedeEmail ? agora : null,
      },
    ],
    skipDuplicates: true,
  });
  return count === 1;
}
