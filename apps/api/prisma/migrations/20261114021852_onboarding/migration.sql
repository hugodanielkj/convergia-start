-- CreateEnum
CREATE TYPE "StatusOnboarding" AS ENUM ('criado', 'convite_enviado', 'em_andamento', 'aguardando_agendamentos', 'aguardando_reuniao', 'aguardando_captacao', 'em_producao', 'primeiro_conteudo_entregue', 'concluido', 'pausado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoEtapa" AS ENUM ('formulario', 'acessos', 'reuniao', 'captacao');

-- CreateEnum
CREATE TYPE "StatusEtapa" AS ENUM ('pendente', 'em_andamento', 'concluida', 'bloqueada');

-- CreateTable
CREATE TABLE "onboardings" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "statusGeral" "StatusOnboarding" NOT NULL DEFAULT 'criado',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_onboarding" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "tipo" "TipoEtapa" NOT NULL,
    "status" "StatusEtapa" NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboardings_agenciaId_clienteId_idx" ON "onboardings"("agenciaId", "clienteId");

-- CreateIndex
CREATE INDEX "onboardings_agenciaId_responsavelId_idx" ON "onboardings"("agenciaId", "responsavelId");

-- CreateIndex
CREATE INDEX "etapas_onboarding_agenciaId_onboardingId_idx" ON "etapas_onboarding"("agenciaId", "onboardingId");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_onboarding_onboardingId_tipo_key" ON "etapas_onboarding"("onboardingId", "tipo");

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_onboarding" ADD CONSTRAINT "etapas_onboarding_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_onboarding" ADD CONSTRAINT "etapas_onboarding_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RN-07: um cliente só pode ter um onboarding ativo. Concluído e cancelado liberam um novo.
-- Índice parcial escrito à mão: o Prisma não declara este tipo de índice.
CREATE UNIQUE INDEX "onboardings_um_ativo_por_cliente" ON "onboardings"("clienteId")
WHERE "statusGeral" NOT IN ('concluido', 'cancelado');
