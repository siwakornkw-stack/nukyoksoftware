import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { opsAlert } from "@/lib/ops-alert";
import { commitBills, parseRows, readBill, vehicleList } from "@/lib/fleet/fuel-bills";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

// Vehicles for the "บันทึกเข้ารถ" dropdown.
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ vehicles: await vehicleList() });
}

// multipart file=<one bill photo>: read it, nothing is saved.
// JSON { rows: [...] }: save the checked rows.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const b = (await req.json().catch(() => null)) ?? {};
    const parsed = parseRows(b.rows);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const r = await commitBills(parsed.rows, s.username);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "รูปใหญ่เกิน 10 MB" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "ไม่พบรูป" }, { status: 400 });

  try {
    return NextResponse.json(await readBill(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    console.error("fuel bill read failed:", msg);
    // A rejected or missing key fails every photo; a retry or a better photo will not help.
    if (/ (400|401|403):/.test(msg) || !process.env.GEMINI_API_KEY?.trim()) {
      await opsAlert("gemini-key", "อ่านบิลน้ำมันไม่ได้", `Gemini ปฏิเสธคีย์ (GEMINI_API_KEY): ${msg.slice(0, 300)}`);
      return NextResponse.json({ error: "ระบบอ่านบิลใช้งานไม่ได้ตอนนี้ (คีย์ Gemini) แจ้งผู้ดูแลระบบแล้ว" }, { status: 503 });
    }
    return NextResponse.json({ error: "อ่านบิลไม่สำเร็จ ลองใหม่อีกครั้ง หรือถ่ายรูปให้ชัดขึ้น" }, { status: 502 });
  }
}
