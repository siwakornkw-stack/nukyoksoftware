import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "./queries";
import { plateText } from "./plates";

export interface VehiclePnl {
  vehicleId: string;
  plate: string;
  model: string;
  active: boolean;
  income: number;
  fuel: number;
  repair: number;
  premiums: number; // tax + พ.ร.บ. + insurance
  expense: number;
  net: number;
}

const YEAR_MS = 365 * 86400000;

// Income and costs per vehicle for [from, to). Fuel and repairs count on their
// own date. Premiums count when the cover starts: insurance by StartDate; tax
// and พ.ร.บ. keep only an end date, so they count one year before it.
export async function vehiclePnl(from: Date, to: Date): Promise<VehiclePnl[]> {
  const T = DEFAULT_TENANT_ID;
  const own = { Vehicle: { TenantId: T } };
  const shifted = { gte: new Date(from.getTime() + YEAR_MS), lt: new Date(to.getTime() + YEAR_MS) };

  const [vehicles, income, fuel, repair, tax, cmi, ins] = await Promise.all([
    prisma.vehicle.findMany({
      where: { TenantId: T },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true, Status: true },
    }),
    prisma.incomeVehicle.groupBy({
      by: ["VehicleId"],
      where: { TenantId: T, VehicleId: { not: null }, DateTime: { gte: from, lt: to } },
      _sum: { AmountReceive: true },
    }),
    prisma.gasolineCost.groupBy({ by: ["VehicleId"], where: { ...own, DateTime: { gte: from, lt: to } }, _sum: { Amount: true } }),
    prisma.repairVehicle.groupBy({ by: ["VehicleId"], where: { ...own, RepairDate: { gte: from, lt: to } }, _sum: { CompanyPay: true } }),
    prisma.tax.groupBy({ by: ["VehicleId"], where: { ...own, EndDate: shifted }, _sum: { TotalPremium: true } }),
    prisma.compulsoryMotorInsuranceVehicle.groupBy({ by: ["VehicleId"], where: { ...own, EndDate: shifted }, _sum: { TotalPremium: true } }),
    prisma.insurancePolicyVehicle.groupBy({ by: ["VehicleId"], where: { ...own, StartDate: { gte: from, lt: to } }, _sum: { TotalPremium: true } }),
  ]);

  const sums = <R extends { VehicleId: string | null }>(rows: R[], pick: (r: R) => unknown) =>
    new Map(rows.map((r) => [r.VehicleId, dec(pick(r))]));
  const incomeOf = sums(income, (r) => r._sum.AmountReceive);
  const fuelOf = sums(fuel, (r) => r._sum.Amount);
  const repairOf = sums(repair, (r) => r._sum.CompanyPay);
  const taxOf = sums(tax, (r) => r._sum.TotalPremium);
  const cmiOf = sums(cmi, (r) => r._sum.TotalPremium);
  const insOf = sums(ins, (r) => r._sum.TotalPremium);

  return vehicles
    .map((v) => {
      const id = v.VehicleId;
      const inc = incomeOf.get(id) ?? 0;
      const f = fuelOf.get(id) ?? 0;
      const r = repairOf.get(id) ?? 0;
      const p = (taxOf.get(id) ?? 0) + (cmiOf.get(id) ?? 0) + (insOf.get(id) ?? 0);
      return {
        vehicleId: id,
        plate: plateText(v) || v.Model,
        model: v.Model,
        active: v.Status === "active",
        income: inc,
        fuel: f,
        repair: r,
        premiums: p,
        expense: f + r + p,
        net: inc - f - r - p,
      };
    })
    // Inactive vehicles with nothing in the period are just noise.
    .filter((x) => x.active || x.income || x.expense)
    .sort((a, b) => a.net - b.net);
}
