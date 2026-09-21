import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

// Master-data option lists for the tenant (used by vehicle forms / filters).
export async function getMasterOptions() {
  const T = DEFAULT_TENANT_ID;
  const [types, brands, owners, departments, drivers, statuses, fuelTypes, paymentStatuses] =
    await Promise.all([
      prisma.vehicleType.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.vehicleBrand.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.vehicleOwner.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.vehicleDepartment.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.vehicleDriver.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.vehicleStatus.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.fuelType.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
      prisma.paymentStatus.findMany({ where: { TenantId: T }, orderBy: { Name: "asc" } }),
    ]);
  return { types, brands, owners, departments, drivers, statuses, fuelTypes, paymentStatuses };
}

// The {id,name} lists VehicleForm renders, shared by the add and edit pages.
export async function getVehicleFormOptions() {
  const m = await getMasterOptions();
  return {
    types: m.types.map((x) => ({ id: x.VehicleTypeId, name: x.Name })),
    brands: m.brands.map((x) => ({ id: x.VehicleBrandId, name: x.Name })),
    owners: m.owners.map((x) => ({ id: x.VehicleOwnerId, name: x.Name })),
    departments: m.departments.map((x) => ({ id: x.VehicleDepartmentId, name: x.Name })),
    drivers: m.drivers.map((x) => ({ id: x.VehicleDriverId, name: x.Name })),
    statuses: m.statuses.map((x) => ({ id: x.VehicleStatusId, name: x.Name })),
    fuelTypes: m.fuelTypes.map((x) => ({ id: x.FuelTypeId, name: x.Name })),
  };
}
