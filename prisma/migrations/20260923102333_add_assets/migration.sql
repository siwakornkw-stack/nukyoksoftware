-- CreateTable
CREATE TABLE "Asset" (
    "AssetId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Name" TEXT NOT NULL,
    "Category" TEXT NOT NULL,
    "Code" TEXT,
    "DefaultLocation" TEXT,
    "Note" TEXT,
    "Inactive" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("AssetId")
);

-- CreateTable
CREATE TABLE "AssetLoan" (
    "AssetLoanId" VARCHAR(36) NOT NULL,
    "AssetId" VARCHAR(36) NOT NULL,
    "BorrowerName" TEXT NOT NULL,
    "Location" TEXT NOT NULL,
    "BorrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ReturnedAt" TIMESTAMP(3),
    "Note" TEXT,
    "CreatedByUsername" TEXT,
    "UpdatedByUsername" TEXT,

    CONSTRAINT "AssetLoan_pkey" PRIMARY KEY ("AssetLoanId")
);

-- CreateIndex
CREATE INDEX "Asset_TenantId_idx" ON "Asset"("TenantId");

-- CreateIndex
CREATE INDEX "AssetLoan_AssetId_idx" ON "AssetLoan"("AssetId");

-- CreateIndex
CREATE INDEX "AssetLoan_AssetId_ReturnedAt_idx" ON "AssetLoan"("AssetId", "ReturnedAt");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_TenantId_fkey" FOREIGN KEY ("TenantId") REFERENCES "Tenant"("TenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLoan" ADD CONSTRAINT "AssetLoan_AssetId_fkey" FOREIGN KEY ("AssetId") REFERENCES "Asset"("AssetId") ON DELETE RESTRICT ON UPDATE CASCADE;
