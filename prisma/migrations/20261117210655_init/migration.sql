-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('NFSE', 'NFE');

-- CreateEnum
CREATE TYPE "DocState" AS ENUM ('PENDENTE', 'ENVIADO', 'INCERTO', 'AUTORIZADO', 'REJEITADO', 'DENEGADO', 'CANCELAMENTO_SOLICITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrderState" AS ENUM ('RASCUNHO', 'VALIDANDO', 'PRONTO_REVISAO', 'BLOQUEADO', 'EMITINDO', 'COMPLETO', 'PARCIAL', 'FALHA', 'CANCELAMENTO_SOLICITADO');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateTable
CREATE TABLE "Establishment" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "municipioIbge" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "environment" "Environment" NOT NULL DEFAULT 'HOMOLOGACAO',
    "certSecretRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "document" TEXT,
    "name" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmissionOrder" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "state" "OrderState" NOT NULL DEFAULT 'RASCUNHO',
    "establishmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recipientId" TEXT,
    "serviceCents" INTEGER NOT NULL,
    "goodsCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmissionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmissionDocument" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "DocType" NOT NULL,
    "state" "DocState" NOT NULL DEFAULT 'PENDENTE',
    "accessKey" TEXT,
    "protocol" TEXT,
    "fiscalRuleId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmissionAttempt" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "resultState" "DocState",
    "responseSummary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalRule" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "ufDestino" CHAR(2),
    "municipioIbge" TEXT,
    "purpose" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "params" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "justification" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "FiscalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_cnpj_key" ON "Establishment"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionOrder_ref_key" ON "EmissionOrder"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionDocument_accessKey_key" ON "EmissionDocument"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionDocument_orderId_type_key" ON "EmissionDocument"("orderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionAttempt_idempotencyKey_key" ON "EmissionAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionAttempt_documentId_seq_key" ON "EmissionAttempt"("documentId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalRule_establishmentId_docType_purpose_ufDestino_munici_key" ON "FiscalRule"("establishmentId", "docType", "purpose", "ufDestino", "municipioIbge", "version");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "EmissionOrder" ADD CONSTRAINT "EmissionOrder_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionOrder" ADD CONSTRAINT "EmissionOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionOrder" ADD CONSTRAINT "EmissionOrder_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionDocument" ADD CONSTRAINT "EmissionDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EmissionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionDocument" ADD CONSTRAINT "EmissionDocument_fiscalRuleId_fkey" FOREIGN KEY ("fiscalRuleId") REFERENCES "FiscalRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionAttempt" ADD CONSTRAINT "EmissionAttempt_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EmissionDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRule" ADD CONSTRAINT "FiscalRule_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
