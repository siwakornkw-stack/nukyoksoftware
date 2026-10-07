import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateText } from "./plates";

export interface FuelRecord {
  id: string;
  vehicleId: string;
  plate: string;
  model: string;
  date: string;
  item: string;
  invoice: string;
  liters: number;
  amount: number;
  odoStart: number;
  odoEnd: number;
  distance: number | null;
  receiver: string;
  billUrl: string;
}

export type AnomalyKind = "sameDay" | "dupInvoice" | "noInvoice" | "price" | "odoBack" | "kmlDrop" | "noLiters";

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  sameDay: "เติมหลายครั้งในวันเดียว",
  dupInvoice: "เลขใบกำกับซ้ำ",
  noInvoice: "ไม่มีเลขใบกำกับ",
  price: "ราคาต่อลิตรผิดปกติ",
  odoBack: "เลขไมล์ถอยหลัง",
  kmlDrop: "กม./ลิตร ต่ำกว่าปกติ",
  noLiters: "ไม่ระบุจำนวนลิตร",
};

// km/L below this share of the vehicle's own median over the previous
// BASELINE_MONTHS months is flagged (leak, siphoning, or a vehicle needing service).
export const BASELINE_MONTHS = 6;
const KML_DROP = 0.8;

export interface Anomaly {
  kind: AnomalyKind;
  detail: string;
  row: FuelRecord;
}

// ISO month helpers ("2026-05")
export const monthStart = (m: string) => new Date(`${m}-01T00:00:00.000Z`);
export function addMonths(m: string, n: number) {
  const d = monthStart(m);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 120; m = addMonths(m, 1)) out.push(m);
  return out;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// The office's "ระยะทางที่ใช้งาน" = last odometer - first odometer of the period.
// Their per-row distance column is often blank or 0, so it is only a fallback.
export function distanceOf(rows: FuelRecord[]) {
  const readings = rows.flatMap((r) => [r.odoStart, r.odoEnd]).filter((x) => x > 0);
  const span = readings.length > 1 ? Math.max(...readings) - Math.min(...readings) : 0;
  if (span > 0) return span;
  return rows.reduce((a, r) => a + (r.distance && r.distance > 0 ? r.distance : 0), 0);
}

function sumUp(rows: FuelRecord[]) {
  const amount = rows.reduce((a, r) => a + r.amount, 0);
  const liters = rows.reduce((a, r) => a + r.liters, 0);
  return { amount: round(amount), liters: round(liters), count: rows.length, avgPrice: liters ? round(amount / liters) : 0 };
}

