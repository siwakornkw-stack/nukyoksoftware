import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const vehicles = await prisma.vehicle.findMany({
    where: {
      TenantId: DEFAULT_TENANT_ID,
      ...(q
        ? { OR: [{ LicensePlateSuffix: { contains: q } }, { Model: { contains: q } }] }
        : {}),
    },
    include: { VehicleBrand: true, VehicleType: true, VehicleDriver: true },
    orderBy: { No: "desc" },
    take: 500,
  });
  return NextResponse.json({ vehicles });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.plateSuffix) {
    return NextResponse.json({ error: "ต้องระบุเลขทะเบียน" }, { status: 400 });
  }
  const v = await prisma.vehicle.create({
    data: {
      TenantId: DEFAULT_TENANT_ID,
      Status: "active",
      LicensePlatePrefix: b.platePrefix ?? "",
      LicensePlateSuffix: b.plateSuffix,
      LicensePlateProvince: b.plateProvince ?? "",
      VehicleCharacteristic: "",
      Model: b.model ?? "",
      Generation: "",
      Color: b.color ?? "",
      ChassisNumber: b.chassisNumber ?? "",
      EngineNumber: b.engineNumber ?? "",
      EngineBrand: "",
      TankSize: 0,
      FuelConsumption: 0,
      CylinderCount: 0,
      Cylinder: 0,
      VehicleSize: "",
      CargoSize: "",
      GasSerialNumber: "",
      VehicleWeight: 0,
      CargoWeight: 0,
      WheelCount: 0,
      SeatCount: 0,
      Age: "",
      Ownership: b.ownership ?? "",
      VehicleTypeId: b.vehicleTypeId || null,
      VehicleBrandId: b.vehicleBrandId || null,
      VehicleDriverId: b.vehicleDriverId || null,
      FuelTypeId: b.fuelTypeId || null,
      InstallmentPeriods: b.installmentPeriods ? Number(b.installmentPeriods) : null,
      InstallmentAmount: b.installmentAmount ? Number(b.installmentAmount) : null,
      Note: b.note || null,
      CreatedByUsername: session.username,
    },
  });
  return NextResponse.json({ vehicle: v });
}
