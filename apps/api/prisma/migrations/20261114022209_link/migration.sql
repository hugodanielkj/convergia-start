-- CreateTable
CREATE TABLE "links_onboarding" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regeneradoEm" TIMESTAMP(3),

    CONSTRAINT "links_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "links_onboarding_onboardingId_key" ON "links_onboarding"("onboardingId");

-- CreateIndex
CREATE UNIQUE INDEX "links_onboarding_tokenHash_key" ON "links_onboarding"("tokenHash");

-- CreateIndex
CREATE INDEX "links_onboarding_agenciaId_idx" ON "links_onboarding"("agenciaId");

-- AddForeignKey
ALTER TABLE "links_onboarding" ADD CONSTRAINT "links_onboarding_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_onboarding" ADD CONSTRAINT "links_onboarding_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
