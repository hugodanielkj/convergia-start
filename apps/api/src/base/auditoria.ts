import type { PrismaClient } from './prisma.js';
import type { PrismaDaAgencia } from './escopo-agencia.js';

export interface RegistroAuditoria {
  agenciaId: string;
  /** "usuario:<id>", "cliente:<onboardingId>" ou "sistema". */
  ator: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  dados?: Record<string, string | number | boolean | null>;
}

/** Grava um evento de auditoria (RN-77). Nunca inclua dados pessoais completos em `dados`. */
export async function registrarAuditoria(
  prisma: PrismaClient | PrismaDaAgencia,
  registro: RegistroAuditoria,
): Promise<void> {
  await (prisma as PrismaClient).auditoriaLog.create({ data: registro });
}
