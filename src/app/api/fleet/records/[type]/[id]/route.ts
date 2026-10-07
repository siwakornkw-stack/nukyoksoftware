import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getRecordType } from "@/lib/fleet/record-types";
import { delegate } from "@/lib/fleet/record-delegates";
import { parseScalar } from "@/lib/fleet/record-fields";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Staff may delete too: the audit row keeps the whole record, and an admin can
// put it back from /settings/trash (POST /api/trash).
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
  await audit(`record:${def.key}`, id, "delete", session.username, row, null);
  return NextResponse.json({ ok: true });
}

const ownsVehicle = async (vehicleId: string) => {
  const v = vehicleId ? await prisma.vehicle.findUnique({ where: { VehicleId: vehicleId } }) : null;
  return !!v && v.TenantId === DEFAULT_TENANT_ID;
};

// JSON body with only the fields being changed. File fields are not editable
// here; VehicleId moves the record to another vehicle of the same tenant.
export async function PATCH(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, id } = await ctx.params;
  const def = getRecordType(type);
  if (!def) return NextResponse.json({ error: "unknown record type" }, { status: 404 });

  const row = await delegate(def).findUnique({ where: { [def.idField]: id } });
  if (!row || !(await ownsVehicle(String(row.VehicleId || "")))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const data: Record<string, unknown> = { UpdatedByUsername: session.username, UpdatedAt: new Date() };

  if ("VehicleId" in body) {
    const vid = String(body.VehicleId ?? "");
    if (!(await ownsVehicle(vid))) return NextResponse.json({ error: "ไม่พบรถคันนี้" }, { status: 400 });
    data.VehicleId = vid;
  }

  for (const f of def.fields) {
    if (!(f.name in body) || f.type === "file") continue;
    const value = String(body[f.name] ?? "").trim();
    if (value === "") {
      if (!f.optional) return NextResponse.json({ error: `ต้องกรอก: ${f.label}` }, { status: 400 });
      // Several optional text columns are NOT NULL (company, broker); "" fits both kinds.
      data[f.name] = f.type === "text" ? "" : null;
      continue;
    }
    if (f.type === "select") {
      data[f.name] = value;
      continue;
    }
    const parsed = parseScalar(f, value);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data[f.name] = parsed.value;
  }

  const updated = await delegate(def).update({ where: { [def.idField]: id }, data });
  await audit(`record:${def.key}`, id, "update", session.username, row, updated);
  return NextResponse.json({ ok: true });
}
