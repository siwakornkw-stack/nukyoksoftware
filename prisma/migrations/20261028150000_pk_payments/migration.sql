-- CreateTable
CREATE TABLE "PkPayment" (
    "PkPaymentId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "PurchaseOrderId" VARCHAR(36) NOT NULL,
    "Status" VARCHAR(10) NOT NULL,
    "R3DocNo" VARCHAR(20) NOT NULL,
    "PayDate" DATE NOT NULL,
    "Amount" DECIMAL(12,2) NOT NULL,
    "PayType" VARCHAR(2) NOT NULL,
    "BankRef" VARCHAR(40),
    "SlipUrl" TEXT NOT NULL,
    "PzNo" VARCHAR(12),
    "Error" TEXT,
    "RequestedBy" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PkPayment_pkey" PRIMARY KEY ("PkPaymentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PkPayment_PurchaseOrderId_key" ON "PkPayment"("PurchaseOrderId");

-- CreateIndex
CREATE INDEX "PkPayment_TenantId_Status_idx" ON "PkPayment"("TenantId", "Status");

-- AddForeignKey
ALTER TABLE "PkPayment" ADD CONSTRAINT "PkPayment_PurchaseOrderId_fkey" FOREIGN KEY ("PurchaseOrderId") REFERENCES "PurchaseOrder"("PurchaseOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;
