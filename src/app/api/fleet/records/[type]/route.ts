import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { put } from "@/lib/storage";
import { normalizeDate } from "@/lib/fleet/dates";
import { delegate, getRecordType } from "@/lib/fleet/record-types";

export const dynamic = "force-dynamic";

async function ownsVehicle(vehicleId: string): Promise<boolean> {
  if (!vehicleId) return false;
  const v = await prisma.vehicle.findUnique({ where: { VehicleId: vehicleId } });
  return !!v && v.TenantId === DEFAULT_TENANT_ID;
}

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const def = getRecordType(type);
  if (!def) return NextResponse.json({ error: "unknown record type" }, { status: 404 });

  const vehicleId = new URL(req.url).searchParams.get("vehicleId") || "";
  if (!(await ownsVehicle(vehicleId))) {
    return NextResponse.json({ error: "vehicle not found" }, { status: 404 });
  }

  const rows = await delegate(def).findMany({
    where: { VehicleId: vehicleId },
    orderBy: { [def.orderBy]: "desc" },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const def = getRecordType(type);
  if (!def) return NextResponse.json({ error: "unknown record type" }, { status: 404 });

  const form = await req.formData();
  const vehicleId = String(form.get("vehicleId") || "");
  if (!(await ownsVehicle(vehicleId))) {
    return NextResponse.json({ error: "vehicle not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {
    Status: "active",
    VehicleId: vehicleId,
    CreatedByUsername: session.username,
    UpdatedByUsername: session.username,
  };

  for (const f of def.fields) {
    const raw = form.get(f.name);

    if (f.type === "file") {
      if (raw instanceof File && raw.size > 0) {
        const ext = raw.name.includes(".") ? raw.name.split(".").pop()!.toLowerCase() : "bin";
        const key = `fleet/${vehicleId}/${def.key}/${randomUUID()}.${ext}`;
        const buf = Buffer.from(await raw.arrayBuffer());
        const { url } = await put(key, buf);
        data[f.name] = url;
      } else if (!f.optional) {
        return NextResponse.json({ error: `ต้องแนบไฟล์: ${f.label}` }, { status: 400 });
      }
      continue;
    }

    const value = raw == null ? "" : String(raw).trim();
    if (value === "") {
      if (f.optional) continue;
      return NextResponse.json({ error: `ต้องกรอก: ${f.label}` }, { status: 400 });
    }

    if (f.type === "number") {
      data[f.name] = Math.trunc(Number(value)) || 0;
    } else if (f.type === "money") {
      data[f.name] = Number(value) || 0;
    } else if (f.type === "date") {
      const d = normalizeDate(value);
      if (!d) return NextResponse.json({ error: `วันที่ไม่ถูกต้อง: ${f.label}` }, { status: 400 });
      data[f.name] = d;
    } else {
      data[f.name] = value;
    }
  }

  const row = await delegate(def).create({ data });
  return NextResponse.json({ row }, { status: 201 });
}
