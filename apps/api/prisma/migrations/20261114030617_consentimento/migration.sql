-- CreateTable
CREATE TABLE "consentimentos_cliente" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "versaoTermo" TEXT NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consentimentos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "primeiros_acessos" (
    "onboardingId" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "primeiros_acessos_pkey" PRIMARY KEY ("onboardingId")
);

-- CreateIndex
CREATE INDEX "consentimentos_cliente_agenciaId_idx" ON "consentimentos_cliente"("agenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "consentimentos_cliente_onboardingId_versaoTermo_key" ON "consentimentos_cliente"("onboardingId", "versaoTermo");

-- CreateIndex
CREATE INDEX "primeiros_acessos_agenciaId_idx" ON "primeiros_acessos"("agenciaId");

-- AddForeignKey
ALTER TABLE "consentimentos_cliente" ADD CONSTRAINT "consentimentos_cliente_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "primeiros_acessos" ADD CONSTRAINT "primeiros_acessos_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
