-- CreateEnum
CREATE TYPE "StatusAcesso" AS ENUM ('pendente', 'concedido', 'invalido');

-- CreateTable
CREATE TABLE "acessos_plataforma" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "status" "StatusAcesso" NOT NULL DEFAULT 'pendente',
    "motivo" TEXT,
    "informadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acessos_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_acessos" (
    "agenciaId" TEXT NOT NULL,
    "identificadores" JSONB NOT NULL DEFAULT '{}',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_acessos_pkey" PRIMARY KEY ("agenciaId")
);

-- CreateIndex
CREATE INDEX "acessos_plataforma_agenciaId_idx" ON "acessos_plataforma"("agenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "acessos_plataforma_onboardingId_plataforma_key" ON "acessos_plataforma"("onboardingId", "plataforma");

-- AddForeignKey
ALTER TABLE "acessos_plataforma" ADD CONSTRAINT "acessos_plataforma_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_acessos" ADD CONSTRAINT "config_acessos_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
