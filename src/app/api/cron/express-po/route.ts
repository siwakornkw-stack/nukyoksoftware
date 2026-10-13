import { NextResponse } from "next/server";
import { finishSync, poSchema, upsertPurchaseOrders, type PoData } from "@/lib/po/purchase-orders";

export const dynamic = "force-dynamic";

// Pushed by scripts/express-po-sync.mjs on the office PC (Bearer
// EXPRESS_SYNC_SECRET). Under /api/cron so the login gate lets it through.
//   {"purchaseOrders":[...]}            a batch of new/changed POs
//   {"allPoNos":[...],"company":{...}}  last call of a run
export async function POST(req: Request) {
  const secret = process.env.EXPRESS_SYNC_SECRET || "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) ?? {};

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
    return NextResponse.json(await finishSync(nos, b.company));
  }

  return NextResponse.json({ error: "unknown body" }, { status: 400 });
}
