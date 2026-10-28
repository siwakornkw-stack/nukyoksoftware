import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { bearerOk } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { opsAlert } from "@/lib/ops-alert";
import { saveFuelMasters } from "@/lib/fleet/express-fuel";

export const dynamic = "force-dynamic";

// The office PC's side of booking fuel bills in Express (Bearer EXPRESS_SYNC_SECRET).
//   GET  -> {"orders":[...]}  bills queued for a PK (+ H3) in Express
//   POST {"masters":{suppliers, items}}   fuel master data read from Express
//   POST {"results":[{"id","status":"done"|"busy"|"error","pkNo"?,"h3No"?,"error"?}]}
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.expressFuelOrder.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, Status: "queued" },
    orderBy: { CreatedAt: "asc" },
    take: 10, // a few seconds each; the rest go next minute, well inside the task's 5-minute limit
  });
  return NextResponse.json({
    orders: rows.map((r) => ({
      id: r.ExpressFuelOrderId,
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
    const row = await prisma.expressFuelOrder.findFirst({ where: { ExpressFuelOrderId: id, TenantId: DEFAULT_TENANT_ID, Status: "queued" } });
    if (!row) continue;
    if (status === "done") {
      const data = { Status: "done", PkNo: str(r.pkNo, 12) || null, H3No: str(r.h3No, 12) || null, Error: str(r.error) || null };
      await prisma.expressFuelOrder.update({ where: { ExpressFuelOrderId: id }, data });
      await audit("ExpressFuelOrder", id, "express-written", "express-fuel", { Status: row.Status }, data);
    } else if (status === "error") {
      const error = str(r.error) || "เปิดใน Express ไม่สำเร็จ";
      await prisma.expressFuelOrder.update({ where: { ExpressFuelOrderId: id }, data: { Status: "error", Error: error } });
      await opsAlert(`express-fuel|${id}`, "เปิด PK/H3 ของบิลน้ำมันใน Express ไม่สำเร็จ", `${row.Invoice}: ${error}`);
    }
    // busy: someone was editing a row the write needs in Express; stays queued.
    applied++;
  }
  return NextResponse.json({ applied });
}
