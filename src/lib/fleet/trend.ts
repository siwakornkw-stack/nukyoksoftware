import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { addMonths } from "./fuel-report";
import { dec } from "./queries";

export interface MonthPoint {
  month: string; // "2026-09"
  income: number;
  fuel: number;
  repair: number; // company share
}

const bkkMonth = (d: Date) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 7);

// Income and running costs (fuel + company-paid repairs) per Bangkok month for
// the `count` months ending with `last`. Premiums are yearly lumps and stay out.
export async function monthTrend(last: string, count = 12): Promise<MonthPoint[]> {
  const first = addMonths(last, -(count - 1));
  const from = new Date(Date.parse(`${first}-01T00:00:00Z`) - 7 * 3600000);
  const to = new Date(Date.parse(`${addMonths(last, 1)}-01T00:00:00Z`) - 7 * 3600000);
  const own = { Vehicle: { TenantId: DEFAULT_TENANT_ID } };
  const [income, fuel, repair] = await Promise.all([
    prisma.incomeVehicle.findMany({ where: { TenantId: DEFAULT_TENANT_ID, DateTime: { gte: from, lt: to } }, select: { DateTime: true, AmountReceive: true } }),
    prisma.gasolineCost.findMany({ where: { ...own, DateTime: { gte: from, lt: to } }, select: { DateTime: true, Amount: true } }),
    prisma.repairVehicle.findMany({ where: { ...own, RepairDate: { gte: from, lt: to } }, select: { RepairDate: true, CompanyPay: true } }),
  ]);
  const points = new Map<string, MonthPoint>();
  for (let i = 0; i < count; i++) {
    const month = addMonths(first, i);
    points.set(month, { month, income: 0, fuel: 0, repair: 0 });
  }
  for (const r of income) {
    const p = points.get(bkkMonth(r.DateTime));
    if (p) p.income += dec(r.AmountReceive);
  }
  for (const r of fuel) {
    const p = points.get(bkkMonth(r.DateTime));
    if (p) p.fuel += dec(r.Amount);
  }
  for (const r of repair) {
    const p = points.get(bkkMonth(r.RepairDate));
    if (p) p.repair += dec(r.CompanyPay);
  }
  return [...points.values()];
}
