import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { bangkokToday } from "./schedule";
import { plateText } from "./plates";

// A vehicle is at the garage between RepairDate and ReceiveDate (the day it is
// collected, planned or actual): RepairDate <= today < ReceiveDate.
const atShop = (today: Date) => ({ RepairDate: { lte: today }, ReceiveDate: { gt: today } });

export async function vehiclesInShop(today = bangkokToday()) {
  const rows = await prisma.repairVehicle.findMany({
    where: { Vehicle: { TenantId: DEFAULT_TENANT_ID, Status: "active" }, ...atShop(today) },
    orderBy: { ReceiveDate: "asc" },
    distinct: ["VehicleId"],
    include: { Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } } },
  });
  return rows.map((r) => ({
    vehicleId: r.VehicleId,
    plate: plateText(r.Vehicle) || r.Vehicle.Model,
    shop: r.RepairShop,
    description: r.Description,
    since: r.RepairDate,
    until: r.ReceiveDate,
  }));
}

export async function isInShop(vehicleId: string, today = bangkokToday()): Promise<boolean> {
  return (await prisma.repairVehicle.count({ where: { VehicleId: vehicleId, ...atShop(today) } })) > 0;
}
