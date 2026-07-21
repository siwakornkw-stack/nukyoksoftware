import { prisma } from "@/lib/db";

// Registry so one API route + one page can drive all 8 fleet master-data types.
// Each entry maps a URL slug to its Prisma delegate, id field, and Thai label.

export interface MasterTypeDef {
  key: string;
  label: string;
  idField: string;
  // Driver has extra optional string columns; other types have none.
  extraFields: string[];
}

export const MASTER_TYPES: MasterTypeDef[] = [
  { key: "vehicle-type", label: "ประเภทรถ", idField: "VehicleTypeId", extraFields: [] },
  { key: "vehicle-brand", label: "ยี่ห้อ", idField: "VehicleBrandId", extraFields: [] },
  { key: "vehicle-owner", label: "เจ้าของ", idField: "VehicleOwnerId", extraFields: [] },
  { key: "vehicle-department", label: "แผนก", idField: "VehicleDepartmentId", extraFields: [] },
  { key: "vehicle-status", label: "สถานะรถ", idField: "VehicleStatusId", extraFields: [] },
  { key: "fuel-type", label: "ชนิดน้ำมัน", idField: "FuelTypeId", extraFields: [] },
  { key: "payment-status", label: "สถานะการชำระ", idField: "PaymentStatusId", extraFields: [] },
  {
    key: "vehicle-driver",
    label: "คนขับ",
    idField: "VehicleDriverId",
    extraFields: ["MobileNo", "LicenseNo", "LineUserId"],
  },
];

export function getMasterType(key: string): MasterTypeDef | undefined {
  return MASTER_TYPES.find((t) => t.key === key);
}

// Prisma delegates keyed by slug. Typed as a minimal CRUD surface so the shared
// route handler can call findMany/create/findUnique/delete without per-type code.
interface Row {
  [k: string]: unknown;
}
interface Delegate {
  findMany(args: unknown): Promise<Row[]>;
  create(args: unknown): Promise<Row>;
  findUnique(args: unknown): Promise<Row | null>;
  delete(args: unknown): Promise<Row>;
}

const DELEGATES: Record<string, Delegate> = {
  "vehicle-type": prisma.vehicleType as unknown as Delegate,
  "vehicle-brand": prisma.vehicleBrand as unknown as Delegate,
  "vehicle-owner": prisma.vehicleOwner as unknown as Delegate,
  "vehicle-department": prisma.vehicleDepartment as unknown as Delegate,
  "vehicle-status": prisma.vehicleStatus as unknown as Delegate,
  "fuel-type": prisma.fuelType as unknown as Delegate,
  "payment-status": prisma.paymentStatus as unknown as Delegate,
  "vehicle-driver": prisma.vehicleDriver as unknown as Delegate,
};

export function getDelegate(key: string): Delegate | undefined {
  return DELEGATES[key];
}
