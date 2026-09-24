import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { put, del } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Documents (registration book, policy PDFs, ...) and photos of one vehicle.
// Files are private: served through /uploads, which requires a session.
// Next buffers request bodies through the proxy up to proxyClientMaxBodySize
// (10 MB by default); anything larger arrives cut off.
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];
const DOC_EXT = ["pdf", "xlsx", "xls", "docx", "doc", "csv", ...IMAGE_EXT];

const owned = async (id: string) =>
  !!(await prisma.vehicle.findFirst({ where: { VehicleId: id, TenantId: DEFAULT_TENANT_ID }, select: { VehicleId: true } }));

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await owned(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [files, images] = await Promise.all([
    prisma.attachFileVehicle.findMany({ where: { VehicleId: id }, orderBy: { CreatedAt: "desc" } }),
    prisma.imageVehicle.findMany({ where: { VehicleId: id }, orderBy: { CreatedAt: "desc" } }),
  ]);
  return NextResponse.json({ files, images });
}

// multipart: file, kind=file|image, description
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await owned(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
  const kind = form!.get("kind") === "image" ? "image" : "file";
  const ext = (file.name.includes(".") ? file.name.split(".").pop()! : "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!(kind === "image" ? IMAGE_EXT : DOC_EXT).includes(ext)) {
    return NextResponse.json({ error: `ไม่รองรับไฟล์ .${ext || "?"}` }, { status: 400 });
  }
  const description = String(form!.get("description") ?? "").trim().slice(0, 300);
  const { url } = await put(`fleet/${id}/${kind}s/${randomUUID()}.${ext}`, Buffer.from(await file.arrayBuffer()));

  const base = { Status: "active", Url: url, Description: description, VehicleId: id, CreatedByUsername: s.username };
  const row =
    kind === "image"
      ? await prisma.imageVehicle.create({ data: { ...base, Title: file.name.slice(0, 200) } })
      : await prisma.attachFileVehicle.create({ data: { ...base, FileName: file.name.slice(0, 200) } });
  await audit(`vehicle-${kind}`, "ImageVehicleId" in row ? row.ImageVehicleId : row.AttachFileVehicleId, "create", s.username, null, { VehicleId: id, name: file.name, url });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// ?kind=file|image&fileId=  (admin; removes the stored file too)
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const fileId = q.get("fileId") ?? "";
  const row =
    q.get("kind") === "image"
      ? await prisma.imageVehicle.findFirst({ where: { ImageVehicleId: fileId, VehicleId: id, Vehicle: { TenantId: DEFAULT_TENANT_ID } } })
      : await prisma.attachFileVehicle.findFirst({ where: { AttachFileVehicleId: fileId, VehicleId: id, Vehicle: { TenantId: DEFAULT_TENANT_ID } } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ("ImageVehicleId" in row) await prisma.imageVehicle.delete({ where: { ImageVehicleId: fileId } });
  else await prisma.attachFileVehicle.delete({ where: { AttachFileVehicleId: fileId } });
  await del(row.Url.replace(/^\/uploads\//, ""));
  await audit(`vehicle-${"ImageVehicleId" in row ? "image" : "file"}`, fileId, "delete", s.username, row, null);
  return NextResponse.json({ ok: true });
}
