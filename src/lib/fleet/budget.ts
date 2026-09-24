import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "./queries";
import { plateText } from "./plates";
import { bangkokToday } from "./schedule";

export interface BudgetRow {
  vehicleId: string;
  plate: string;
  budget: number | null;
  fuel: number;
  repair: number;
  spent: number;
  pct: number | null; // spent / budget * 100
}

// This Bangkok month's running costs per active vehicle against its monthly
// budget. Counts fuel and the company's share of repairs; premiums are yearly
// lumps and stay out.
export async function budgetStatus(today = bangkokToday()): Promise<{ month: string; rows: BudgetRow[] }> {
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const own = { Vehicle: { TenantId: DEFAULT_TENANT_ID, Status: "active" } };
  const [vehicles, fuel, repair] = await Promise.all([
    prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID, Status: "active" },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true, MonthlyBudget: true },
    }),
    prisma.gasolineCost.groupBy({ by: ["VehicleId"], where: { ...own, DateTime: { gte: from, lt: to } }, _sum: { Amount: true } }),
    prisma.repairVehicle.groupBy({ by: ["VehicleId"], where: { ...own, RepairDate: { gte: from, lt: to } }, _sum: { CompanyPay: true } }),
  ]);
  const fuelOf = new Map(fuel.map((r) => [r.VehicleId, dec(r._sum.Amount)]));
  const repairOf = new Map(repair.map((r) => [r.VehicleId, dec(r._sum.CompanyPay)]));
  const rows = vehicles.map((v) => {
    const f = fuelOf.get(v.VehicleId) ?? 0;
    const r = repairOf.get(v.VehicleId) ?? 0;
    const budget = v.MonthlyBudget == null ? null : dec(v.MonthlyBudget);
    return {
      vehicleId: v.VehicleId,
      plate: plateText(v) || v.Model,
      budget,
      fuel: f,
      repair: r,
      spent: f + r,
      pct: budget ? Math.round(((f + r) / budget) * 1000) / 10 : null,
    };
  });
  rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.spent - a.spent);
  return { month: from.toISOString().slice(0, 7), rows };
}

export async function setVehicleBudget(vehicleId: string, budget: number | null) {
  return prisma.vehicle.updateMany({ where: { VehicleId: vehicleId, TenantId: DEFAULT_TENANT_ID }, data: { MonthlyBudget: budget } });
}
