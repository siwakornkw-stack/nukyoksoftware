import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Edit an asset's details, or retire / reinstate it (Inactive).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const asset = await prisma.asset.findFirst({
    where: { AssetId: id, TenantId: DEFAULT_TENANT_ID },
    include: { Loans: { where: { ReturnedAt: null }, take: 1 } },
  });
  if (!asset) return NextResponse.json({ error: "ไม่พบสินทรัพย์นี้" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const data: Record<string, string | boolean | null> = { UpdatedByUsername: session.username };

  for (const [key, col, required] of [
    ["name", "Name", true],
    ["category", "Category", true],
    ["code", "Code", false],
    ["defaultLocation", "DefaultLocation", false],
    ["note", "Note", false],
  ] as const) {
    if (!(key in b)) continue;
    const v = str(b[key]);
    if (required && !v) return NextResponse.json({ error: key === "name" ? "ต้องระบุชื่อสินทรัพย์" : "ต้องระบุหมวดหมู่" }, { status: 400 });
    data[col] = v || null;
  }
  if ("inactive" in b) {
    if (typeof b.inactive !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    if (b.inactive && asset.Loans.length) {
      return NextResponse.json({ error: "สินทรัพย์นี้ถูกยืมอยู่ ต้องคืนก่อนปลดระวาง" }, { status: 400 });
    }
    data.Inactive = b.inactive;
  }

  await prisma.asset.update({ where: { AssetId: id }, data: { ...data, UpdatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
