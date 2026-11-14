-- CreateTable
CREATE TABLE "escolhas_acessos" (
    "onboardingId" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "plataformas" TEXT[],
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escolhas_acessos_pkey" PRIMARY KEY ("onboardingId")
);

-- CreateIndex
CREATE INDEX "escolhas_acessos_agenciaId_idx" ON "escolhas_acessos"("agenciaId");

-- AddForeignKey
ALTER TABLE "escolhas_acessos" ADD CONSTRAINT "escolhas_acessos_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
