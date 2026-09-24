import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const assets = await prisma.asset.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    include: {
      Loans: {
        where: { ReturnedAt: null },
        orderBy: { BorrowedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { Name: "asc" },
  });
  return NextResponse.json({ assets });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(b.name);
  const category = str(b.category);
  if (!name) return NextResponse.json({ error: "ต้องระบุชื่อสินทรัพย์" }, { status: 400 });
  if (!category) return NextResponse.json({ error: "ต้องระบุหมวดหมู่" }, { status: 400 });
  const asset = await prisma.asset.create({
    data: {
      TenantId: DEFAULT_TENANT_ID,
      Name: name,
      Category: category,
      Code: str(b.code) || null,
      DefaultLocation: str(b.defaultLocation) || null,
      Note: str(b.note) || null,
      CreatedByUsername: session.username,
    },
  });
  return NextResponse.json({ asset });
}
