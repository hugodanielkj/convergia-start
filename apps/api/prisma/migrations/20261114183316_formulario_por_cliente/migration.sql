-- AlterTable
ALTER TABLE "respostas_formulario" ADD COLUMN     "versaoClienteId" TEXT;

-- CreateTable
CREATE TABLE "versoes_formulario_cliente" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "campos" JSONB NOT NULL,
    "baseId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPor" TEXT,

    CONSTRAINT "versoes_formulario_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "versoes_formulario_cliente_agenciaId_idx" ON "versoes_formulario_cliente"("agenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "versoes_formulario_cliente_onboardingId_numero_key" ON "versoes_formulario_cliente"("onboardingId", "numero");

-- AddForeignKey
ALTER TABLE "respostas_formulario" ADD CONSTRAINT "respostas_formulario_versaoClienteId_fkey" FOREIGN KEY ("versaoClienteId") REFERENCES "versoes_formulario_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versoes_formulario_cliente" ADD CONSTRAINT "versoes_formulario_cliente_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versoes_formulario_cliente" ADD CONSTRAINT "versoes_formulario_cliente_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "versoes_formulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
