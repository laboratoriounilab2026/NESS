-- Estado DESCARTADO (aditivo). Rollback: Postgres não remove valor de enum; se preciso, recriar o tipo sem o valor após mover pedidos DESCARTADO.
-- AlterEnum
ALTER TYPE "OrderState" ADD VALUE 'DESCARTADO';

