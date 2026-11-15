-- CreateEnum
CREATE TYPE "EmailAlerta" AS ENUM ('pendente', 'enviado', 'falhou', 'dispensado');

-- CreateTable
CREATE TABLE "alertas_internos" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMPTZ(3),
    "resolvidoPor" TEXT,
    "email" "EmailAlerta" NOT NULL DEFAULT 'pendente',
    "emailTentativas" INTEGER NOT NULL DEFAULT 0,
    "emailProximaEm" TIMESTAMPTZ(3),
    "emailReservadoAte" TIMESTAMPTZ(3),
    "emailErro" TEXT,

    CONSTRAINT "alertas_internos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alertas_internos_agenciaId_resolvidoEm_idx" ON "alertas_internos"("agenciaId", "resolvidoEm");

-- CreateIndex
CREATE INDEX "alertas_internos_email_emailProximaEm_idx" ON "alertas_internos"("email", "emailProximaEm");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_internos_agenciaId_chave_key" ON "alertas_internos"("agenciaId", "chave");

-- AddForeignKey
ALTER TABLE "alertas_internos" ADD CONSTRAINT "alertas_internos_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_internos" ADD CONSTRAINT "alertas_internos_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
