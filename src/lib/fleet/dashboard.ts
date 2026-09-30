// Detailed yearly figures for the /fleet dashboard. Months are Bangkok months.
// Costs use the same rules as vehicle-pnl.ts: fuel and repairs on their own date,
// insurance when the cover starts, tax and พ.ร.บ. one year before their end date.
// Installments are loan payments the company makes (not income): counted by the
// month they were paid.
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "./queries";
import { plateText } from "./plates";
import { bangkokToday } from "./schedule";

const DAY = 86400000;
const YEAR_MS = 365 * DAY;
const BKK = 7 * 3600000;
const bkkMonth = (d: Date) => new Date(d.getTime() + BKK).toISOString().slice(0, 7);

export interface DashMonth {
  month: string; // "2026-09"
  incomeTax: number; // sales-tax documents, before VAT
  incomeCash: number; // cash bills
  incomeOther: number; // per-vehicle income, driver jobs, hand-entered
  income: number;
  fuel: number;
  repair: number;
  premiums: number;
  expense: number; // fuel + repair + premiums
  installments: number; // loan installments paid this month
  fuelRows: number;
}

export interface Renewal {
  vehicleId: string;
  plate: string;
  kind: "ภาษี" | "พ.ร.บ." | "ประกันภัย";
  end: string;
  days: number; // negative = expired
}

