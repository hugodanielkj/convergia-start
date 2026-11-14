-- CreateEnum
CREATE TYPE "TipoAtendimento" AS ENUM ('reuniao', 'captacao');

-- CreateTable
CREATE TABLE "disponibilidades" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipo" "TipoAtendimento" NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "duracaoMinutos" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disponibilidades_agenciaId_tipo_diaSemana_idx" ON "disponibilidades"("agenciaId", "tipo", "diaSemana");

-- CreateIndex
CREATE INDEX "bloqueios_agenciaId_dataInicio_dataFim_idx" ON "bloqueios"("agenciaId", "dataInicio", "dataFim");

-- AddForeignKey
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios" ADD CONSTRAINT "bloqueios_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Travas no banco, além da validação em código: dados fora do formato não entram nem por SQL direto.
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_dia_semana_valido" CHECK ("diaSemana" BETWEEN 0 AND 6);
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_hora_formato" CHECK ("horaInicio" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "horaFim" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_intervalo_valido" CHECK ("horaInicio" < "horaFim");
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_duracao_positiva" CHECK ("duracaoMinutos" IS NULL OR "duracaoMinutos" > 0);
ALTER TABLE "bloqueios" ADD CONSTRAINT "bloqueios_intervalo_valido" CHECK ("dataFim" >= "dataInicio");
