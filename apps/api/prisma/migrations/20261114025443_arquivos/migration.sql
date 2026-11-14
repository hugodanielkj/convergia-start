-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arquivos_agenciaId_clienteId_idx" ON "arquivos"("agenciaId", "clienteId");

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
