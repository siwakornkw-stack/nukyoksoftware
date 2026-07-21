import { NextRequest } from "next/server";
import { get } from "@/lib/storage";
import { getSession } from "@/lib/auth";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Serve files stored on local disk. In production nginx can serve UPLOAD_DIR
// directly for the same paths; this route is the framework-native fallback.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  // Uploaded artifacts (bill photos, payment evidence, CSV reports) are private.
  if (!(await getSession())) return new Response("unauthorized", { status: 401 });

  const { path: parts } = await ctx.params;
  const key = parts.join("/");
  const buf = await get(key);
  if (!buf) return new Response("Not found", { status: 404 });

  const dot = key.lastIndexOf(".");
  const ext = dot >= 0 ? key.slice(dot).toLowerCase() : "";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
