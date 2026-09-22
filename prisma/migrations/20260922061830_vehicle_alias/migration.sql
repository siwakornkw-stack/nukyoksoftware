-- CreateTable
CREATE TABLE "VehicleAlias" (
    "VehicleAliasId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "AliasKey" VARCHAR(200) NOT NULL,
    "Label" TEXT NOT NULL,
    "VehicleId" VARCHAR(36) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUsername" TEXT,

    CONSTRAINT "VehicleAlias_pkey" PRIMARY KEY ("VehicleAliasId")
);

-- CreateIndex
CREATE INDEX "VehicleAlias_VehicleId_idx" ON "VehicleAlias"("VehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleAlias_TenantId_AliasKey_key" ON "VehicleAlias"("TenantId", "AliasKey");

-- AddForeignKey
ALTER TABLE "VehicleAlias" ADD CONSTRAINT "VehicleAlias_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE CASCADE ON UPDATE CASCADE;
