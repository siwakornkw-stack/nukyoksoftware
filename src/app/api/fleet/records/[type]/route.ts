import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { put } from "@/lib/storage";
import { parseScalar } from "@/lib/fleet/record-fields";
import { getRecordType, type RecordTypeDef } from "@/lib/fleet/record-types";
import { delegate } from "@/lib/fleet/record-delegates";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function ownsVehicle(vehicleId: string): Promise<boolean> {
  if (!vehicleId) return false;
  const v = await prisma.vehicle.findUnique({ where: { VehicleId: vehicleId } });
  return !!v && v.TenantId === DEFAULT_TENANT_ID;
}

// A Decimal serialises to a string, so money would reach the client as
// "350.5" and any arithmetic on it would concatenate instead of add. The
// record type already declares which columns are money.
function withNumericMoney(def: RecordTypeDef, row: Record<string, unknown>) {
  const out = { ...row };
  for (const f of def.fields) {
    if ((f.type === "money" || f.type === "decimal") && out[f.name] != null) out[f.name] = Number(out[f.name]);
  }
  return out;
}

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const def = getRecordType(type);
  if (!def) return NextResponse.json({ error: "ไม่รู้จักประเภทรายการนี้" }, { status: 404 });

  const vehicleId = new URL(req.url).searchParams.get("vehicleId") || "";
  if (!(await ownsVehicle(vehicleId))) {
    return NextResponse.json({ error: "ไม่พบรถคันนี้" }, { status: 404 });
  }

  const rows = await delegate(def).findMany({
    where: {
      VehicleId: vehicleId,
      ...(def.tenanted ? { TenantId: DEFAULT_TENANT_ID } : {}),
    },
    orderBy: { [def.orderBy]: "desc" },
  });
  return NextResponse.json({ rows: rows.map((r) => withNumericMoney(def, r)) });
}

export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type } = await ctx.params;
  const def = getRecordType(type);
  if (!def) return NextResponse.json({ error: "ไม่รู้จักประเภทรายการนี้" }, { status: 404 });

  // The add form posts multipart because record types can carry a file field.
  // Without this, anything else (a JSON client, say) makes formData() throw and
  // the caller gets a bare 500 with no body to explain it.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "ต้องส่งข้อมูลแบบ multipart/form-data" },
      { status: 400 }
    );
  }

  const vehicleId = String(form.get("vehicleId") || "");
  if (!(await ownsVehicle(vehicleId))) {
    return NextResponse.json({ error: "ไม่พบรถคันนี้" }, { status: 404 });
  }

  const data: Record<string, unknown> = {
    Status: "active",
    VehicleId: vehicleId,
    CreatedByUsername: session.username,
    UpdatedByUsername: session.username,
    ...(def.tenanted ? { TenantId: DEFAULT_TENANT_ID } : {}),
    ...(def.defaults ?? {}),
  };

  for (const f of def.fields) {
    const raw = form.get(f.name);

    if (f.type === "select") {
      const id = raw == null ? "" : String(raw).trim();
      if (!id && !f.optional) {
        return NextResponse.json({ error: `ต้องเลือก: ${f.label}` }, { status: 400 });
      }
      data[f.name] = id || null;
      continue;
    }

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

    const parsed = parseScalar(f, value);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data[f.name] = parsed.value;
  }

  const row = await delegate(def).create({ data });
  await audit(`record:${def.key}`, String(row[def.idField]), "create", session.username, null, row);
  return NextResponse.json({ row: withNumericMoney(def, row) }, { status: 201 });
}
