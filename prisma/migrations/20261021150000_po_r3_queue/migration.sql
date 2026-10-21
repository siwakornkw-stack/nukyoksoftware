-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "R3Error" TEXT,
ADD COLUMN     "R3Status" VARCHAR(10),
ADD COLUMN     "R3UpdatedAt" TIMESTAMP(3);
