import { NextResponse } from "next/server";
import { bearerOk } from "@/lib/cron-auth";
import { opsAlert } from "@/lib/ops-alert";
import { bkkDateTime, checkCompany, finishSync, poSchema, syncStale, upsertPurchaseOrders, type PoData } from "@/lib/po/purchase-orders";

export const dynamic = "force-dynamic";

// Pushed by scripts/express-po-sync.mjs on the office PC (Bearer
// EXPRESS_SYNC_SECRET). Under /api/cron so the login gate lets it through.
// Every body carries "company" (Express ISINFO), checked against the stored one.
//   {"company":{...},"purchaseOrders":[...]}  a batch of new/changed POs
//   {"company":{...},"allPoNos":[...]}        last call of a run
export async function POST(req: Request) {
  if (!bearerOk(req, process.env.EXPRESS_SYNC_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) ?? {};
  const wrongCompany = await checkCompany(b.company);
  if (wrongCompany) {
    await opsAlert("express-po-company", "ดึง PO จาก Express ไม่สำเร็จ", wrongCompany);
    return NextResponse.json({ error: wrongCompany }, { status: 409 });
  }

  if (Array.isArray(b.purchaseOrders)) {
    if (b.purchaseOrders.length > 1000) return NextResponse.json({ error: "ส่งครั้งละไม่เกิน 1000 ใบ" }, { status: 400 });
    const list: PoData[] = [];
    for (const raw of b.purchaseOrders) {
      const p = poSchema.safeParse(raw);
      if (!p.success) {
        const no = typeof raw?.poNo === "string" ? raw.poNo : "?";
        return NextResponse.json({ error: `PO ${no}: ${p.error.issues[0]?.path.join(".")} ${p.error.issues[0]?.message}` }, { status: 400 });
      }
      list.push(p.data);
    }
    return NextResponse.json(await upsertPurchaseOrders(list));
  }

  if (Array.isArray(b.allPoNos)) {
    const nos = b.allPoNos.filter((v: unknown): v is string => typeof v === "string" && v.length <= 20);
    const r = await finishSync(nos, b.company);
    if ("error" in r) {
      await opsAlert("express-po-missing", "ดึง PO จาก Express ผิดปกติ", r.error);
      return NextResponse.json(r, { status: 409 });
    }
    return NextResponse.json(r);
  }

  return NextResponse.json({ error: "unknown body" }, { status: 400 });
}

// Hourly from the cron worker (Bearer CRON_SECRET), office hours: alert when the
// office PC has not synced for an hour (off, logged out, or failing).
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const s = await syncStale();
  if (s.stale) {
    await opsAlert(
      "express-po-stale",
      "ไม่ได้ดึง PO จาก Express เกิน 1 ชั่วโมง",
      `ดึงล่าสุด ${s.at ? bkkDateTime(s.at) : "ไม่เคย"}: ตรวจว่าเครื่อง DESKTOP-CU6S8MI เปิดอยู่และล็อกอิน Windows ไว้ (ดู var\\express-po-sync.log)`
    );
  }
  return NextResponse.json(s);
}
