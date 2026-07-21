import sharp from "sharp";
import crypto from "crypto";
import { put } from "@/lib/storage";

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Re-encode/resize the LINE image so stored evidence stays small.
export async function compressImage(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
}

export async function storeBillImage(buf: Buffer, ym: string): Promise<{ url: string }> {
  const id = crypto.randomUUID();
  return put(`fuel/${ym}/${id}.jpg`, buf);
}
