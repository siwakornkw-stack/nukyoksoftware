-- AlterTable
ALTER TABLE "CompulsoryMotorInsuranceVehicle" ADD COLUMN     "ImportKey" VARCHAR(200);

-- AlterTable
ALTER TABLE "InsurancePolicyVehicle" ADD COLUMN     "ImportKey" VARCHAR(200);

-- AlterTable
ALTER TABLE "Tax" ADD COLUMN     "ImportKey" VARCHAR(200);

-- Backfill: rows are unedited so far; same format as insKey() in office-import.ts.
UPDATE "InsurancePolicyVehicle" SET "ImportKey" = 'ins|' || "VehicleId" || '|' || to_char("EndDate", 'YYYY-MM-DD');
UPDATE "CompulsoryMotorInsuranceVehicle" SET "ImportKey" = 'cmi|' || "VehicleId" || '|' || to_char("EndDate", 'YYYY-MM-DD');
UPDATE "Tax" SET "ImportKey" = 'tax|' || "VehicleId" || '|' || to_char("EndDate", 'YYYY-MM-DD');

-- CreateIndex
CREATE INDEX "CompulsoryMotorInsuranceVehicle_ImportKey_idx" ON "CompulsoryMotorInsuranceVehicle"("ImportKey");

-- CreateIndex
CREATE INDEX "InsurancePolicyVehicle_ImportKey_idx" ON "InsurancePolicyVehicle"("ImportKey");

-- CreateIndex
CREATE INDEX "Tax_ImportKey_idx" ON "Tax"("ImportKey");
