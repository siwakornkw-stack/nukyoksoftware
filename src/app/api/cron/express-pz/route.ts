import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { bearerOk } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";

// The office PC's side of paying PK R3s from transfer slips (Bearer EXPRESS_SYNC_SECRET).
//   GET  -> {"payments":[...]}  slips queued for a PZ in Express
//   POST {"results":[{"id","status":"done"|"busy"|"error","pzNo"?,"error"?}]}
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.pkPayment.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, Status: "queued" },
    orderBy: { CreatedAt: "asc" },
    take: 10,
    include: { PurchaseOrder: { select: { PoNo: true } } },
  });
  return NextResponse.json({
    payments: rows.map((r) => ({
      id: r.PkPaymentId,
      pkNo: r.PurchaseOrder.PoNo,
      r3No: r.R3DocNo,
      date: r.PayDate.toISOString().slice(0, 10),
      amount: Number(r.Amount),
      payType: r.PayType,
      ref: r.BankRef ?? "",
      by: r.RequestedBy,
    })),
  });
}

const STATUSES = ["done", "busy", "error"];

export async function POST(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const results: unknown[] = Array.isArray(b.results) ? b.results.slice(0, 50) : [];
  let applied = 0;
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = str(r.id, 36), status = str(r.status, 10);
    if (!id || !STATUSES.includes(status)) continue;
    const row = await prisma.pkPayment.findFirst({
      where: { PkPaymentId: id, TenantId: DEFAULT_TENANT_ID, Status: "queued" },
      include: { PurchaseOrder: { select: { PoNo: true } } },
    });
    if (!row) continue;
    if (status === "done") {
      const data = { Status: "done", PzNo: str(r.pzNo, 12) || null, Error: null };
      await prisma.pkPayment.update({ where: { PkPaymentId: id }, data });
      await audit("PkPayment", id, "express-written", "express-pz", { Status: row.Status }, data);
    } else if (status === "error") {
      const error = str(r.error) || "เปิด PZ ใน Express ไม่สำเร็จ";
      await prisma.pkPayment.update({ where: { PkPaymentId: id }, data: { Status: "error", Error: error } });
      await opsAlert(`express-pz|${id}`, "เปิด PZ (จ่ายคืนค่าน้ำมัน) ใน Express ไม่สำเร็จ", `${row.PurchaseOrder.PoNo} / ${row.R3DocNo}: ${error}`);
    }
    // busy: someone was editing the R3 or creditor 0009 in Express; stays queued.
    applied++;
  }
  return NextResponse.json({ applied });
}