function groupBy<K extends string>(rows: FuelRecord[], key: (r: FuelRecord) => K) {
  const m = new Map<K, FuelRecord[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function findAnomalies(rows: FuelRecord[]): Anomaly[] {
  const out: Anomaly[] = [];

  for (const list of groupBy(rows, (r) => `${r.vehicleId}|${r.date}`).values())
    if (list.length > 1)
      for (const r of list) out.push({ kind: "sameDay", row: r, detail: `${list.length} ครั้งในวันเดียวกัน` });

  for (const [inv, list] of groupBy(rows, (r) => r.invoice.replace(/\s/g, "").toUpperCase()))
    if (inv && list.length > 1)
      for (const r of list)
        out.push({ kind: "dupInvoice", row: r, detail: `พบ ${list.length} รายการ: ${[...new Set(list.map((x) => x.plate))].join(", ")}` });

  // Diesel moves a baht or so inside a month; anything past 7% of the month's
  // median for the same product is worth a look.
  for (const list of groupBy(rows, (r) => `${r.date.slice(0, 7)}|${r.item}`).values()) {
    const priced = list.filter((r) => r.liters > 0);
    if (priced.length < 3) continue;
    const med = median(priced.map((r) => r.amount / r.liters));
    for (const r of priced) {
      const p = r.amount / r.liters;
      const diff = (p - med) / med;
      if (Math.abs(diff) > 0.07)
        out.push({ kind: "price", row: r, detail: `${round(p)} บาท/ลิตร (ค่ากลาง ${round(med)}, ${diff > 0 ? "+" : ""}${round(diff * 100, 1)}%)` });
    }
  }

  for (const list of groupBy(rows, (r) => r.vehicleId).values()) {
    let last = 0;
    for (const r of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
      if (r.odoEnd > 0 && r.odoStart > 0 && r.odoEnd < r.odoStart)
        out.push({ kind: "odoBack", row: r, detail: `ปลายทาง ${r.odoEnd} น้อยกว่าต้นทาง ${r.odoStart}` });
      else if (r.odoStart > 0 && last > 0 && r.odoStart < last)
        out.push({ kind: "odoBack", row: r, detail: `ต้นทาง ${r.odoStart} น้อยกว่าเลขไมล์ครั้งก่อน ${last}` });
      last = Math.max(last, r.odoStart, r.odoEnd);
    }
  }

  for (const r of rows) {
    if (!r.invoice) out.push({ kind: "noInvoice", row: r, detail: "-" });
    if (!r.liters) out.push({ kind: "noLiters", row: r, detail: "-" });
  }

  return out.sort((a, b) => a.row.date.localeCompare(b.row.date));
}

// history must cover BASELINE_MONTHS before months[0] through the last month.
// Needs at least 3 baseline months with a km/L figure, or nothing is judged.
export function efficiencyDrops(history: FuelRecord[], months: string[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const list of groupBy(history, (r) => r.vehicleId).values()) {
    const byMonth = groupBy(list, (r) => r.date.slice(0, 7));
    const kml = (m: string) => {
      const rows = byMonth.get(m) ?? [];
      const liters = rows.reduce((a, r) => a + r.liters, 0);
      const km = distanceOf(rows);
      return liters > 0 && km > 0 ? km / liters : 0;
    };
    for (const m of months) {
      const cur = kml(m);
      if (!cur) continue;
      const base = Array.from({ length: BASELINE_MONTHS }, (_, i) => kml(addMonths(m, -(i + 1)))).filter((x) => x > 0);
      if (base.length < 3) continue;
      const med = median(base);
      if (cur < med * KML_DROP) {
        const rows = byMonth.get(m)!;
        out.push({
          kind: "kmlDrop",
          row: rows[rows.length - 1],
          detail: `${thMonth(m)}: ${round(cur)} กม./ลิตร (ปกติ ${round(med)}, ${round(((cur - med) / med) * 100, 1)}%)`,
        });
      }
    }
  }
  return out;
}

export function analyzeFuel(rows: FuelRecord[], months: string[]) {
  const totals = sumUp(rows);

  const byMonth = groupBy(rows, (r) => r.date.slice(0, 7));
  const monthly = months.map((m) => ({ month: m, ...sumUp(byMonth.get(m) ?? []) }));

  const byVehicle = [...groupBy(rows, (r) => r.vehicleId).values()]
    .map((list) => {
      const s = sumUp(list);
      const distance = round(distanceOf(list));
      const receivers = [...new Set(list.map((r) => r.receiver).filter(Boolean))];
      return {
        vehicleId: list[0].vehicleId,
        plate: list[0].plate,
        model: list[0].model,
        ...s,
        distance,
        bahtPerKm: distance ? round(s.amount / distance) : 0,
        kmPerLiter: distance && s.liters ? round(distance / s.liters) : 0,
        perFill: round(s.amount / s.count),
        share: totals.amount ? round((s.amount / totals.amount) * 100, 1) : 0,
        lastDate: list.map((r) => r.date).sort().pop() ?? "",
        receivers,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const byReceiver = [...groupBy(rows, (r) => r.receiver || "-").entries()]
    .map(([name, list]) => ({ name, ...sumUp(list), vehicles: new Set(list.map((r) => r.vehicleId)).size }))
    .sort((a, b) => b.amount - a.amount);

  const byItem = [...groupBy(rows, (r) => r.item || "-").entries()]
    .map(([item, list]) => ({ item, ...sumUp(list) }))
    .sort((a, b) => b.amount - a.amount);

  const distance = round(byVehicle.reduce((a, v) => a + v.distance, 0));
  const withDistance = byVehicle.filter((v) => v.distance > 0);
  const amountWithDistance = withDistance.reduce((a, v) => a + v.amount, 0);

  return {
    totals: {
      ...totals,
      vehicles: byVehicle.length,
      distance,
      bahtPerKm: distance ? round(amountWithDistance / distance) : 0,
      perVehicle: byVehicle.length ? round(totals.amount / byVehicle.length) : 0,
    },
    monthly,
    byVehicle,
    byReceiver,
    byItem,
    anomalies: findAnomalies(rows),
  };
}

export async function loadFuelRecords(opts: { from: string; to: string; vehicleId?: string; receiver?: string }) {
  const rows = await prisma.gasolineCost.findMany({
    where: {
      Vehicle: { TenantId: DEFAULT_TENANT_ID },
      DateTime: { gte: monthStart(opts.from), lt: monthStart(addMonths(opts.to, 1)) },
      ...(opts.vehicleId ? { VehicleId: opts.vehicleId } : {}),
      ...(opts.receiver ? { ReceiverName: opts.receiver } : {}),
    },
    include: { Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } } },
    orderBy: [{ DateTime: "asc" }, { CreatedAt: "asc" }],
  });
  return rows.map(
    (g): FuelRecord => ({
      id: g.GasolineCostId,
      vehicleId: g.VehicleId,
      plate: plateText(g.Vehicle) || g.Vehicle.Model,
      model: g.Vehicle.Model,
      date: g.DateTime.toISOString().slice(0, 10),
      item: g.Item,
      invoice: g.TaxInvoiceNumber ?? "",
      liters: Number(g.Liters),
      amount: Number(g.Amount),
      odoStart: Number(g.OdometerStart),
      odoEnd: Number(g.OdometerEnd),
      distance: g.Distance == null ? null : Number(g.Distance),
      receiver: g.ReceiverName ?? "",
      billUrl: g.BillUrl ?? "",
    })
  );
}

// Filter defaults: the latest month that actually has data, and the vehicles
// that have ever been fuelled (a dropdown of every vehicle would be noise).
export async function fuelFilterOptions() {
  const T = DEFAULT_TENANT_ID;
  const [latest, earliest, vehicles, receivers] = await Promise.all([
    prisma.gasolineCost.findFirst({ where: { Vehicle: { TenantId: T } }, orderBy: { DateTime: "desc" }, select: { DateTime: true } }),
    prisma.gasolineCost.findFirst({ where: { Vehicle: { TenantId: T } }, orderBy: { DateTime: "asc" }, select: { DateTime: true } }),
    prisma.vehicle.findMany({
      where: { TenantId: T, GasolineCost: { some: {} } },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true },
      orderBy: { No: "asc" },
    }),
    prisma.gasolineCost.findMany({
      where: { Vehicle: { TenantId: T }, ReceiverName: { not: null } },
      distinct: ["ReceiverName"],
      select: { ReceiverName: true },
    }),
  ]);
  const now = new Date().toISOString().slice(0, 7);
  return {
    latestMonth: latest ? latest.DateTime.toISOString().slice(0, 7) : now,
    earliestMonth: earliest ? earliest.DateTime.toISOString().slice(0, 7) : now,
    vehicles: vehicles.map((v) => ({ id: v.VehicleId, plate: plateText(v) || v.Model, model: v.Model })),
    receivers: receivers.map((r) => r.ReceiverName!).filter(Boolean).sort((a, b) => a.localeCompare(b, "th")),
  };
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export function resolveRange(sp: { from?: string; to?: string }, latestMonth: string) {
  let to = sp.to && MONTH_RE.test(sp.to) ? sp.to : latestMonth;
  let from = sp.from && MONTH_RE.test(sp.from) ? sp.from : to;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const thMonth = (m: string) => `${TH_MONTH[Number(m.slice(5, 7)) - 1]} ${Number(m.slice(0, 4)) + 543}`;
