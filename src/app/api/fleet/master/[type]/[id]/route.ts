import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getMasterType } from "@/lib/fleet/master-types";
import { getDelegate } from "@/lib/fleet/master-delegates";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, id } = await ctx.params;
  const def = getMasterType(type);
  const delegate = getDelegate(type);
  if (!def || !delegate) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Verify ownership before deleting.
  const existing = await delegate.findUnique({ where: { [def.idField]: id } });
  if (!existing || existing.TenantId !== DEFAULT_TENANT_ID) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    await delegate.delete({ where: { [def.idField]: id } });
  } catch (e) {
    // P2003: FK constraint — row is referenced by vehicles/income and cannot be removed.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "ลบไม่ได้ เนื่องจากมีการใช้งานข้อมูลนี้อยู่" },
        { status: 409 }
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
