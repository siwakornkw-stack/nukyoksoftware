import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { queuePayment } from "@/lib/po/pz";

export const dynamic = "force-dynamic";

// { poNo, slipUrl, amount, date, payType, ref }: queue the PZ that pays a PK's
// R3 from its transfer slip (or retry a failed one). Admin only. The office PC
// writes it into Express (EXPRESS_PZ_MODE) within a minute or two.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบที่บันทึกการจ่ายได้" }, { status: 403 });

  const b = (await req.json().catch(() => null)) ?? {};
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const r = await queuePayment(
    {
      poNo: str(b.poNo, 20),
      slipUrl: str(b.slipUrl, 200),
      amount: Number(b.amount) || 0,
      date: str(b.date, 10),
      payType: str(b.payType, 2),
      ref: str(b.ref, 40).replace(/\s+/g, ""),
    },
    s.username
  );
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
