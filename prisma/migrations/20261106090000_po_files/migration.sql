-- CreateTable
CREATE TABLE "PurchaseOrderFile" (
    "PurchaseOrderFileId" VARCHAR(36) NOT NULL,
    "PurchaseOrderId" VARCHAR(36) NOT NULL,
    "FileName" TEXT NOT NULL,
    "Url" TEXT NOT NULL,
    "CreatedByUsername" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderFile_pkey" PRIMARY KEY ("PurchaseOrderFileId")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderFile_PurchaseOrderId_idx" ON "PurchaseOrderFile"("PurchaseOrderId");

-- AddForeignKey
ALTER TABLE "PurchaseOrderFile" ADD CONSTRAINT "PurchaseOrderFile_PurchaseOrderId_fkey" FOREIGN KEY ("PurchaseOrderId") REFERENCES "PurchaseOrder"("PurchaseOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

