-- CreateTable
CREATE TABLE "modelos_formulario" (
    "agenciaId" TEXT NOT NULL,
    "rascunho" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_formulario_pkey" PRIMARY KEY ("agenciaId")
);

-- CreateTable
CREATE TABLE "versoes_formulario" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "campos" JSONB NOT NULL,
    "publicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadaPor" TEXT,

    CONSTRAINT "versoes_formulario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "versoes_formulario_agenciaId_numero_key" ON "versoes_formulario"("agenciaId", "numero");

-- AddForeignKey
ALTER TABLE "modelos_formulario" ADD CONSTRAINT "modelos_formulario_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versoes_formulario" ADD CONSTRAINT "versoes_formulario_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
