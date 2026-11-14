-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('agendado', 'reagendado', 'cancelado', 'realizado', 'nao_compareceu');

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "tipo" "TipoAtendimento" NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'agendado',
    "responsavelId" TEXT,
    "localOuLink" TEXT,
    "eventoExternoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agendamentos_agenciaId_inicio_idx" ON "agendamentos"("agenciaId", "inicio");

-- CreateIndex
CREATE INDEX "agendamentos_onboardingId_tipo_idx" ON "agendamentos"("onboardingId", "tipo");

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RN-33 (D-11): overbooking impedido no banco, não só no código. Dois agendamentos ativos da mesma
-- agência não podem ter horários que se cruzam; quem chega depois recebe erro de exclusão (23P01).
-- A agência tem um único profissional com agenda (D-02), então a exclusão é por agência. Com mais
-- profissionais, o critério passa a incluir o responsável. `[)`: quem termina às 10h libera as 10h.
-- btree_gist permite combinar igualdade de texto com sobreposição de intervalo no mesmo índice.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_sem_sobreposicao"
  EXCLUDE USING gist ("agenciaId" WITH =, tstzrange("inicio", "fim", '[)') WITH &&)
  WHERE ("status" IN ('agendado', 'reagendado'));

ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_intervalo_valido" CHECK ("fim" > "inicio");

-- Um onboarding tem no máximo um agendamento ativo de cada tipo; remarcar muda o registro existente.
CREATE UNIQUE INDEX "agendamentos_um_ativo_por_tipo" ON "agendamentos"("onboardingId", "tipo")
  WHERE "status" IN ('agendado', 'reagendado');
