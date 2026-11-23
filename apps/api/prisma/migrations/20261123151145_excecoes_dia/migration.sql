-- CreateTable
CREATE TABLE "disponibilidades_dia" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "tipo" "TipoAtendimento" NOT NULL,
    "data" DATE NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "duracaoMinutos" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidades_dia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disponibilidades_dia_agenciaId_tipo_data_idx" ON "disponibilidades_dia"("agenciaId", "tipo", "data");

-- AddForeignKey
ALTER TABLE "disponibilidades_dia" ADD CONSTRAINT "disponibilidades_dia_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
