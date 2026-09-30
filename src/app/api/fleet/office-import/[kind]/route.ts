import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import {
  commitFuel,
  commitInstallments,
  commitInsurance,
  previewFuel,
  previewInstallments,
  previewInsurance,
  type Decision,
} from "@/lib/fleet/office-import";
import { SheetError } from "@/lib/fleet/office-sheets";

export const dynamic = "force-dynamic";

const HANDLERS = {
  fuel: { preview: previewFuel, commit: commitFuel },
  insurance: { preview: previewInsurance, commit: commitInsurance },
  installments: { preview: previewInstallments, commit: commitInstallments },
};

// multipart: file, action=preview|commit, decisions={"<item key>": "new"|"skip"|VehicleId}
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { kind } = await ctx.params;
  const h = HANDLERS[kind as keyof typeof HANDLERS];
  if (!h) return NextResponse.json({ error: "ไม่รู้จักประเภทการนำเข้า" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });

  let wb: XLSX.WorkBook;
  try {
    // cellStyles: the installment sheet marks paid months with a green fill.
    wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellStyles: true });
  } catch {
    return NextResponse.json({ error: "อ่านไฟล์ Excel ไม่ได้" }, { status: 400 });
  }

  try {
    if (form!.get("action") !== "commit") {
      const preview = await h.preview(wb);
      if (!preview.items.length) {
        return NextResponse.json({ error: "ไม่พบข้อมูลตามรูปแบบไฟล์ของออฟฟิศในไฟล์นี้" }, { status: 400 });
      }
      return NextResponse.json(preview);
    }

    let decisions: Record<string, Decision> = {};
    try {
      decisions = JSON.parse(String(form!.get("decisions") || "{}"));
    } catch {
      return NextResponse.json({ error: "ข้อมูลการจับคู่รถไม่ถูกต้อง" }, { status: 400 });
    }
    return NextResponse.json(await h.commit(wb, decisions, s.username, file.name));
  } catch (e) {
    if (e instanceof SheetError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
