-- CreateTable
CREATE TABLE "dados_captacao" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "presencial" BOOLEAN NOT NULL DEFAULT true,
    "local" TEXT,
    "contatoLocal" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dados_captacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dados_captacao_agendamentoId_key" ON "dados_captacao"("agendamentoId");

-- CreateIndex
CREATE INDEX "dados_captacao_agenciaId_idx" ON "dados_captacao"("agenciaId");

-- AddForeignKey
ALTER TABLE "dados_captacao" ADD CONSTRAINT "dados_captacao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
