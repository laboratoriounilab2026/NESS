-- Data/local do serviço e forma de pagamento (aditiva). Rollback: ALTER TABLE "EmissionOrder" DROP COLUMN "serviceDate", DROP COLUMN "serviceCity", DROP COLUMN "serviceCityIbge", DROP COLUMN "paymentMethod";
-- AlterTable
ALTER TABLE "EmissionOrder" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "serviceCity" TEXT,
ADD COLUMN     "serviceCityIbge" TEXT,
ADD COLUMN     "serviceDate" DATE;

