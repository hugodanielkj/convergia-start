-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "nomeEmpresa" TEXT NOT NULL,
    "nomeContato" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_agenciaId_whatsapp_idx" ON "clientes"("agenciaId", "whatsapp");

-- CreateIndex
CREATE INDEX "clientes_agenciaId_email_idx" ON "clientes"("agenciaId", "email");

-- CreateIndex
CREATE INDEX "clientes_agenciaId_criadoEm_idx" ON "clientes"("agenciaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
