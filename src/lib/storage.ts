import { promises as fs } from "fs";
import path from "path";

// Local-filesystem storage (VPS). Replaces Vercel Blob from the source projects.
// Keys are "/"-separated logical paths, e.g. "fuel/2026-07/<uuid>.jpg".
// Files are served back through the /uploads/[...path] route (or nginx).

const ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "var", "uploads");

function resolveKey(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  const abs = path.resolve(ROOT, normalized);
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("invalid storage key: " + key);
  }
  return abs;
}

export function publicUrl(key: string): string {
  return "/uploads/" + key.replace(/^\/+/, "");
}

export async function put(
  key: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const dest = resolveKey(key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data);
  return { key, url: publicUrl(key) };
}

export async function get(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function del(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key));
  } catch {
    // already gone
  }
}
