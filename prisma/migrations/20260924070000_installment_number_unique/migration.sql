-- One row per installment number per vehicle, so a double-submitted
-- "generate" cannot create the schedule twice. Fails if duplicates already
-- exist; clean those up first.
CREATE UNIQUE INDEX "InstallmentsVehicle_VehicleId_InstallmentNumber_key" ON "InstallmentsVehicle"("VehicleId", "InstallmentNumber");
