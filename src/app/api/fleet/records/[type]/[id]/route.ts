import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { delegate, getRecordType } from "@/lib/fleet/record-types";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, id } = await ctx.params;
  const def = getRecordType(type);
  if (!def) return NextResponse.json({ error: "unknown record type" }, { status: 404 });

  const row = await delegate(def).findUnique({ where: { [def.idField]: id } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Scope by tenant via the parent Vehicle relation.
  const vehicleId = String(row.VehicleId || "");
  const v = await prisma.vehicle.findUnique({ where: { VehicleId: vehicleId } });
  if (!v || v.TenantId !== DEFAULT_TENANT_ID) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await delegate(def).delete({ where: { [def.idField]: id } });
  return NextResponse.json({ ok: true });
}
