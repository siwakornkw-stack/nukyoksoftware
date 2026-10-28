import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// { poNo, force? }: put an approved PK whose R3 failed back in the office PC's
// queue (admin). force: the admin checked that a same-amount line already in the
// day's R3 is another bill, so the H3 is added anyway.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const b = (await req.json().catch(() => null)) ?? {};
  const poNo = typeof b.poNo === "string" ? b.poNo.trim() : "";
  const status = b.force === true ? "force" : "queued";
  const row = poNo.startsWith("PK")
    ? await prisma.purchaseOrder.findUnique({
        where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: poNo } },
        select: { PurchaseOrderId: true, ApprovalStatus: true, R3DocNo: true, R3Status: true, R3Error: true },
      })
    : null;
  if (!row) return NextResponse.json({ error: "ไม่พบใบสั่งซื้อนี้" }, { status: 404 });
  if (row.ApprovalStatus !== "approved") return NextResponse.json({ error: "ใบนี้ยังไม่ได้อนุมัติ" }, { status: 400 });
  if (row.R3DocNo) return NextResponse.json({ error: `มี R3 แล้ว (${row.R3DocNo})` }, { status: 400 });
  await prisma.purchaseOrder.update({
    where: { PurchaseOrderId: row.PurchaseOrderId },
    data: { R3Status: status, R3Error: null, R3UpdatedAt: new Date() },
  });
  await audit("PurchaseOrder", row.PurchaseOrderId, "r3-retry", s.username, { PoNo: poNo, R3Status: row.R3Status, R3Error: row.R3Error }, { PoNo: poNo, R3Status: status });
  return NextResponse.json({ ok: true });
}
