-- Dados cadastrais do estabelecimento (aditiva). Rollback: ALTER TABLE "Establishment" DROP COLUMN de cada coluna abaixo.
-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN     "cep" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "municipalRegistration" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "stateRegistration" TEXT,
ADD COLUMN     "street" TEXT;

