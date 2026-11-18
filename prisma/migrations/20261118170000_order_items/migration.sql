-- Itens do pedido (aditiva; nulos em pedidos antigos). Rollback: ALTER TABLE "EmissionOrder" DROP COLUMN "serviceDescription", DROP COLUMN "goodsDescription", DROP COLUMN "goodsQuantity", DROP COLUMN "goodsUnitCents";
-- AlterTable
ALTER TABLE "EmissionOrder" ADD COLUMN     "goodsDescription" TEXT,
ADD COLUMN     "goodsQuantity" INTEGER,
ADD COLUMN     "goodsUnitCents" INTEGER,
ADD COLUMN     "serviceDescription" TEXT;

