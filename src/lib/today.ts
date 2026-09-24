import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "@/lib/fleet/queries";
import { bangkokToday } from "@/lib/fleet/schedule";
import { oilStatusAll, tireStatusAll } from "@/lib/fleet/maintenance";
import { vehiclesInShop } from "@/lib/fleet/repair";
import { budgetStatus } from "@/lib/fleet/budget";
import { BACKUP_MAX_AGE_MS, lastBackupStatus, type BackupStatus } from "@/lib/ops-alert";

// What needs attention today, across modules. Feeds the home dashboard and the
// morning LINE summary so both always say the same thing.

const DAY = 86400000;
export const DEBT_CLOSED = ["ชำระแล้ว", "ยกเลิก"];

export interface Today {
  renewals: { expired: number; due30: number }; // tax / พ.ร.บ. / insurance, newest per active vehicle
  installments: { overdue: number; overdueAmount: number };
  debt: { overdue: number; overdueAmount: number };
  fuelSuspect7d: number;
  loansOverdue: number;
  oilOverdue: number; // past the km interval since the last oil change
  tiresOverdue: number; // tire positions past the age or distance limit
  inShop: number; // vehicles at the garage today
  overBudget: number; // vehicles at or past this month's budget
  backup: (BackupStatus & { stale: boolean }) | null;
}

export async function getToday(): Promise<Today> {
  const T = DEFAULT_TENANT_ID;
  const today = bangkokToday();
  const todayISO = today.toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * DAY);
  const active = { TenantId: T, Status: "active" };
  const newest = { orderBy: { EndDate: "desc" as const }, distinct: ["VehicleId" as const], select: { EndDate: true } };

  const [taxes, cmis, policies, inst, current, fuelSuspect7d, loansOverdue, backup] = await Promise.all([
    prisma.tax.findMany({ where: { Vehicle: active }, ...newest }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where: { Vehicle: active }, ...newest }),
    prisma.insurancePolicyVehicle.findMany({ where: { Vehicle: active }, ...newest }),
    prisma.installmentsVehicle.aggregate({
      where: { Vehicle: { TenantId: T }, DatePay: null, DueDate: { lt: today } },
      _count: true,
      _sum: { Amount: true },
    }),
    prisma.debtVersion.findFirst({ where: { isCurrent: true }, select: { id: true } }),
    prisma.fuelBill.count({ where: { status: "suspect", createdAt: { gte: new Date(Date.now() - 7 * DAY) } } }),
    prisma.assetLoan.count({ where: { Asset: { TenantId: T }, ReturnedAt: null, DueAt: { lt: today } } }),
    lastBackupStatus(),
  ]);
  const [oil, tires, shop, budget] = await Promise.all([oilStatusAll(), tireStatusAll(), vehiclesInShop(today), budgetStatus(today)]);

  const ends = [...taxes, ...cmis, ...policies].map((r) => r.EndDate);
  const debt = current
    ? await prisma.debtRecord.aggregate({
        // dueDate is ISO text, so a string comparison is a date comparison.
        where: { versionId: current.id, dueDate: { lt: todayISO }, status: { notIn: DEBT_CLOSED } },
        _count: true,
        _sum: { total: true, paid: true },
      })
    : null;

  return {
    renewals: {
      expired: ends.filter((d) => d < today).length,
      due30: ends.filter((d) => d >= today && d <= in30).length,
    },
    installments: { overdue: inst._count, overdueAmount: dec(inst._sum.Amount) },
    debt: { overdue: debt?._count ?? 0, overdueAmount: dec(debt?._sum.total) - dec(debt?._sum.paid) },
    fuelSuspect7d,
    loansOverdue,
    oilOverdue: oil.rows.filter((r) => r.status === "overdue").length,
    tiresOverdue: tires.rows.filter((r) => r.status === "overdue").length,
    inShop: shop.length,
    overBudget: budget.rows.filter((r) => (r.pct ?? 0) >= 100).length,
    backup: backup ? { ...backup, stale: !backup.ok || Date.now() - Date.parse(backup.at) > BACKUP_MAX_AGE_MS } : null,
  };
}
