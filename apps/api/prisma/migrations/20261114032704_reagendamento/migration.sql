-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "reagendamentos" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_reagendamentos_nao_negativo" CHECK ("reagendamentos" >= 0);
