import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { readError } from "@/lib/fuel/read-error";
import { getFuelMasters } from "@/lib/fleet/express-fuel";
import { readSlip, storeSlip } from "@/lib/po/pz";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

// multipart file=<transfer slip: an image or a PDF>: store it and read it.
// Admin only. Nothing is queued here: POST /api/po/pz does that after the
// admin has checked the figures.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบที่บันทึกการจ่ายได้" }, { status: 403 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "ไม่พบไฟล์สลิป" }, { status: 400 });

  let slip: Awaited<ReturnType<typeof storeSlip>>;
  try {
    slip = await storeSlip(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "เปิดไฟล์ไม่ได้ ใช้รูป JPG / PNG หรือไฟล์ PDF" }, { status: 400 });
  }
  const masters = await getFuelMasters();
  try {
    return NextResponse.json({ slipUrl: slip.url, readError: null, ...(await readSlip(slip.buf, slip.mediaType, masters?.banks ?? [])) });
  } catch (e) {
    return NextResponse.json({ slipUrl: slip.url, readError: await readError(e, "transfer slip") });
  }
}
