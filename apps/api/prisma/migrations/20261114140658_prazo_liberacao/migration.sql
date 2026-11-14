-- CreateEnum
CREATE TYPE "OrigemPrazo" AS ENUM ('calculado', 'manual');

-- CreateTable
CREATE TABLE "prazos_liberacao" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "origem" "OrigemPrazo" NOT NULL DEFAULT 'calculado',
    "captacaoData" DATE NOT NULL,
    "diasUteis" INTEGER NOT NULL,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prazos_liberacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prazos_liberacao_onboardingId_key" ON "prazos_liberacao"("onboardingId");

-- CreateIndex
CREATE INDEX "prazos_liberacao_agenciaId_data_idx" ON "prazos_liberacao"("agenciaId", "data");

-- AddForeignKey
ALTER TABLE "prazos_liberacao" ADD CONSTRAINT "prazos_liberacao_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
