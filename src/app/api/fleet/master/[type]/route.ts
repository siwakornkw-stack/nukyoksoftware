import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getMasterType, getDelegate } from "@/lib/fleet/master-types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const def = getMasterType(type);
  const delegate = getDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await delegate.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    orderBy: { Name: "asc" },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const def = getMasterType(type);
  const delegate = getDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const name = typeof b.Name === "string" ? b.Name.trim() : "";
  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อ" }, { status: 400 });

  const data: Record<string, unknown> = {
    TenantId: DEFAULT_TENANT_ID,
    Status: "active",
    Name: name,
    CreatedByUsername: session.username,
  };
  for (const f of def.extraFields) {
    const v = typeof b[f] === "string" ? b[f].trim() : "";
    data[f] = v || null;
  }

  const row = await delegate.create({ data });
  return NextResponse.json({ row }, { status: 201 });
}
