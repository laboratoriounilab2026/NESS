-- Numeração da NF-e (aditiva). Rollback: DROP TABLE "NfeNumber"; ALTER TABLE "Establishment" DROP COLUMN "nfeSeries", DROP COLUMN "nfeNextNumber";
-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "nfeNextNumber" INTEGER,
ADD COLUMN     "nfeSeries" INTEGER;

-- CreateTable
CREATE TABLE "NfeNumber" (
    "establishmentId" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeNumber_pkey" PRIMARY KEY ("establishmentId","series","number")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfeNumber_documentId_key" ON "NfeNumber"("documentId");

-- AddForeignKey
ALTER TABLE "NfeNumber" ADD CONSTRAINT "NfeNumber_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeNumber" ADD CONSTRAINT "NfeNumber_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EmissionDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Limites do layout NF-e 4.00 (série 0–999, número 1–999999999).
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_nfeSeries_check" CHECK ("nfeSeries" BETWEEN 0 AND 999),
ADD CONSTRAINT "Establishment_nfeNextNumber_check" CHECK ("nfeNextNumber" BETWEEN 1 AND 999999999);
ALTER TABLE "NfeNumber" ADD CONSTRAINT "NfeNumber_series_check" CHECK ("series" BETWEEN 0 AND 999),
ADD CONSTRAINT "NfeNumber_number_check" CHECK ("number" BETWEEN 1 AND 999999999);
