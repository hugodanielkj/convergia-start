-- CreateEnum
CREATE TYPE "SituacaoCalendario" AS ENUM ('pendente', 'sincronizado', 'falhou');

-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "calendarioErro" TEXT,
ADD COLUMN     "calendarioProximaTentativaEm" TIMESTAMPTZ(3),
ADD COLUMN     "calendarioSituacao" "SituacaoCalendario" NOT NULL DEFAULT 'pendente',
ADD COLUMN     "calendarioTentativas" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "agendamentos_calendarioSituacao_calendarioProximaTentativaE_idx" ON "agendamentos"("calendarioSituacao", "calendarioProximaTentativaEm");

ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tentativas_nao_negativas" CHECK ("calendarioTentativas" >= 0);
