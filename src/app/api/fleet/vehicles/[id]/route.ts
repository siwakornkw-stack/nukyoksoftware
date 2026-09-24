import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function ownedVehicle(id: string) {
  const v = await prisma.vehicle.findUnique({ where: { VehicleId: id } });
  return v && v.TenantId === DEFAULT_TENANT_ID ? v : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const v = await prisma.vehicle.findFirst({
    where: { VehicleId: id, TenantId: DEFAULT_TENANT_ID },
    include: {
      VehicleBrand: true,
      VehicleType: true,
      VehicleDriver: true,
      FuelType: true,
      InstallmentsVehicle: { orderBy: { InstallmentNumber: "asc" } },
      IncomeVehicle: { orderBy: { DateTime: "desc" }, take: 20 },
    },
  });
  if (!v) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ vehicle: v });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const before = await ownedVehicle(id);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });
  const b = (await req.json().catch(() => null)) ?? {};
  const v = await prisma.vehicle.update({
    where: { VehicleId: id },
    data: {
      LicensePlatePrefix: b.platePrefix ?? undefined,
      LicensePlateSuffix: b.plateSuffix ?? undefined,
      LicensePlateProvince: b.plateProvince ?? undefined,
      Model: b.model ?? undefined,
      Color: b.color ?? undefined,
      Status: b.status ?? undefined,
      VehicleTypeId: b.vehicleTypeId === undefined ? undefined : b.vehicleTypeId || null,
      VehicleBrandId: b.vehicleBrandId === undefined ? undefined : b.vehicleBrandId || null,
      VehicleOwnerId: b.vehicleOwnerId === undefined ? undefined : b.vehicleOwnerId || null,
      VehicleDepartmentId:
        b.vehicleDepartmentId === undefined ? undefined : b.vehicleDepartmentId || null,
      VehicleDriverId: b.vehicleDriverId === undefined ? undefined : b.vehicleDriverId || null,
      VehicleStatusId: b.vehicleStatusId === undefined ? undefined : b.vehicleStatusId || null,
      FuelTypeId: b.fuelTypeId === undefined ? undefined : b.fuelTypeId || null,
      InstallmentPeriods: b.installmentPeriods === undefined ? undefined : Number(b.installmentPeriods) || null,
      InstallmentAmount: b.installmentAmount === undefined ? undefined : Number(b.installmentAmount) || null,
      Note: b.note === undefined ? undefined : b.note || null,
      UpdatedByUsername: session.username,
      UpdatedAt: new Date(),
    },
  });
  await audit("vehicle", id, "update", session.username, before, v);
  return NextResponse.json({ vehicle: v });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const { id } = await ctx.params;
  if (!(await ownedVehicle(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Soft delete: keep child records (FK) intact, mark inactive.
  await prisma.vehicle.update({
    where: { VehicleId: id },
    data: { Status: "inactive", UpdatedByUsername: session.username },
  });
  await audit("vehicle", id, "deactivate", session.username, { Status: "active" }, { Status: "inactive" });
  return NextResponse.json({ ok: true });
}
