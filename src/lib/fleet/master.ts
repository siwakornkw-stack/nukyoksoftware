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
