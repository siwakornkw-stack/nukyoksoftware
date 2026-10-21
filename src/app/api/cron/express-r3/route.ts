import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { bearerOk } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { opsAlert } from "@/lib/ops-alert";
import { r3QueueWhere } from "@/lib/po/purchase-orders";

export const dynamic = "force-dynamic";

// The office PC's R3 queue (Bearer EXPRESS_SYNC_SECRET, like /api/cron/express-po).
//   GET  -> {"pk": ["PK0000001", ...]}  approved PKs whose R3 it should write now
//   POST {"results":[{"pk","status":"done"|"waiting"|"busy"|"error","docNo"?,"error"?}]}
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.purchaseOrder.findMany({ where: r3QueueWhere, select: { PoNo: true }, orderBy: { PoNo: "asc" }, take: 50 });
  return NextResponse.json({ pk: rows.map((r) => r.PoNo) });
}

const STATUSES = ["done", "waiting", "busy", "error"];

export async function POST(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  const results: unknown[] = Array.isArray(b.results) ? b.results.slice(0, 50) : [];
  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  let applied = 0;
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const pk = str(r.pk, 20), status = str(r.status, 10);
    if (!pk.startsWith("PK") || !STATUSES.includes(status)) continue;
    const row = await prisma.purchaseOrder.findUnique({
      where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: pk } },
      select: { PurchaseOrderId: true, R3DocNo: true, R3Status: true, ApprovalStatus: true },
    });
    if (!row) continue;
    const now = new Date();
    if (status === "done") {
      const docNo = str(r.docNo, 20);
      await prisma.purchaseOrder.update({
        where: { PurchaseOrderId: row.PurchaseOrderId },
        data: { R3DocNo: docNo || row.R3DocNo, R3Status: null, R3Error: null, R3UpdatedAt: now },
      });
      await audit("PurchaseOrder", row.PurchaseOrderId, "r3-created", "express-r3", { PoNo: pk, R3DocNo: row.R3DocNo }, { PoNo: pk, R3DocNo: docNo });
    } else if (status === "waiting") {
      // Only while still approved and queued (an approval taken back meanwhile wins).
      await prisma.purchaseOrder.updateMany({
        where: { PurchaseOrderId: row.PurchaseOrderId, ApprovalStatus: "approved", R3DocNo: null },
        data: { R3Status: "waiting", R3Error: str(r.error) || null, R3UpdatedAt: now },
      });
    } else if (status === "error") {
      const error = str(r.error) || "สร้าง R3 ไม่สำเร็จ";
      await prisma.purchaseOrder.updateMany({
        where: { PurchaseOrderId: row.PurchaseOrderId, ApprovalStatus: "approved", R3DocNo: null },
        data: { R3Status: "error", R3Error: error, R3UpdatedAt: now },
      });
      await opsAlert(`express-r3|${pk}`, `สร้าง R3 ของ ${pk} ใน Express ไม่สำเร็จ`, error);
    }
    // busy: someone was editing creditor 0009 in Express; stays queued for the next run.
    applied++;
  }
  return NextResponse.json({ applied });
}
