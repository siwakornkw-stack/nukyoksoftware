// Registry so one API route + one page can drive all 8 fleet master-data types.
// Each entry maps a URL slug to its Prisma delegate, id field, and Thai label.
//
// This module is imported by a client component, so it must stay free of
// server-only imports. The prisma delegates live in ./master-delegates.

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
