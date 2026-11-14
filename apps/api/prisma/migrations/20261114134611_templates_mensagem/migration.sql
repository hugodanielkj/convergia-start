-- CreateTable
CREATE TABLE "templates_mensagem" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "templates_mensagem_agenciaId_tipo_key" ON "templates_mensagem"("agenciaId", "tipo");

-- AddForeignKey
ALTER TABLE "templates_mensagem" ADD CONSTRAINT "templates_mensagem_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
