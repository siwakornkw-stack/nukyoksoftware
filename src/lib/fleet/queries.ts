import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

// Prisma Decimal -> number
export const dec = (d: unknown): number => (d == null ? 0 : Number(d));

export interface AgingBucket {
  bucket: string;
  amount: number;
  count: number;
}
export interface DueItem {
  vehicleId: string;
  plate: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  overdueDays: number;
}

export async function getFleetSummary(from?: Date, to?: Date) {
  const T = DEFAULT_TENANT_ID;
  const now = new Date();
  const rangeStart = from ?? new Date(now.getFullYear(), 0, 1);
  const rangeEnd = to ?? new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const t30 = new Date(now.getTime() - 30 * 86400000);
  const t60 = new Date(now.getTime() - 60 * 86400000);
  const t90 = new Date(now.getTime() - 90 * 86400000);

  // Aggregate installments in the DB instead of loading every row into memory.
  const instAgg = (where: Prisma.InstallmentsVehicleWhereInput) =>
    prisma.installmentsVehicle.aggregate({
      _sum: { Amount: true },
      _count: true,
      where: { Vehicle: { TenantId: T }, ...where },
    });

  const [
    vehicleCount,
    incomeAgg,
    repairAgg,
    gasAgg,
    outAgg,
    recvAgg,
    overAgg,
    b1,
    b2,
    b3,
    b4,
    dueRows,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { TenantId: T, Status: "active" } }),
    prisma.incomeVehicle.aggregate({
      _sum: { AmountReceive: true },
      where: { TenantId: T, DateTime: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.repairVehicle.aggregate({
      _sum: { CompanyPay: true },
      where: { Vehicle: { TenantId: T }, RepairDate: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.gasolineCost.aggregate({
      _sum: { Amount: true },
      where: { Vehicle: { TenantId: T }, DateTime: { gte: rangeStart, lte: rangeEnd } },
    }),
    instAgg({ DatePay: null }), // outstanding (all unpaid)
    instAgg({ DatePay: { not: null } }), // received (paid)
    instAgg({ DatePay: null, DueDate: { lt: now } }), // overdue
    instAgg({ DatePay: null, DueDate: { gte: t30, lt: now } }), // 1-30
    instAgg({ DatePay: null, DueDate: { gte: t60, lt: t30 } }), // 31-60
    instAgg({ DatePay: null, DueDate: { gte: t90, lt: t60 } }), // 61-90
    instAgg({ DatePay: null, DueDate: { lt: t90 } }), // 90+
    prisma.installmentsVehicle.findMany({
      where: { Vehicle: { TenantId: T }, DatePay: null },
      include: {
        Vehicle: { select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true } },
      },
      orderBy: { DueDate: "asc" },
      take: 15,
    }),
  ]);

  const bucket = (agg: { _sum: { Amount: Prisma.Decimal | null }; _count: number }, label: string): AgingBucket => ({
    bucket: label,
    amount: dec(agg._sum.Amount),
    count: agg._count,
  });
  const agingBuckets = [
    bucket(b1, "1-30 วัน"),
    bucket(b2, "31-60 วัน"),
    bucket(b3, "61-90 วัน"),
    bucket(b4, "90+ วัน"),
  ].filter((b) => b.count > 0);

  const dueSoon: DueItem[] = dueRows.map((i) => ({
    vehicleId: i.Vehicle.VehicleId,
    plate: `${i.Vehicle.LicensePlatePrefix} ${i.Vehicle.LicensePlateSuffix}`,
    installmentNumber: i.InstallmentNumber,
    dueDate: i.DueDate.toISOString().slice(0, 10),
    amount: dec(i.Amount),
    overdueDays: Math.floor((now.getTime() - i.DueDate.getTime()) / 86400000),
  }));

  return {
    vehicleCount,
    income: dec(incomeAgg._sum.AmountReceive),
    expense: dec(repairAgg._sum.CompanyPay) + dec(gasAgg._sum.Amount),
    ar: {
      outstanding: dec(outAgg._sum.Amount),
      outstandingCount: outAgg._count,
      overdue: dec(overAgg._sum.Amount),
      overdueCount: overAgg._count,
      received: dec(recvAgg._sum.Amount),
      receivedCount: recvAgg._count,
      agingBuckets,
      dueSoon,
    },
  };
}

// Monthly income vs expense for the reports page.
export async function getMonthlyFinance(months = 12) {
  const T = DEFAULT_TENANT_ID;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [incomes, repairs, gas] = await Promise.all([
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
  return [...map.entries()].sort((a, z) => a[0].localeCompare(z[0])).map(([month, v]) => ({ month, ...v }));
}
