import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateText } from "./plates";

export type Kind = "ins" | "cmi" | "tax";
export const KINDS: Kind[] = ["ins", "cmi", "tax"];
export const KIND_LABEL: Record<Kind, string> = { ins: "ประกันภัย", cmi: "พ.ร.บ.", tax: "ภาษี" };
// record-types keys, for the generic delete API
export const KIND_RECORD: Record<Kind, string> = { ins: "insurance", cmi: "compulsory", tax: "tax" };

export type Status = "expired" | "due30" | "due60" | "ok" | "none";
export const STATUSES: Status[] = ["expired", "due30", "due60", "ok", "none"];
export const STATUS_LABEL: Record<Status, string> = {
  expired: "หมดอายุแล้ว",
  due30: "หมดใน 30 วัน",
  due60: "หมดใน 31-60 วัน",
  ok: "ปกติ",
  none: "ไม่มีข้อมูล",
};
export const STATUS_STYLE: Record<Status, string> = {
  expired: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  due30: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  due60: "bg-yellow-500/10 text-yellow-200 border-yellow-500/30",
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  none: "bg-slate-500/10 text-slate-400 border-slate-600/40",
};

export interface InsRecord {
  id: string;
  kind: Kind;
  vehicleId: string;
  plate: string;
  model: string;
  end: string;
  start: string | null;
  year: number;
  company: string;
  cls: string;
  premium: number;
  note: string;
  createdBy: string;
  days: number;
  status: Status;
}

export interface VehicleCoverage {
  vehicleId: string;
  plate: string;
  model: string;
  characteristic: string;
  driver: string;
  latest: Partial<Record<Kind, InsRecord>>;
  worst: Status;
  note: string;
}

// "Today" is the Bangkok calendar day; stored dates are UTC midnight.
export function todayISO() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400_000);

export function statusOf(days: number | null): Status {
  if (days == null) return "none";
  if (days < 0) return "expired";
  if (days <= 30) return "due30";
  if (days <= 60) return "due60";
  return "ok";
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function loadInsuranceRecords(): Promise<InsRecord[]> {
  const where = { Vehicle: { TenantId: DEFAULT_TENANT_ID } };
  const include = { Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } } };
  const [ins, cmi, tax] = await Promise.all([
    prisma.insurancePolicyVehicle.findMany({ where, include }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where, include }),
    prisma.tax.findMany({ where, include }),
  ]);
  const today = todayISO();
  const mk = (
    kind: Kind,
    r: {
      VehicleId: string;
      EndDate: Date;
      Year: number;
      InsuranceCompany: string;
      TotalPremium: unknown;
      Note: string | null;
      CreatedByUsername: string | null;
      Vehicle: { LicensePlatePrefix: string; LicensePlateSuffix: string; Model: string };
    },
    id: string,
    extra: { start?: Date; cls?: string } = {}
  ): InsRecord => {
    const end = iso(r.EndDate);
    const days = dayDiff(end, today);
    return {
      id,
      kind,
      vehicleId: r.VehicleId,
      plate: plateText(r.Vehicle) || r.Vehicle.Model,
      model: r.Vehicle.Model,
      end,
      start: extra.start ? iso(extra.start) : null,
      year: r.Year,
      company: r.InsuranceCompany,
      cls: extra.cls ?? "",
      premium: Number(r.TotalPremium),
      note: r.Note ?? "",
      createdBy: r.CreatedByUsername ?? "",
      days,
      status: statusOf(days),
    };
  };
  return [
    ...ins.map((r) => mk("ins", r, r.InsurancePolicyVehicleId, { start: r.StartDate, cls: r.Type === "-" ? "" : r.Type })),
    ...cmi.map((r) => mk("cmi", r, r.CompulsoryMotorInsuranceVehicleId)),
    ...tax.map((r) => mk("tax", r, r.TaxId)),
  ];
}

const RANK: Record<Status, number> = { expired: 0, due30: 1, due60: 2, ok: 3, none: 4 };

