import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

const YEAR_MS = 365 * 86400000;

// Prisma Decimal -> number
export const dec = (d: unknown): number => (d == null ? 0 : Number(d));

// Monthly income vs expense for the reports page.
export async function getMonthlyFinance(months = 12) {
  const T = DEFAULT_TENANT_ID;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  // Premiums follow vehicle-pnl.ts: insurance when the cover starts, tax and
  // พ.ร.บ. one year before their end date.
  const shifted = { gte: new Date(start.getTime() + YEAR_MS), lt: new Date(end.getTime() + YEAR_MS) };

  const [incomes, repairs, gas, tax, cmi, ins] = await Promise.all([
    prisma.incomeVehicle.findMany({
      where: { TenantId: T, DateTime: { gte: start } },
      select: { DateTime: true, AmountReceive: true },
    }),
    prisma.repairVehicle.findMany({
      where: { Vehicle: { TenantId: T }, RepairDate: { gte: start } },
      select: { RepairDate: true, CompanyPay: true },
    }),
    prisma.gasolineCost.findMany({
      where: { Vehicle: { TenantId: T }, DateTime: { gte: start } },
      select: { DateTime: true, Amount: true },
    }),
    prisma.tax.findMany({ where: { Vehicle: { TenantId: T }, EndDate: shifted }, select: { EndDate: true, TotalPremium: true } }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where: { Vehicle: { TenantId: T }, EndDate: shifted }, select: { EndDate: true, TotalPremium: true } }),
    prisma.insurancePolicyVehicle.findMany({ where: { Vehicle: { TenantId: T }, StartDate: { gte: start, lt: end } }, select: { StartDate: true, TotalPremium: true } }),
  ]);

  const map = new Map<string, { income: number; expense: number }>();
  const key = (d: Date) => d.toISOString().slice(0, 7);
  for (const i of incomes) {
    const m = map.get(key(i.DateTime)) ?? { income: 0, expense: 0 };
    m.income += dec(i.AmountReceive);
    map.set(key(i.DateTime), m);
  }
  for (const r of repairs) {
    const m = map.get(key(r.RepairDate)) ?? { income: 0, expense: 0 };
    m.expense += dec(r.CompanyPay);
    map.set(key(r.RepairDate), m);
  }
  for (const g of gas) {
    const m = map.get(key(g.DateTime)) ?? { income: 0, expense: 0 };
    m.expense += dec(g.Amount);
    map.set(key(g.DateTime), m);
  }
  const addExpense = (d: Date, amount: unknown) => {
    if (!dec(amount)) return; // premium not filled in: do not add an empty month to the chart
    const m = map.get(key(d)) ?? { income: 0, expense: 0 };
    m.expense += dec(amount);
    map.set(key(d), m);
  };
  for (const r of [...tax, ...cmi]) addExpense(new Date(r.EndDate.getTime() - YEAR_MS), r.TotalPremium);
  for (const r of ins) addExpense(r.StartDate, r.TotalPremium);
  return [...map.entries()].sort((a, z) => a[0].localeCompare(z[0])).map(([month, v]) => ({ month, ...v }));
}
