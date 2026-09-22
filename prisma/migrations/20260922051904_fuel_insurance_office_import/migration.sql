/*
  Warnings:

  - You are about to alter the column `Liters` on the `GasolineCost` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "CompulsoryMotorInsuranceVehicle" ADD COLUMN     "Note" TEXT;

-- AlterTable
ALTER TABLE "GasolineCost" ADD COLUMN     "Distance" DECIMAL(12,2),
ADD COLUMN     "ReceiverName" TEXT,
ALTER COLUMN "Liters" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "OdometerStart" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "OdometerEnd" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "InsurancePolicyVehicle" ADD COLUMN     "Note" TEXT;

-- AlterTable
ALTER TABLE "Tax" ADD COLUMN     "Note" TEXT;
