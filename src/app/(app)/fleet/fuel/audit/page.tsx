import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateText } from "@/lib/fleet/plates";
import { ANOMALY_LABEL, findAnomalies, fuelFilterOptions, loadFuelRecords, resolveRange, thMonth } from "@/lib/fleet/fuel-report";
import { FuelFilters } from "../FuelFilters";
import { AuditRunner, type AuditItem } from "./AuditRunner";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; vehicle?: string; receiver?: string; st?: string; photo?: string };

const STATUS_TABS = [
  { key: "todo", label: "ยังไม่ตรวจ" },
  { key: "problem", label: "มีปัญหา" },
  { key: "ok", label: "ถูกต้อง" },
  { key: "all", label: "ทั้งหมด" },
] as const;
type St = (typeof STATUS_TABS)[number]["key"];

export default async function FuelAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const opts = await fuelFilterOptions();
  const { from, to } = resolveRange(sp, opts.latestMonth);
  const st: St = STATUS_TABS.some((t) => t.key === sp.st) ? (sp.st as St) : "todo";
  const photoOnly = sp.photo === "1";

  const [records, vehicleRows] = await Promise.all([
    loadFuelRecords({ from, to, vehicleId: sp.vehicle || undefined, receiver: sp.receiver || undefined }),
    prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true },
      orderBy: { No: "asc" },
    }),
  ]);
  const checks = await prisma.gasolineCost.findMany({
    where: { GasolineCostId: { in: records.map((r) => r.id) } },
    select: { GasolineCostId: true, AuditStatus: true, AuditNote: true, AuditedBy: true, AuditedAt: true, CreatedByUsername: true, UpdatedAt: true },
  });
  const checkOf = new Map(checks.map((c) => [c.GasolineCostId, c]));

  // Same warnings as the fuel records page, computed over the whole range.
  const flags = new Map<string, string[]>();
  for (const a of findAnomalies(records))
    flags.set(a.row.id, [...(flags.get(a.row.id) ?? []), a.detail === "-" ? ANOMALY_LABEL[a.kind] : `${ANOMALY_LABEL[a.kind]}: ${a.detail}`]);

  const items: AuditItem[] = records
    .map((r) => {
      const c = checkOf.get(r.id);
      return {
        ...r,
        flags: flags.get(r.id) ?? [],
        createdBy: c?.CreatedByUsername ?? "",
        auditStatus: (c?.AuditStatus as AuditItem["auditStatus"]) ?? null,
        auditNote: c?.AuditNote ?? "",
        auditedBy: c?.AuditedBy ?? "",
        auditedAt: c?.AuditedAt?.toISOString() ?? "",
        updatedAt: c?.UpdatedAt.toISOString() ?? "",
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.plate.localeCompare(b.plate, "th"));

  const inPhoto = photoOnly ? items.filter((i) => i.billUrl) : items;
  const count = (k: St) => (k === "all" ? inPhoto.length : inPhoto.filter((i) => (k === "todo" ? !i.auditStatus : i.auditStatus === k)).length);
  const shown = st === "all" ? inPhoto : inPhoto.filter((i) => (st === "todo" ? !i.auditStatus : i.auditStatus === st));

  const vehicles = vehicleRows
    .map((v) => {
      const plate = plateText(v) || v.Model;
      return { id: v.VehicleId, plate: v.Model && v.Model !== plate ? `${plate} - ${v.Model}` : plate };
    })
    .sort((a, b) => a.plate.localeCompare(b.plate, "th"));

  const keep: Record<string, string> = { from, to };
  if (sp.vehicle) keep.vehicle = sp.vehicle;
  if (sp.receiver) keep.receiver = sp.receiver;
  const link = (p: Record<string, string>) => `/fleet/fuel/audit?${new URLSearchParams({ ...keep, st, ...(photoOnly ? { photo: "1" } : {}), ...p })}`;
  const extra: Record<string, string> = { st, ...(photoOnly ? { photo: "1" } : {}) };
  const rangeText = from === to ? thMonth(from) : `${thMonth(from)} - ${thMonth(to)}`;
  const done = count("ok") + count("problem");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="ตรวจทานค่าน้ำมัน"
        subtitle={`${rangeText} · ตรวจแล้ว ${done} จาก ${inPhoto.length} รายการ · ไล่ดูทีละรายการเทียบกับรูปบิล`}
        action={
          <Link href={`/fleet/fuel/records?${new URLSearchParams(keep)}`} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
            รายละเอียดน้ำมัน
          </Link>
        }
      />

      <FuelFilters action="/fleet/fuel/audit" from={from} to={to} vehicle={sp.vehicle} receiver={sp.receiver} extra={extra} {...opts} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={link({ st: t.key })}
            className={`rounded-lg px-3 py-1.5 text-sm ${t.key === st ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}
          >
            {t.label} ({count(t.key)})
          </Link>
        ))}
        <Link
          href={photoOnly ? `/fleet/fuel/audit?${new URLSearchParams({ ...keep, st })}` : link({ photo: "1" })}
          className={`ml-auto rounded-lg px-3 py-1.5 text-sm ${photoOnly ? "bg-sky-500/20 text-sky-200" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}
        >
          {photoOnly ? "☑" : "☐"} เฉพาะที่มีรูปบิล
        </Link>
      </div>

      {shown.length ? (
        // Keyed by the filter: a tab or preset is a client navigation, and without a
        // new key the runner would keep its first list (it copies items into state).
        <AuditRunner key={JSON.stringify([from, to, sp.vehicle, sp.receiver, st, photoOnly])} items={shown} vehicles={vehicles} />
      ) : (
        <Card>
          <div className="py-10 text-center text-slate-400">ไม่มีรายการในกลุ่มนี้</div>
        </Card>
      )}
    </div>
  );
}
