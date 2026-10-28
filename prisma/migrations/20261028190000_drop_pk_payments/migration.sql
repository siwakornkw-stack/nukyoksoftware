-- The PZ slip payments were dropped on 2026-10-28 (never used for real: no rows).
-- DropForeignKey
ALTER TABLE "PkPayment" DROP CONSTRAINT "PkPayment_PurchaseOrderId_fkey";

-- DropTable
DROP TABLE "PkPayment";