export async function getCoverage(includeEmpty: boolean) {
  const [records, vehicles] = await Promise.all([
    loadInsuranceRecords(),
    prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID, Status: "active" },
      select: {
        VehicleId: true,
        LicensePlatePrefix: true,
        LicensePlateSuffix: true,
        Model: true,
        VehicleCharacteristic: true,
        VehicleDriver: { select: { Name: true } },
      },
      orderBy: { No: "asc" },
    }),
  ]);

  // Latest = the record that ends last; an old expired row does not matter once renewed.
  const latest = new Map<string, Partial<Record<Kind, InsRecord>>>();
  for (const r of records) {
    const cur = latest.get(r.vehicleId) ?? {};
    if (!cur[r.kind] || cur[r.kind]!.end < r.end) cur[r.kind] = r;
    latest.set(r.vehicleId, cur);
  }

  const coverage: VehicleCoverage[] = vehicles
    .filter((v) => includeEmpty || latest.has(v.VehicleId))
    .map((v) => {
      const l = latest.get(v.VehicleId) ?? {};
      const worst = KINDS.map((k) => l[k]?.status ?? "none").reduce((a, s) => (RANK[s] < RANK[a] ? s : a), "none" as Status);
      return {
        vehicleId: v.VehicleId,
        plate: plateText(v) || v.Model,
        model: v.Model,
        characteristic: v.VehicleCharacteristic,
        driver: v.VehicleDriver?.Name ?? "",
        latest: l,
        worst,
        note: [...new Set(KINDS.map((k) => l[k]?.note).filter(Boolean))].join(" / "),
      };
    });

  const stats = Object.fromEntries(
    KINDS.map((k) => [k, Object.fromEntries(STATUSES.map((s) => [s, coverage.filter((c) => (c.latest[k]?.status ?? "none") === s).length]))])
  ) as Record<Kind, Record<Status, number>>;

  const current = coverage.flatMap((c) => KINDS.flatMap((k) => (c.latest[k] ? [c.latest[k]!] : [])));
  const upcoming = current.filter((r) => r.days <= 90).sort((a, b) => a.days - b.days);

  const today = todayISO();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  const forecast = months.map((m) => ({
    month: m,
    ins: current.filter((r) => r.kind === "ins" && r.end.startsWith(m)).length,
    cmi: current.filter((r) => r.kind === "cmi" && r.end.startsWith(m)).length,
    tax: current.filter((r) => r.kind === "tax" && r.end.startsWith(m)).length,
  }));

  const tally = (key: (r: InsRecord) => string, list: InsRecord[]) => {
    const m = new Map<string, { name: string; count: number; premium: number; expired: number }>();
    for (const r of list) {
      const name = key(r) || "ไม่ระบุ";
      const t = m.get(name) ?? { name, count: 0, premium: 0, expired: 0 };
      t.count++;
      t.premium += r.premium;
      if (r.status === "expired") t.expired++;
      m.set(name, t);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  };
  const policies = current.filter((r) => r.kind === "ins");

  return {
    coverage: coverage.sort((a, b) => RANK[a.worst] - RANK[b.worst] || a.plate.localeCompare(b.plate, "th")),
    stats,
    upcoming,
    forecast,
    byCompany: tally((r) => r.company.replace(/^บจก\.?\s*/, ""), policies),
    byClass: tally((r) => r.cls, policies),
    premium: current.reduce((a, r) => a + r.premium, 0),
    vehiclesWithout: vehicles.length - latest.size,
    totalVehicles: vehicles.length,
  };
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const thMonthShort = (m: string) => `${TH_MONTH[Number(m.slice(5, 7)) - 1]} ${String(Number(m.slice(0, 4)) + 543).slice(2)}`;

export function daysText(days: number) {
  if (days < 0) return `เลยมา ${-days} วัน`;
  if (days === 0) return "หมดวันนี้";
  return `อีก ${days} วัน`;
}
