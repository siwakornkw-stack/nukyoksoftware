import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseWorkbook } from "@/lib/debt/parse";
import { addVersion } from "@/lib/debt/store";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }
  const buf = await file.arrayBuffer();
  const records = parseWorkbook(buf);
  if (!records.length) {
    return NextResponse.json(
      { error: "อ่านข้อมูลจากไฟล์ไม่ได้ (ไม่พบคอลัมน์ 'เลขที่เอกสาร')" },
      { status: 400 }
    );
  }
  const meta = await addVersion(file.name, records);
  await audit("debt-version", meta.id, "upload", s.username, null, meta);
  return NextResponse.json({ meta });
}
