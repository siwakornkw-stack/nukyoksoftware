import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseWorkbook } from "@/lib/debt/parse";
import { addVersion } from "@/lib/debt/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await getSession())) {
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
  return NextResponse.json({ meta });
}
