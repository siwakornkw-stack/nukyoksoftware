import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const STATUSES = ["ok", "problem", ""];

// { id, status: "ok" | "problem" | "" (clear), note, updatedAt }: the one-by-one
// check at /fleet/fuel/audit. A problem needs a note saying what is wrong.
// updatedAt is the row's UpdatedAt the checker was looking at: an edit since then
// cleared the old check, and marking the new values unseen would undo that.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => null)) ?? {};
  const id = typeof b.id === "string" ? b.id.trim() : "";
  const status = typeof b.status === "string" ? b.status : "";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
  const seen = typeof b.updatedAt === "string" ? b.updatedAt : "";
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "ผลตรวจไม่ถูกต้อง" }, { status: 400 });
  if (status === "problem" && !note) return NextResponse.json({ error: "ใส่หมายเหตุว่ามีปัญหาอะไร" }, { status: 400 });

  const select = { AuditStatus: true, AuditNote: true, AuditedBy: true, AuditedAt: true } as const;
  const row = id
    ? await prisma.gasolineCost.findFirst({
        where: { GasolineCostId: id, Vehicle: { TenantId: DEFAULT_TENANT_ID } },
        select: { ...select, UpdatedAt: true },
      })
    : null;
  if (!row) return NextResponse.json({ error: "ไม่พบรายการน้ำมันนี้" }, { status: 404 });
  if (status && row.UpdatedAt.toISOString() !== seen) {
    return NextResponse.json({ error: "รายการนี้ถูกแก้ไขหลังจากเปิดหน้านี้ กดรีเฟรชหน้าแล้วตรวจค่าใหม่อีกครั้ง" }, { status: 409 });
  }
  const { UpdatedAt: _updatedAt, ...before } = row;

  const after = await prisma.gasolineCost.update({
    where: { GasolineCostId: id },
    data: status
      ? { AuditStatus: status, AuditNote: note || null, AuditedBy: s.username, AuditedAt: new Date() }
      : { AuditStatus: null, AuditNote: null, AuditedBy: null, AuditedAt: null },
    select,
  });
  await audit("record:gasoline", id, "audit", s.username, before, after);
  return NextResponse.json({
    auditStatus: after.AuditStatus,
    auditNote: after.AuditNote ?? "",
    auditedBy: after.AuditedBy ?? "",
    auditedAt: after.AuditedAt?.toISOString() ?? "",
  });
}
