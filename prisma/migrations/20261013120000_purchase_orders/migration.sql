-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "PurchaseOrderId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "PoNo" VARCHAR(20) NOT NULL,
    "PoDate" DATE,
    "SupplierCode" TEXT NOT NULL,
    "SupplierName" TEXT NOT NULL,
    "DepCode" TEXT NOT NULL,
    "DepName" TEXT NOT NULL,
    "NetAmt" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "DocStat" VARCHAR(1) NOT NULL,
    "Data" JSONB NOT NULL,
    "ContentHash" VARCHAR(40) NOT NULL,
    "MissingInExpress" BOOLEAN NOT NULL DEFAULT false,
    "SyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ApprovalStatus" VARCHAR(10),
    "ApprovalNote" TEXT,
    "ApprovedBy" TEXT,
    "ApprovedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("PurchaseOrderId")
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_TenantId_PoDate_idx" ON "PurchaseOrder"("TenantId", "PoDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_TenantId_ApprovalStatus_idx" ON "PurchaseOrder"("TenantId", "ApprovalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_TenantId_PoNo_key" ON "PurchaseOrder"("TenantId", "PoNo");
