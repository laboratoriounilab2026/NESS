-- Numeração da DPS (aditiva). Rollback: DROP TABLE "DpsNumber"; ALTER TABLE "Establishment" DROP COLUMN "dpsSeries", DROP COLUMN "dpsNextNumber";
-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "dpsNextNumber" INTEGER,
ADD COLUMN     "dpsSeries" INTEGER;

-- CreateTable
CREATE TABLE "DpsNumber" (
    "establishmentId" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DpsNumber_pkey" PRIMARY KEY ("establishmentId","series","number")
);

-- CreateIndex
CREATE UNIQUE INDEX "DpsNumber_documentId_key" ON "DpsNumber"("documentId");

-- AddForeignKey
ALTER TABLE "DpsNumber" ADD CONSTRAINT "DpsNumber_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DpsNumber" ADD CONSTRAINT "DpsNumber_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EmissionDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Série da DPS: 1–99999 (5 posições). Número: o layout aceita 15 dígitos; aqui limitado ao INTEGER do Postgres
-- (2.147.483.647), suficiente para décadas. Ampliar para BIGINT se um dia for necessário.
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_dpsSeries_check" CHECK ("dpsSeries" BETWEEN 1 AND 99999),
ADD CONSTRAINT "Establishment_dpsNextNumber_check" CHECK ("dpsNextNumber" >= 1);
ALTER TABLE "DpsNumber" ADD CONSTRAINT "DpsNumber_series_check" CHECK ("series" BETWEEN 1 AND 99999),
ADD CONSTRAINT "DpsNumber_number_check" CHECK ("number" >= 1);
