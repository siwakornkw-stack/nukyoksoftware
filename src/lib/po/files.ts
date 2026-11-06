import sharp from "sharp";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { put } from "@/lib/storage";

// Bills / quotations attached to a PO on the web (/po, /po/<no>). Express is not touched.

export interface PoFile {
  id: string;
  name: string;
  url: string;
  pdf: boolean;
  by: string;
  at: string;
}

const PHOTO_FORMATS = ["jpeg", "png", "webp"];
export const PO_FILE_ERROR = "รองรับเฉพาะรูปภาพ (JPG, PNG, WEBP) หรือ PDF";

// Photos are turned upright, cut to at most 2000 px and saved as JPEG like the
// fuel bill photos (about 300 KB, and nothing but pixels survives); a PDF is kept
// as it is. Anything else (SVG, HEIC, office files, ...) is refused.
export async function preparePoFile(data: Buffer): Promise<{ ext: "jpg" | "pdf"; buf: Buffer } | { error: string }> {
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") return { ext: "pdf", buf: data };
  const meta = await sharp(data).metadata().catch(() => null);
  if (!meta?.format || !PHOTO_FORMATS.includes(meta.format)) return { error: PO_FILE_ERROR };
  const buf = await sharp(data)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
    .catch(() => null);
  return buf ? { ext: "jpg", buf } : { error: PO_FILE_ERROR };
}

export async function storePoFile(ext: "jpg" | "pdf", buf: Buffer) {
  return put(`po-bills/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`, buf);
}

export function toPoFile(f: { PurchaseOrderFileId: string; FileName: string; Url: string; CreatedByUsername: string; CreatedAt: Date }): PoFile {
  return { id: f.PurchaseOrderFileId, name: f.FileName, url: f.Url, pdf: f.Url.endsWith(".pdf"), by: f.CreatedByUsername, at: f.CreatedAt.toISOString() };
}

export async function poFiles(poNo: string): Promise<PoFile[]> {
  const rows = await prisma.purchaseOrderFile.findMany({
    where: { PurchaseOrder: { TenantId: DEFAULT_TENANT_ID, PoNo: poNo } },
    orderBy: { CreatedAt: "asc" },
  });
  return rows.map(toPoFile);
}
