import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { loadMatcher } from "@/lib/fleet/office-import";
import { plateText } from "@/lib/fleet/plates";
import { dateKey } from "./db";

// LINE receipts vs the office's fuel sheet (GasolineCost), per vehicle and month.
// A receipt "has an office row" when the same vehicle has a row on the same day
// whose amount is within TOLERANCE baht.
const TOLERANCE = 1;

export interface ReconVehicle {
  vehicleId: string;
  plate: string;
  line: { count: number; liters: number; baht: number };
  office: { count: number; liters: number; baht: number };
}
export interface ReconBill {
  id: number;
  date: string;
  employee: string;
  plate: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  liters: number | null;
  total: number | null;
  status: string;
}

export async function reconcileMonth(ym: string) {
  const from = new Date(`${ym}-01T00:00:00.000Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));

  const [bills, office, vehicles] = await Promise.all([
    // billDate is text (YYYY-MM-DD); bills without one fall back to createdAt.
    prisma.fuelBill.findMany({
      where: { OR: [{ billDate: { startsWith: ym } }, { billDate: null, createdAt: { gte: from, lt: to } }] },
      orderBy: { id: "asc" },
    }),
    prisma.gasolineCost.findMany({
      where: { Vehicle: { TenantId: DEFAULT_TENANT_ID }, DateTime: { gte: from, lt: to } },
      select: { VehicleId: true, DateTime: true, Liters: true, Amount: true },
    }),
    prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true },
    }),
  ]);
  const plateOf = new Map(vehicles.map((v) => [v.VehicleId, plateText(v) || v.Model]));

  const rows = new Map<string, ReconVehicle>();
  const row = (vid: string) => {
    let r = rows.get(vid);
    if (!r) {
      r = { vehicleId: vid, plate: plateOf.get(vid) ?? vid, line: { count: 0, liters: 0, baht: 0 }, office: { count: 0, liters: 0, baht: 0 } };
      rows.set(vid, r);
    }
    return r;
  };

  const officeByDay = new Map<string, number[]>();
  for (const o of office) {
    const r = row(o.VehicleId);
    r.office.count++;
    r.office.liters += Number(o.Liters);
    r.office.baht += Number(o.Amount);
    const k = `${o.VehicleId}|${o.DateTime.toISOString().slice(0, 10)}`;
    officeByDay.set(k, [...(officeByDay.get(k) ?? []), Number(o.Amount)]);
  }

  const toBill = (b: (typeof bills)[number]): ReconBill => ({
    id: b.id,
    date: dateKey(b),
    employee: b.employeeName || b.lineUserId,
    plate: b.plate,
    vehicleId: b.VehicleId,
    vehiclePlate: b.VehicleId ? plateOf.get(b.VehicleId) ?? null : null,
    liters: b.liters == null ? null : Number(b.liters),
    total: b.total == null ? null : Number(b.total),
    status: b.status,
  });

  const unmatched: ReconBill[] = [];
  const noOfficeRow: ReconBill[] = [];
  for (const b of bills) {
    if (!b.VehicleId) {
      unmatched.push(toBill(b));
      continue;
    }
    const r = row(b.VehicleId);
    r.line.count++;
    r.line.liters += Number(b.liters ?? 0);
    r.line.baht += Number(b.total ?? 0);
    // Consume the office amount so two identical receipts need two office rows.
    const amounts = officeByDay.get(`${b.VehicleId}|${dateKey(b)}`) ?? [];
    const i = b.total == null ? -1 : amounts.findIndex((a) => Math.abs(a - Number(b.total)) <= TOLERANCE);
    if (i >= 0) amounts.splice(i, 1);
    else noOfficeRow.push(toBill(b));
  }

  return {
    vehicles: [...rows.values()].sort((a, z) => z.line.baht + z.office.baht - (a.line.baht + a.office.baht)),
    unmatched,
    noOfficeRow,
    vehicleOptions: vehicles.map((v) => ({ id: v.VehicleId, plate: plateOf.get(v.VehicleId)! })),
  };
}

// Re-run plate matching for receipts that have no vehicle yet (older bills, or
// ones read before an alias existed). Returns how many got linked.
export async function rematchBills(): Promise<number> {
  const [{ match }, bills] = await Promise.all([
    loadMatcher(),
    prisma.fuelBill.findMany({ where: { VehicleId: null, plate: { not: null } }, select: { id: true, plate: true } }),
  ]);
  let linked = 0;
  for (const b of bills) {
    const vid = match(b.plate!);
    if (!vid) continue;
    await prisma.fuelBill.update({ where: { id: b.id }, data: { VehicleId: vid } });
    linked++;
  }
  return linked;
}
