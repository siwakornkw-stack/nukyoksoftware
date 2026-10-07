import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { baht, num, thDate } from "@/lib/format";
import { plateText } from "@/lib/fleet/plates";
import { getRecordType } from "@/lib/fleet/record-types";
import { delegate } from "@/lib/fleet/record-delegates";

export const dynamic = "force-dynamic";

// Deleted per-vehicle records. The record DELETE handler stores the whole row
// as the audit log's Before, so that snapshot is all a restore needs.
const PREFIX = "record:";

type Snapshot = Record<string, unknown>;

function show(type: string, snap: Snapshot): string {
  const def = getRecordType(type)!;
  return def.fields
    .filter((f) => f.type !== "file" && f.type !== "select" && snap[f.name] != null && snap[f.name] !== "")
    .map((f) => {
      const v = snap[f.name];
      const text =
        f.type === "date" ? thDate(String(v)) : f.type === "money" ? baht(Number(v)) : f.type === "decimal" ? num(Number(v), 2) : String(v);
      return `${f.label}: ${text}`;
    })
    .join(" · ");
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  const logs = await prisma.auditLog.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, Action: "delete", Entity: { startsWith: PREFIX } },
    orderBy: { CreatedAt: "desc" },
    take: 300,
  });

  // A record deleted, restored and deleted again has two delete rows; the newest counts.
  const seen = new Set<string>();
  const latest = logs.filter((l) => {
    const k = `${l.Entity}|${l.EntityId}`;
    if (seen.has(k) || !getRecordType(l.Entity.slice(PREFIX.length)) || !l.Before) return false;
    seen.add(k);
    return true;
  });

  // Which of them exist again (already restored).
  const back = new Set<string>();
  const byType = new Map<string, string[]>();
  for (const l of latest) byType.set(l.Entity, [...(byType.get(l.Entity) ?? []), l.EntityId]);
  for (const [entity, ids] of byType) {
    const def = getRecordType(entity.slice(PREFIX.length))!;
    const rows = await delegate(def).findMany({ where: { [def.idField]: { in: ids } } });
    for (const r of rows) back.add(`${entity}|${r[def.idField]}`);
  }

  const vehicleIds = [...new Set(latest.map((l) => String((l.Before as Snapshot).VehicleId ?? "")))];
  const vehicles = await prisma.vehicle.findMany({
    where: { VehicleId: { in: vehicleIds }, TenantId: DEFAULT_TENANT_ID },
    select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true },
  });
  const plate = new Map(vehicles.map((v) => [v.VehicleId, plateText(v)]));

  return NextResponse.json({
    items: latest.map((l) => {
      const type = l.Entity.slice(PREFIX.length);
      const snap = l.Before as Snapshot;
      return {
        auditId: l.AuditLogId,
        label: getRecordType(type)!.label,
        vehicle: plate.get(String(snap.VehicleId ?? "")) ?? "-",
        summary: show(type, snap),
        deletedBy: l.Username,
        deletedAt: l.CreatedAt,
        restored: back.has(`${l.Entity}|${l.EntityId}`),
      };
    }),
  });
}

// { auditId }: re-create the deleted record exactly as it was (same id).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  const b = (await req.json().catch(() => null)) ?? {};
  const auditId = typeof b.auditId === "string" ? b.auditId.trim() : "";
  const log = auditId
    ? await prisma.auditLog.findFirst({ where: { AuditLogId: auditId, TenantId: DEFAULT_TENANT_ID, Action: "delete" } })
    : null;
  const def = log?.Entity.startsWith(PREFIX) ? getRecordType(log.Entity.slice(PREFIX.length)) : undefined;
  const snap = log?.Before as Snapshot | null | undefined;
  if (!log || !def || !snap) return NextResponse.json({ error: "ไม่พบรายการที่ลบ" }, { status: 404 });

  const vehicle = await prisma.vehicle.findFirst({
    where: { VehicleId: String(snap.VehicleId ?? ""), TenantId: DEFAULT_TENANT_ID },
    select: { VehicleId: true },
  });
  if (!vehicle) return NextResponse.json({ error: "ไม่พบรถของรายการนี้" }, { status: 400 });

  // Re-importing the office file after the delete brings the same row back
  // under a new id; restoring the old one too would count it twice.
  if (typeof snap.ImportKey === "string" && snap.ImportKey) {
    const again = await delegate(def).findMany({ where: { ImportKey: snap.ImportKey } });
    if (again.length) {
      return NextResponse.json({ error: "กู้คืนไม่ได้ รายการเดียวกันถูกนำเข้าจากไฟล์ใหม่แล้ว" }, { status: 400 });
    }
  }

  let row: Record<string, unknown>;
  try {
    row = await delegate(def).create({ data: snap });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "กู้คืนไม่ได้ รายการนี้มีอยู่แล้ว" }, { status: 400 });
    }
    // P2003: a dropdown value (repair shop, payment status, ...) was deleted since.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "กู้คืนไม่ได้ ข้อมูลหลักที่รายการนี้อ้างถึงถูกลบไปแล้ว" }, { status: 400 });
    }
    throw e;
  }
  await audit(log.Entity, log.EntityId, "restore", s.username, null, row);
  return NextResponse.json({ ok: true });
}
