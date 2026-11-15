-- AlterTable
ALTER TABLE "links_onboarding" ADD COLUMN     "tokenCifrado" TEXT;

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "respeitarJanela" BOOLEAN NOT NULL DEFAULT false;
