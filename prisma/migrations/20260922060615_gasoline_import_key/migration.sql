-- AlterTable
ALTER TABLE "GasolineCost" ADD COLUMN     "ImportKey" VARCHAR(200);

-- Backfill: existing rows have not been edited yet, so their current values are
-- the values they were imported with. Same format as fuelKey() in office-import.ts.
UPDATE "GasolineCost"
SET "ImportKey" = "VehicleId" || '|' || to_char("DateTime", 'YYYY-MM-DD') || '|' || COALESCE("TaxInvoiceNumber", '') || '|' || to_char("Amount", 'FM99999999990.00');

-- CreateIndex
CREATE INDEX "GasolineCost_ImportKey_idx" ON "GasolineCost"("ImportKey");
