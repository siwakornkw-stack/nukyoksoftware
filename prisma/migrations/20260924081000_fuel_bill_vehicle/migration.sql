-- AlterTable
ALTER TABLE "FuelBill" ADD COLUMN "VehicleId" VARCHAR(36);

-- CreateIndex
CREATE INDEX "FuelBill_VehicleId_idx" ON "FuelBill"("VehicleId");

-- AddForeignKey
ALTER TABLE "FuelBill" ADD CONSTRAINT "FuelBill_VehicleId_fkey" FOREIGN KEY ("VehicleId") REFERENCES "Vehicle"("VehicleId") ON DELETE SET NULL ON UPDATE CASCADE;
