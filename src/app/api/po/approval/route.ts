import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { isPk } from "@/lib/po/purchase-orders";

export const dynamic = "force-dynamic";

const STATUSES = ["approved", "rejected", ""];

// { poNo, status: "approved" | "rejected" | "" (back to pending), note, hash }.
// Admin only. Only our copy changes; Express is never written to. hash is the
// ContentHash the approver was looking at: if a sync changed the PO since, the
// decision would be about old figures, so it is refused.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบที่อนุมัติใบสั่งซื้อได้" }, { status: 403 });

  const b = (await req.json().catch(() => null)) ?? {};
  const poNo = typeof b.poNo === "string" ? b.poNo.trim() : "";
  const status = typeof b.status === "string" ? b.status : "";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
  const hash = typeof b.hash === "string" ? b.hash : "";
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  if (status === "rejected" && !note) return NextResponse.json({ error: "ใส่เหตุผลที่ไม่อนุมัติ" }, { status: 400 });

  const select = { ApprovalStatus: true, ApprovalNote: true, ApprovedBy: true, ApprovedAt: true } as const;
  const row = poNo
    ? await prisma.purchaseOrder.findUnique({
        where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: poNo } },
        select: { ...select, PurchaseOrderId: true, ContentHash: true, DocStat: true },
      })
    : null;
  if (!row) return NextResponse.json({ error: "ไม่พบใบสั่งซื้อนี้" }, { status: 404 });
  if (status === "approved" && row.DocStat === "C") return NextResponse.json({ error: "ใบสั่งซื้อนี้ถูกยกเลิกใน Express แล้ว" }, { status: 400 });

  const stale = "ใบสั่งซื้อนี้ถูกแก้ไขใน Express หลังจากเปิดหน้านี้ กดรีเฟรชแล้วตรวจอีกครั้ง";
  if (status && row.ContentHash !== hash) return NextResponse.json({ error: stale }, { status: 409 });
  const { PurchaseOrderId, ContentHash, ...before } = row;

  // Conditional on the hash, so a sync landing between the check and this write
  // is not approved by mistake.
  // PK: approving queues its R3 for the office PC (unless Express already has
  // one); rejecting or taking the approval back drops it from the queue. An R3
  // already written stays in Express: undoing it is the office's call.
  const r3 = isPk(poNo)
    ? status === "approved"
      ? { R3Status: "queued", R3Error: null, R3UpdatedAt: new Date() }
      : { R3Status: null, R3Error: null, R3UpdatedAt: new Date() }
    : {};
  const { count } = await prisma.purchaseOrder.updateMany({
    where: { PurchaseOrderId, ...(status ? { ContentHash } : {}) },
    data: status
      ? { ApprovalStatus: status, ApprovalNote: note || null, ApprovedBy: s.username, ApprovedAt: new Date(), ...r3 }
      : { ApprovalStatus: null, ApprovalNote: null, ApprovedBy: null, ApprovedAt: null, ...r3 },
  });
  if (!count) return NextResponse.json({ error: stale }, { status: 409 });
  // A PK opened from a fuel bill on the web: approving sends its H3 to the
  // office PC (the R3 then takes it in); taking the approval back before the
  // H3 is written holds it again. A written H3 stays: undoing it is the office's call.
  if (isPk(poNo) && status === "approved") {
    await prisma.expressFuelOrder.updateMany({ where: { TenantId: DEFAULT_TENANT_ID, PkNo: poNo, Status: "pk", WithH3: true }, data: { Status: "h3", Error: null } });
  } else if (isPk(poNo)) {
    await prisma.expressFuelOrder.updateMany({ where: { TenantId: DEFAULT_TENANT_ID, PkNo: poNo, Status: "h3" }, data: { Status: "pk" } });
  }

  const after = (await prisma.purchaseOrder.findUnique({ where: { PurchaseOrderId }, select }))!;
  await audit("PurchaseOrder", PurchaseOrderId, status ? status : "unapprove", s.username, { PoNo: poNo, ...before }, { PoNo: poNo, ...after });
  return NextResponse.json({
    approvalStatus: after.ApprovalStatus,
    approvalNote: after.ApprovalNote ?? "",
    approvedBy: after.ApprovedBy ?? "",
    approvedAt: after.ApprovedAt?.toISOString() ?? "",
  });
}
