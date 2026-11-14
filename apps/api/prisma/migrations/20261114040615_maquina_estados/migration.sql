-- AlterTable
ALTER TABLE "respostas_formulario" ADD COLUMN     "reabertaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "transicoes_status" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "de" "StatusOnboarding" NOT NULL,
    "para" "StatusOnboarding" NOT NULL,
    "motivo" TEXT,
    "ator" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transicoes_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transicoes_status_agenciaId_onboardingId_em_idx" ON "transicoes_status"("agenciaId", "onboardingId", "em");

-- AddForeignKey
ALTER TABLE "transicoes_status" ADD CONSTRAINT "transicoes_status_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transicoes_status" ADD CONSTRAINT "transicoes_status_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
