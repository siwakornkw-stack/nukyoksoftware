import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const entity = q.get("entity") || undefined;
  const entityId = q.get("entityId") || undefined;
  const [logs, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where: { TenantId: DEFAULT_TENANT_ID, ...(entity ? { Entity: entity } : {}), ...(entityId ? { EntityId: entityId } : {}) },
      orderBy: { CreatedAt: "desc" },
      take: 300,
    }),
    prisma.auditLog.findMany({ where: { TenantId: DEFAULT_TENANT_ID }, distinct: ["Entity"], select: { Entity: true } }),
  ]);
  return NextResponse.json({ logs, entities: entities.map((e) => e.Entity).sort() });
}