export async function fleetDashboard(year: number) {
  const T = DEFAULT_TENANT_ID;
  const own = { Vehicle: { TenantId: T } };
  const from = new Date(Date.UTC(year, 0, 1) - BKK);
  const to = new Date(Date.UTC(year + 1, 0, 1) - BKK);
  const shifted = { gte: new Date(from.getTime() + YEAR_MS), lt: new Date(to.getTime() + YEAR_MS) };
  const today = bangkokToday();
  const thisMonth = today.toISOString().slice(0, 7);
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const in30 = new Date(today.getTime() + 30 * DAY);
  const activeV = { TenantId: T, Status: "active" };
  const newest = {
    orderBy: { EndDate: "desc" as const },
    distinct: ["VehicleId" as const],
    select: { VehicleId: true, EndDate: true, Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } } },
  };

  const [vehicles, income, fuel, repair, tax, cmi, ins, paid, unpaid, taxes, cmis, policies] = await Promise.all([
    prisma.vehicle.findMany({ where: { TenantId: T }, select: { VehicleId: true, Status: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } }),
    prisma.incomeVehicle.findMany({
      where: { TenantId: T, DateTime: { gte: from, lt: to } },
      select: { DateTime: true, AmountReceive: true, SourceLabel: true, CustomerName: true },
    }),
    prisma.gasolineCost.findMany({ where: { ...own, DateTime: { gte: from, lt: to } }, select: { DateTime: true, Amount: true, Liters: true, VehicleId: true } }),
    prisma.repairVehicle.findMany({ where: { ...own, RepairDate: { gte: from, lt: to } }, select: { RepairDate: true, CompanyPay: true, VehicleId: true } }),
    prisma.tax.findMany({ where: { ...own, EndDate: shifted }, select: { EndDate: true, TotalPremium: true } }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where: { ...own, EndDate: shifted }, select: { EndDate: true, TotalPremium: true } }),
    prisma.insurancePolicyVehicle.findMany({ where: { ...own, StartDate: { gte: from, lt: to } }, select: { StartDate: true, TotalPremium: true } }),
    prisma.installmentsVehicle.findMany({ where: { ...own, DatePay: { gte: from, lt: to } }, select: { DatePay: true, Amount: true } }),
    prisma.installmentsVehicle.findMany({
      where: { ...own, DatePay: null },
      select: { VehicleId: true, InstallmentNumber: true, DueDate: true, Amount: true, Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } } },
      orderBy: { DueDate: "asc" },
    }),
    prisma.tax.findMany({ where: { Vehicle: activeV }, ...newest }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where: { Vehicle: activeV }, ...newest }),
    prisma.insurancePolicyVehicle.findMany({ where: { Vehicle: activeV }, ...newest }),
  ]);

  const months = new Map<string, DashMonth>();
  for (let m = 0; m < 12; m++) {
    const month = `${year}-${String(m + 1).padStart(2, "0")}`;
    months.set(month, { month, incomeTax: 0, incomeCash: 0, incomeOther: 0, income: 0, fuel: 0, repair: 0, premiums: 0, expense: 0, installments: 0, fuelRows: 0 });
  }
  const at = (d: Date) => months.get(bkkMonth(d));

  const customers = new Map<string, { amount: number; docs: number }>();
  for (const r of income) {
    const p = at(r.DateTime);
    const a = dec(r.AmountReceive);
    if (p) {
      if (r.SourceLabel === "sales-tax") p.incomeTax += a;
      else if (r.SourceLabel === "cash-bill") p.incomeCash += a;
      else p.incomeOther += a;
    }
    const name = (r.CustomerName ?? "").trim() || "(ไม่ระบุลูกค้า)";
    const c = customers.get(name) ?? { amount: 0, docs: 0 };
    c.amount += a;
    c.docs++;
    customers.set(name, c);
  }

  const fuelBy = new Map<string, { amount: number; liters: number; fills: number }>();
  for (const r of fuel) {
    const p = at(r.DateTime);
    if (p) {
      p.fuel += dec(r.Amount);
      p.fuelRows++;
    }
    const f = fuelBy.get(r.VehicleId) ?? { amount: 0, liters: 0, fills: 0 };
    f.amount += dec(r.Amount);
    f.liters += dec(r.Liters);
    f.fills++;
    fuelBy.set(r.VehicleId, f);
  }
  const repairBy = new Map<string, number>();
  for (const r of repair) {
    const p = at(r.RepairDate);
    if (p) p.repair += dec(r.CompanyPay);
    repairBy.set(r.VehicleId, (repairBy.get(r.VehicleId) ?? 0) + dec(r.CompanyPay));
  }
  let taxSum = 0;
  let cmiSum = 0;
  let insSum = 0;
  for (const r of tax) {
    const p = at(new Date(r.EndDate.getTime() - YEAR_MS));
    if (p) p.premiums += dec(r.TotalPremium);
    taxSum += dec(r.TotalPremium);
  }
  for (const r of cmi) {
    const p = at(new Date(r.EndDate.getTime() - YEAR_MS));
    if (p) p.premiums += dec(r.TotalPremium);
    cmiSum += dec(r.TotalPremium);
  }
  for (const r of ins) {
    const p = at(r.StartDate);
    if (p) p.premiums += dec(r.TotalPremium);
    insSum += dec(r.TotalPremium);
  }
  for (const r of paid) {
    const p = at(r.DatePay!);
    if (p) p.installments += dec(r.Amount);
  }
  const list = [...months.values()].map((m) => ({
    ...m,
    income: m.incomeTax + m.incomeCash + m.incomeOther,
    expense: m.fuel + m.repair + m.premiums,
  }));

  const sum = (k: keyof Omit<DashMonth, "month">) => list.reduce((a, m) => a + m[k], 0);
  const totals = {
    incomeTax: sum("incomeTax"),
    incomeCash: sum("incomeCash"),
    incomeOther: sum("incomeOther"),
    income: sum("income"),
    fuel: sum("fuel"),
    repair: sum("repair"),
    tax: taxSum,
    cmi: cmiSum,
    ins: insSum,
    premiums: sum("premiums"),
    expense: sum("expense"),
    installments: sum("installments"),
  };

  // Months up to now with no fuel although other months have some: usually a
  // monthly office file that has not been imported yet.
  const past = list.filter((m) => m.month <= thisMonth);
  const fuelGaps = past.some((m) => m.fuelRows) ? past.filter((m) => !m.fuelRows).map((m) => m.month) : [];
  const incomeGaps = past.some((m) => m.income) ? past.filter((m) => !m.income).map((m) => m.month) : [];

  const vName = new Map(vehicles.map((v) => [v.VehicleId, plateText(v) || v.Model]));
  const topFuel = [...fuelBy.entries()]
    .map(([id, f]) => ({ vehicleId: id, plate: vName.get(id) ?? "-", ...f, repair: repairBy.get(id) ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  const topCustomers = [...customers.entries()]
    .map(([name, c]) => ({ name, ...c }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const overdue = unpaid.filter((i) => i.DueDate < today);
  const dueThisMonth = unpaid.filter((i) => i.DueDate >= today && i.DueDate < monthEnd);
  const instItem = (i: (typeof unpaid)[number]) => ({
    vehicleId: i.VehicleId,
    plate: plateText(i.Vehicle) || i.Vehicle.Model,
    no: i.InstallmentNumber,
    due: i.DueDate.toISOString().slice(0, 10),
    amount: dec(i.Amount),
    days: Math.round((today.getTime() - i.DueDate.getTime()) / DAY),
  });
  const amountOf = (rows: typeof unpaid) => rows.reduce((a, i) => a + dec(i.Amount), 0);

  const renewals: Renewal[] = [
    ...taxes.map((r) => ({ r, kind: "ภาษี" as const })),
    ...cmis.map((r) => ({ r, kind: "พ.ร.บ." as const })),
    ...policies.map((r) => ({ r, kind: "ประกันภัย" as const })),
  ]
    .filter(({ r }) => r.EndDate <= in30)
    .map(({ r, kind }) => ({
      vehicleId: r.VehicleId,
      plate: plateText(r.Vehicle) || r.Vehicle.Model,
      kind,
      end: r.EndDate.toISOString().slice(0, 10),
      days: Math.round((r.EndDate.getTime() - today.getTime()) / DAY),
    }))
    .sort((a, b) => a.days - b.days);

  return {
    year,
    months: list,
    totals,
    fuelGaps,
    incomeGaps,
    vehicles: { active: vehicles.filter((v) => v.Status === "active").length, inactive: vehicles.filter((v) => v.Status !== "active").length },
    fuelLiters: fuel.reduce((a, r) => a + dec(r.Liters), 0),
    fuelFills: fuel.length,
    topFuel,
    topCustomers,
    customerCount: customers.size,
    installments: {
      outstanding: amountOf(unpaid),
      outstandingCount: unpaid.length,
      overdue: amountOf(overdue),
      overdueCount: overdue.length,
      dueThisMonth: amountOf(dueThisMonth),
      dueThisMonthCount: dueThisMonth.length,
      next: unpaid.slice(0, 15).map(instItem), // oldest due first: overdue, then upcoming
      vehicles: new Set(unpaid.map((i) => i.VehicleId)).size,
    },
    renewals,
  };
}
