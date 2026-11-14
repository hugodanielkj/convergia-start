-- CreateTable
CREATE TABLE "respostas_formulario" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "enviadaEm" TIMESTAMP(3),
    "fechadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "respostas_formulario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "respostas_formulario_onboardingId_key" ON "respostas_formulario"("onboardingId");

-- CreateIndex
CREATE INDEX "respostas_formulario_agenciaId_idx" ON "respostas_formulario"("agenciaId");

-- AddForeignKey
ALTER TABLE "respostas_formulario" ADD CONSTRAINT "respostas_formulario_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_formulario" ADD CONSTRAINT "respostas_formulario_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "versoes_formulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
