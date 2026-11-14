-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('pendente', 'enviada', 'falhou', 'cancelada');

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "assunto" TEXT,
    "corpo" TEXT NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'pendente',
    "canal" "Canal",
    "canalIndice" INTEGER NOT NULL DEFAULT 0,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "totalTentativas" INTEGER NOT NULL DEFAULT 0,
    "semCredencial" "Canal"[] DEFAULT ARRAY[]::"Canal"[],
    "houveFalha" BOOLEAN NOT NULL DEFAULT false,
    "proximaTentativaEm" TIMESTAMPTZ(3),
    "reservadaAte" TIMESTAMPTZ(3),
    "idExterno" TEXT,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencias_envio" (
    "onboardingId" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "tokenOptOut" TEXT NOT NULL,
    "lembretesDesativadosEm" TIMESTAMP(3),

    CONSTRAINT "preferencias_envio_pkey" PRIMARY KEY ("onboardingId")
);

-- CreateIndex
CREATE INDEX "notificacoes_status_proximaTentativaEm_idx" ON "notificacoes"("status", "proximaTentativaEm");

-- CreateIndex
CREATE INDEX "notificacoes_agenciaId_onboardingId_criadoEm_idx" ON "notificacoes"("agenciaId", "onboardingId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_agenciaId_chave_key" ON "notificacoes"("agenciaId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_envio_tokenOptOut_key" ON "preferencias_envio"("tokenOptOut");

-- CreateIndex
CREATE INDEX "preferencias_envio_agenciaId_idx" ON "preferencias_envio"("agenciaId");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_envio" ADD CONSTRAINT "preferencias_envio_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_envio" ADD CONSTRAINT "preferencias_envio_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
