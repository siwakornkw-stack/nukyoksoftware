import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { commitIncome, previewIncome, type IncomeFile } from "@/lib/fleet/income-import";
import { SheetError } from "@/lib/fleet/office-sheets";

export const dynamic = "force-dynamic";

// multipart: file (one or more), action=preview|commit
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const uploads = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (!uploads.length) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });

  const files: IncomeFile[] = [];
  for (const f of uploads) {
    try {
      files.push({ name: f.name, wb: XLSX.read(await f.arrayBuffer(), { type: "array" }) });
    } catch {
      return NextResponse.json({ error: `อ่านไฟล์ Excel ไม่ได้: ${f.name}` }, { status: 400 });
    }
  }

  try {
    if (form!.get("action") !== "commit") {
      const sheets = await previewIncome(files);
      if (!sheets.length) return NextResponse.json({ error: "ไม่พบข้อมูลตามรูปแบบไฟล์รายรับในไฟล์นี้" }, { status: 400 });
      return NextResponse.json({ sheets });
    }
    return NextResponse.json(await commitIncome(files, s.username));
  } catch (e) {
    if (e instanceof SheetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
