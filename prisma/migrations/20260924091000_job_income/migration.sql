-- AlterTable
ALTER TABLE "DriverJob" ADD COLUMN "Price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "IncomeVehicle" ADD COLUMN "DriverJobId" VARCHAR(36);

-- CreateIndex
CREATE UNIQUE INDEX "IncomeVehicle_DriverJobId_key" ON "IncomeVehicle"("DriverJobId");
