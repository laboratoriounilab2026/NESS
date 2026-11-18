-- Código IBGE do município do destinatário (aditiva). Rollback: ALTER TABLE "Recipient" DROP COLUMN "cityIbge";
-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "cityIbge" TEXT;

