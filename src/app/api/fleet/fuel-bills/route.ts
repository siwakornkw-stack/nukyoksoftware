import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { opsAlert } from "@/lib/ops-alert";
import { commitBills, expressChoices, lastOdo, parseRows, readBill, readOdometer, storeBillPhoto, storeOdometerPhoto, vehicleList } from "@/lib/fleet/fuel-bills";
import { recentOrders } from "@/lib/fleet/express-fuel";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

// No query: vehicles for the "บันทึกเข้ารถ" dropdown, the Express choices
// (suppliers / vehicle items, null until the office PC has sent them) and the
// latest bills sent to Express with their state.
// ?odo=<VehicleId>&date=YYYY-MM-DD: mileage the next fill-up starts from.
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const vid = q.get("odo");
  if (vid) return NextResponse.json({ lastOdo: await lastOdo(vid, q.get("date") ?? "") });
  const [vehicles, express, orders] = await Promise.all([vehicleList(), expressChoices(), recentOrders()]);
  return NextResponse.json({ vehicles, express, orders });
}

// Why the reader failed, in words that tell staff what to do next.
async function readError(e: unknown): Promise<string> {
  const msg = (e as Error)?.message ?? "";
  console.error("fuel bill read failed:", msg);
  // A rejected or missing key fails every photo; a retry or a better photo will not help.
  if (/ (400|401|403):/.test(msg) || !process.env.GEMINI_API_KEY?.trim()) {
    await opsAlert("gemini-key", "อ่านบิลน้ำมันไม่ได้", `Gemini ปฏิเสธคีย์ (GEMINI_API_KEY): ${msg.slice(0, 300)}`);
    return "ระบบอ่านรูปใช้งานไม่ได้ตอนนี้ (คีย์ Gemini แจ้งผู้ดูแลระบบแล้ว) กรอกเองจากรูปได้";
  }
  if (/ 429:/.test(msg)) return "โควต้า AI อ่านรูปของวันนี้หมดแล้ว กรอกเองจากรูปได้";
  return "AI อ่านรูปไม่สำเร็จ กรอกเองจากรูปได้";
}

// multipart file=<one bill photo>: store the photo and read it. No fuel row is saved.
// multipart file=<odometer photo> + kind=odometer: store it and read the mileage.
// JSON { rows: [...] }: save the checked rows (and queue the Express ones).
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
  const odometer = form?.get("kind") === "odometer";

  let photo: { buf: Buffer; url: string };
  try {
    const image = Buffer.from(await file.arrayBuffer());
    photo = odometer ? await storeOdometerPhoto(image) : await storeBillPhoto(image);
  } catch {
    return NextResponse.json({ error: "เปิดไฟล์รูปไม่ได้ ใช้รูป JPG หรือ PNG" }, { status: 400 });
  }

  if (odometer) {
    try {
      return NextResponse.json({ odoUrl: photo.url, readError: null, ...(await readOdometer(photo.buf)) });
    } catch (e) {
      return NextResponse.json({ odoUrl: photo.url, readError: await readError(e) });
    }
  }
  try {
    return NextResponse.json({ billUrl: photo.url, readError: null, ...(await readBill(photo.buf)) });
  } catch (e) {
    return NextResponse.json({ billUrl: photo.url, readError: await readError(e) });
  }
}
