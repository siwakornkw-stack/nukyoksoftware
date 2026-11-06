import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { del } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { preparePoFile, storePoFile, toPoFile } from "@/lib/po/files";

export const dynamic = "force-dynamic";

// Bills / quotations attached to a PO for the approver (Express is not touched).
// Request bodies through the proxy stop at 10 MB.
const MAX_BYTES = 10 * 1024 * 1024;

// multipart: poNo, file (one photo or PDF)
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const poNo = form?.get("poNo");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
  const po =
    typeof poNo === "string" && poNo.trim()
      ? await prisma.purchaseOrder.findUnique({
          where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: poNo.trim() } },
          select: { PurchaseOrderId: true, PoNo: true },
        })
      : null;
  if (!po) return NextResponse.json({ error: "ไม่พบใบสั่งซื้อนี้" }, { status: 404 });

  const prepared = await preparePoFile(Buffer.from(await file.arrayBuffer()));
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: 400 });
  const { url } = await storePoFile(prepared.ext, prepared.buf);
  const row = await prisma.purchaseOrderFile.create({
    data: { PurchaseOrderId: po.PurchaseOrderId, FileName: file.name.slice(0, 200) || "bill", Url: url, CreatedByUsername: s.username },
  });
  await audit("po-file", row.PurchaseOrderFileId, "create", s.username, null, { PoNo: po.PoNo, name: row.FileName, url });
  return NextResponse.json({ file: toPoFile(row) }, { status: 201 });
}

// ?id=  (admin; removes the stored file too)
export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบที่ลบไฟล์แนบได้" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const row = id
    ? await prisma.purchaseOrderFile.findFirst({
        where: { PurchaseOrderFileId: id, PurchaseOrder: { TenantId: DEFAULT_TENANT_ID } },
        include: { PurchaseOrder: { select: { PoNo: true } } },
      })
    : null;
  if (!row) return NextResponse.json({ error: "ไม่พบไฟล์นี้" }, { status: 404 });
  await prisma.purchaseOrderFile.delete({ where: { PurchaseOrderFileId: id } });
  await del(row.Url.replace(/^\/uploads\//, ""));
  const { PurchaseOrder, ...before } = row;
  await audit("po-file", id, "delete", s.username, { PoNo: PurchaseOrder.PoNo, ...before }, null);
  return NextResponse.json({ ok: true });
}
