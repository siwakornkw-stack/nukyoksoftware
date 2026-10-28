import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { bearerOk } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { opsAlert } from "@/lib/ops-alert";
import { saveFuelMasters } from "@/lib/fleet/express-fuel";

export const dynamic = "force-dynamic";

// The office PC's side of booking fuel bills in Express (Bearer EXPRESS_SYNC_SECRET).
//   GET  -> {"orders":[...]}  bills whose PK (stage "pk") or, once the PK is
//           approved, whose H3 (stage "h3", with its pkNo) is to be written
//   POST {"masters":{suppliers, items, writer}}   fuel master data read from Express
//   POST {"results":[{"id","status":"done"|"busy"|"error","pkNo"?,"h3No"?,"error"?}]}
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.expressFuelOrder.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, Status: { in: ["queued", "h3"] } },
    orderBy: { CreatedAt: "asc" },
    take: 10, // a few seconds each; the rest go next minute, well inside the task's 5-minute limit
  });
  return NextResponse.json({
    orders: rows.map((r) => ({
      id: r.ExpressFuelOrderId,
      stage: r.Status === "h3" ? "h3" : "pk",
      pkNo: r.PkNo ?? "",
      withH3: r.WithH3,
      supplier: r.SupplierCode,
      item: r.ItemCode,
      dep: r.DepCode,
      date: r.Date.toISOString().slice(0, 10),
      invoice: r.Invoice,
      liters: Number(r.Liters),
      price: Number(r.Price),
      amount: Number(r.Amount),
      by: r.RequestedBy,
    })),
  });
}

const STATUSES = ["done", "busy", "error"];

export async function POST(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  if (b.masters) return NextResponse.json({ saved: await saveFuelMasters(b.masters) });

  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const results: unknown[] = Array.isArray(b.results) ? b.results.slice(0, 50) : [];
  let applied = 0;
  for (const raw of results) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = str(r.id, 36), status = str(r.status, 10);
    if (!id || !STATUSES.includes(status)) continue;
    const row = await prisma.expressFuelOrder.findFirst({ where: { ExpressFuelOrderId: id, TenantId: DEFAULT_TENANT_ID, Status: { in: ["queued", "h3"] } } });
    if (!row) continue;
    if (status === "done") {
      const pkNo = str(r.pkNo, 12) || row.PkNo, h3No = str(r.h3No, 12) || null;
      // The PK stage ends at "pk" (waiting for approval) unless the bill needs no
      // H3 from us, or Express already had one for this invoice.
      const next = row.Status === "queued" && row.WithH3 && !h3No ? "pk" : "done";
      const data = { Status: next, PkNo: pkNo || null, H3No: h3No ?? row.H3No, Error: str(r.error) || null };
      await prisma.expressFuelOrder.update({ where: { ExpressFuelOrderId: id }, data });
      await audit("ExpressFuelOrder", id, "express-written", "express-fuel", { Status: row.Status }, data);
      // Approved already (the PK was approved before this answer came back): on to the H3.
      if (next === "pk" && pkNo) {
        const po = await prisma.purchaseOrder.findUnique({ where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: pkNo } }, select: { ApprovalStatus: true } });
        if (po?.ApprovalStatus === "approved") await prisma.expressFuelOrder.update({ where: { ExpressFuelOrderId: id }, data: { Status: "h3" } });
      }
    } else if (status === "error") {
      const error = str(r.error) || "เปิดใน Express ไม่สำเร็จ";
      await prisma.expressFuelOrder.update({ where: { ExpressFuelOrderId: id }, data: { Status: "error", Error: error } });
      await opsAlert(`express-fuel|${id}`, `เปิด ${row.Status === "h3" ? "H3" : "PK"} ของบิลน้ำมันใน Express ไม่สำเร็จ`, `${row.PkNo ?? row.Invoice}: ${error}`);
    }
    // busy: someone was editing a row the write needs in Express; stays queued.
    applied++;
  }
  return NextResponse.json({ applied });
}
