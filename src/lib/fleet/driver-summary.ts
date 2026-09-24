import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export interface DriverMonth {
  driverId: string;
  name: string;
  jobs: number;
  amount: number;
  billed: number; // jobs already on a billing note
}

// "2026-09" -> [start, end) in UTC for that Bangkok month (the server runs TZ=UTC,
// Bangkok is +7 all year).
export function bkkMonthRange(month: string): [Date, Date] {
  const [y, m] = month.split("-").map(Number);
  return [new Date(Date.UTC(y, m - 1, 1) - 7 * 3600000), new Date(Date.UTC(y, m, 1) - 7 * 3600000)];
}

// Finished jobs per driver in one month, by the time the job was closed.
export async function driverMonth(month: string): Promise<DriverMonth[]> {
  const [from, to] = bkkMonthRange(month);
  const jobs = await prisma.driverJob.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, Status: "done", RespondedAt: { gte: from, lt: to }, VehicleDriverId: { not: null } },
    select: { VehicleDriverId: true, Price: true, BillNo: true, VehicleDriver: { select: { Name: true } } },
  });
  const by = new Map<string, DriverMonth>();
  for (const j of jobs) {
    const id = j.VehicleDriverId!;
    const row = by.get(id) ?? { driverId: id, name: j.VehicleDriver?.Name ?? "-", jobs: 0, amount: 0, billed: 0 };
    row.jobs++;
    row.amount += Number(j.Price ?? 0);
    if (j.BillNo) row.billed++;
    by.set(id, row);
  }
  return [...by.values()].sort((a, b) => b.amount - a.amount);
}
