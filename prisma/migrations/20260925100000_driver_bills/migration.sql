-- AlterTable
ALTER TABLE "DriverJob" ADD COLUMN "CustomerName" TEXT,
ADD COLUMN "BillNo" VARCHAR(20);

-- CreateTable
CREATE TABLE "DriverBill" (
    "BillNo" VARCHAR(20) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "CustomerName" TEXT NOT NULL,
    "Total" DECIMAL(12,2) NOT NULL,
    "CreatedByUsername" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverBill_pkey" PRIMARY KEY ("BillNo")
);

-- CreateIndex
CREATE INDEX "DriverJob_BillNo_idx" ON "DriverJob"("BillNo");

-- CreateIndex
CREATE INDEX "DriverBill_TenantId_CreatedAt_idx" ON "DriverBill"("TenantId", "CreatedAt");

-- AddForeignKey
ALTER TABLE "DriverJob" ADD CONSTRAINT "DriverJob_BillNo_fkey" FOREIGN KEY ("BillNo") REFERENCES "DriverBill"("BillNo") ON DELETE SET NULL ON UPDATE CASCADE;
