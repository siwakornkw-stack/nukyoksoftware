import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateText } from "./plates";

// Oil change by distance: odometer readings come from the office fuel sheet
// (GasolineCost) and the oil-change records themselves.

export const DEFAULT_OIL_INTERVAL_KM = 10000;
// "Due soon" when less than 10% of the interval (at most 1,000) remains, so a
// 250-hour machine is not permanently "soon".
export const OIL_SOON_KM = 1000;
const SETTING = "oil_interval_km";
const DAY = 86400000;

export async function getOilIntervalKm(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING } });
  const n = Number(row?.value);
  return Number.isInteger(n) && n >= 1000 ? n : DEFAULT_OIL_INTERVAL_KM;
}

export async function setVehicleOilInterval(vehicleId: string, interval: number | null) {
  await prisma.vehicle.updateMany({ where: { VehicleId: vehicleId, TenantId: DEFAULT_TENANT_ID }, data: { OilInterval: interval } });
}

export async function setOilIntervalKm(km: number) {
  await prisma.appSetting.upsert({ where: { key: SETTING }, update: { value: String(km) }, create: { key: SETTING, value: String(km) } });
}

export interface Reading {
  at: Date;
  km: number;
}

export interface OilDue {
  currentKm: number | null;
  lastOilKm: number | null;
  sinceKm: number | null;
  remainingKm: number | null;
  kmPerDay: number | null;
  dueDate: Date | null; // estimate from recent km/day
  status: "overdue" | "soon" | "ok" | "unknown";
}

// Pure: readings (any order) -> distance-based oil status.
export function oilDue(readings: Reading[], lastOilKm: number | null, intervalKm: number, now: Date): OilDue {
  const valid = readings.filter((r) => r.km > 0).sort((a, b) => a.at.getTime() - b.at.getTime());
  const currentKm = valid.length ? Math.max(...valid.map((r) => r.km)) : null;
  if (currentKm == null || lastOilKm == null || lastOilKm <= 0) {
    return { currentKm, lastOilKm, sinceKm: null, remainingKm: null, kmPerDay: null, dueDate: null, status: "unknown" };
  }
  const sinceKm = currentKm - lastOilKm;
  const remainingKm = intervalKm - sinceKm;

  // Average daily distance over the last 90 days of readings.
  const recent = valid.filter((r) => r.at.getTime() >= now.getTime() - 90 * DAY);
  let kmPerDay: number | null = null;
  if (recent.length >= 2) {
    const days = (recent[recent.length - 1].at.getTime() - recent[0].at.getTime()) / DAY;
    const km = recent[recent.length - 1].km - recent[0].km;
    if (days >= 1 && km > 0) kmPerDay = km / days;
  }
  const dueDate = remainingKm > 0 && kmPerDay ? new Date(now.getTime() + (remainingKm / kmPerDay) * DAY) : null;
  const status = remainingKm <= 0 ? "overdue" : remainingKm <= Math.min(OIL_SOON_KM, intervalKm * 0.1) ? "soon" : "ok";
  return { currentKm, lastOilKm, sinceKm, remainingKm, kmPerDay, dueDate, status };
}

export interface VehicleOil extends OilDue {
  vehicleId: string;
  plate: string;
  lastOilDate: Date | null;
  interval: number; // this vehicle override, else the global default
  custom: boolean;
}

export async function oilStatusAll(): Promise<{ intervalKm: number; rows: VehicleOil[] }> {
  // Meters are km for trucks and engine hours for machinery, so a vehicle can
  // carry its own interval (Vehicle.OilInterval) in its own unit.
  const T = DEFAULT_TENANT_ID;
  const now = new Date();
  const [intervalKm, vehicles, fuel, oils] = await Promise.all([
    getOilIntervalKm(),
    prisma.vehicle.findMany({
      where: { TenantId: T, Status: "active" },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true, OilInterval: true },
    }),
    prisma.gasolineCost.findMany({
      where: { Vehicle: { TenantId: T, Status: "active" } },
      select: { VehicleId: true, DateTime: true, OdometerStart: true, OdometerEnd: true },
    }),
    prisma.drainTheOilVehicle.findMany({
      where: { Vehicle: { TenantId: T, Status: "active" } },
      select: { VehicleId: true, Date: true, Odometer: true },
      orderBy: { Date: "desc" },
    }),
  ]);

  const readings = new Map<string, Reading[]>();
  const add = (vid: string, at: Date, km: number) => readings.set(vid, [...(readings.get(vid) ?? []), { at, km }]);
  for (const g of fuel) {
    add(g.VehicleId, g.DateTime, Number(g.OdometerStart));
    add(g.VehicleId, g.DateTime, Number(g.OdometerEnd));
  }
  const lastOil = new Map<string, { at: Date; km: number }>();
  for (const o of oils) {
    add(o.VehicleId, o.Date, o.Odometer);
    if (!lastOil.has(o.VehicleId)) lastOil.set(o.VehicleId, { at: o.Date, km: o.Odometer });
  }

  const rows = vehicles.map((v) => {
    const last = lastOil.get(v.VehicleId);
    const interval = v.OilInterval ?? intervalKm;
    return {
      vehicleId: v.VehicleId,
      plate: plateText(v) || v.Model,
      lastOilDate: last?.at ?? null,
      interval,
      custom: v.OilInterval != null,
      ...oilDue(readings.get(v.VehicleId) ?? [], last?.km ?? null, interval, now),
    };
  });
  const rank = { overdue: 0, soon: 1, ok: 2, unknown: 3 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.remainingKm ?? Infinity) - (b.remainingKm ?? Infinity));
  return { intervalKm, rows };
}
