-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('admin', 'membro');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('whatsapp', 'email');

-- CreateTable
CREATE TABLE "agencias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "logoUrl" TEXT,
    "corPrimaria" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'membro',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_agencia" (
    "agenciaId" TEXT NOT NULL,
    "prazoProducaoDiasUteis" INTEGER NOT NULL,
    "validadeLinkDias" INTEGER NOT NULL,
    "antecedenciaMinimaHoras" INTEGER NOT NULL,
    "intervaloReuniaoCaptacaoDiasMin" INTEGER NOT NULL,
    "limiteReagendamentos" INTEGER NOT NULL,
    "antecedenciaReagendamentoHoras" INTEGER NOT NULL,
    "duracaoReuniaoMinutos" INTEGER NOT NULL,
    "duracaoCaptacaoMinutos" INTEGER NOT NULL,
    "lembretesPendenciaDias" INTEGER[],
    "maxLembretesPendencia" INTEGER NOT NULL,
    "lembretesCompromissoHoras" INTEGER[],
    "janelaEnvioInicio" TEXT NOT NULL,
    "janelaEnvioFim" TEXT NOT NULL,
    "diasEnvioPermitidos" INTEGER[],
    "canalNotificacaoPadrao" "Canal" NOT NULL,
    "intervaloMinimoReenvioHoras" INTEGER NOT NULL,
    "diasSemAcaoParaAlerta" INTEGER NOT NULL,
    "diasConclusaoAutomatica" INTEGER NOT NULL,
    "plataformasObrigatorias" TEXT[],
    "uploadTamanhoMaxMb" INTEGER NOT NULL,
    "uploadTiposPermitidos" TEXT[],
    "permitirCredenciais" BOOLEAN NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_agencia_pkey" PRIMARY KEY ("agenciaId")
);

-- CreateTable
CREATE TABLE "auditoria_log" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "dados" JSONB,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_agenciaId_email_key" ON "usuarios"("agenciaId", "email");

-- CreateIndex
CREATE INDEX "auditoria_log_agenciaId_entidade_entidadeId_idx" ON "auditoria_log"("agenciaId", "entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_agencia" ADD CONSTRAINT "config_agencia_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_log" ADD CONSTRAINT "auditoria_log_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "agencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
