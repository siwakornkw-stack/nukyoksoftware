import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// { id }: put a fuel bill whose PK/H3 failed in Express back in the office PC's
// queue (admin only). Safe to repeat: the writer reports a bill Express already
// has instead of writing it twice.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const b = (await req.json().catch(() => null)) ?? {};
  const id = typeof b.id === "string" ? b.id.trim().slice(0, 36) : "";
  const row = id ? await prisma.expressFuelOrder.findFirst({ where: { ExpressFuelOrderId: id, TenantId: DEFAULT_TENANT_ID } }) : null;
  if (!row) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  // The stage that failed: no PK yet -> the PK; else the H3, if the PK is (still) approved.
  let next = "queued";
  if (row.PkNo) {
    const po = await prisma.purchaseOrder.findUnique({ where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: row.PkNo } }, select: { ApprovalStatus: true } });
    next = po?.ApprovalStatus === "approved" ? "h3" : "pk";
  }
  const { count } = await prisma.expressFuelOrder.updateMany({ where: { ExpressFuelOrderId: id, Status: "error" }, data: { Status: next, Error: null } });
  if (!count) return NextResponse.json({ error: "รายการนี้ไม่ได้อยู่ในสถานะไม่สำเร็จ" }, { status: 400 });
  await audit("ExpressFuelOrder", id, "retry", s.username, { Status: row.Status, Error: row.Error }, { Status: next });
  return NextResponse.json({ ok: true });
}
