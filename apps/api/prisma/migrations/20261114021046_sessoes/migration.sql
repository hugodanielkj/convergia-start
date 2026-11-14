-- CreateTable
CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessoes_usuarioId_idx" ON "sessoes"("usuarioId");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
