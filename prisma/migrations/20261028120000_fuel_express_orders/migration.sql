-- AlterTable
ALTER TABLE "GasolineCost" ADD COLUMN     "OdometerUrl" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "ExpressDepCode" VARCHAR(4),
ADD COLUMN     "ExpressItemCode" VARCHAR(20);

-- CreateTable
CREATE TABLE "ExpressFuelOrder" (
    "ExpressFuelOrderId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "GasolineCostId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(10) NOT NULL,
    "WithH3" BOOLEAN NOT NULL,
    "SupplierCode" VARCHAR(10) NOT NULL,
    "ItemCode" VARCHAR(20) NOT NULL,
    "DepCode" VARCHAR(4) NOT NULL,
    "Date" DATE NOT NULL,
    "Invoice" VARCHAR(15) NOT NULL,
    "Liters" DECIMAL(10,2) NOT NULL,
    "Price" DECIMAL(10,4) NOT NULL,
    "Amount" DECIMAL(12,2) NOT NULL,
    "PkNo" VARCHAR(12),
    "H3No" VARCHAR(12),
    "Error" TEXT,
    "RequestedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpressFuelOrder_pkey" PRIMARY KEY ("ExpressFuelOrderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpressFuelOrder_GasolineCostId_key" ON "ExpressFuelOrder"("GasolineCostId");

-- CreateIndex
CREATE INDEX "ExpressFuelOrder_TenantId_Status_idx" ON "ExpressFuelOrder"("TenantId", "Status");

-- AddForeignKey
ALTER TABLE "ExpressFuelOrder" ADD CONSTRAINT "ExpressFuelOrder_GasolineCostId_fkey" FOREIGN KEY ("GasolineCostId") REFERENCES "GasolineCost"("GasolineCostId") ON DELETE RESTRICT ON UPDATE CASCADE;
