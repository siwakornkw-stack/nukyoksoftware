import { prisma } from "@/lib/db";

// Config-driven registry for the 8 per-vehicle record types. Drives both the
// generic add form (client) and the create/list/delete API. Each type maps to a
// Prisma delegate (accessed via prisma[delegate]) and a flat list of field
// specs. File-typed fields are uploaded via storage.put() and stored as a url
// string in the named column.

export type FieldType = "text" | "number" | "date" | "money" | "file";

export interface FieldSpec {
  name: string; // Prisma column name
  label: string; // Thai UI label
  type: FieldType;
  optional?: boolean;
}

export interface RecordTypeDef {
  key: string; // URL segment + client tab key
  label: string; // Thai tab label
  delegate: RecordDelegate; // prisma delegate name
  idField: string; // PascalCase primary key column
  orderBy: string; // column to sort listings by (desc)
  fields: FieldSpec[];
}

// Delegates we touch. Kept as a union so prisma[delegate] stays typed.
export type RecordDelegate =
  | "tax"
  | "compulsoryMotorInsuranceVehicle"
  | "insurancePolicyVehicle"
  | "carTires"
  | "accidentVehicle"
  | "repairVehicle"
  | "gasolineCost"
  | "drainTheOilVehicle";

// A minimal shape common to every delegate we use. Enough to call the CRUD
// methods generically without fighting Prisma's per-model generics.
interface GenericDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<Record<string, unknown>[]>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  delete(args: { where: Record<string, unknown> }): Promise<unknown>;
}

export function delegate(def: RecordTypeDef): GenericDelegate {
  return (prisma as unknown as Record<string, GenericDelegate>)[def.delegate];
}

export const RECORD_TYPES: RecordTypeDef[] = [
  {
    key: "tax",
    label: "ภาษี",
    delegate: "tax",
    idField: "TaxId",
    orderBy: "EndDate",
    fields: [
      { name: "Year", label: "ปี", type: "number" },
      { name: "EndDate", label: "วันสิ้นอายุ", type: "date" },
      { name: "TotalPremium", label: "เบี้ยรวม", type: "money" },
      { name: "InsuranceCompany", label: "บริษัทประกัน", type: "text" },
      { name: "BrokerName", label: "นายหน้า", type: "text" },
      { name: "File", label: "ไฟล์เอกสาร", type: "file", optional: true },
    ],
  },
  {
    key: "compulsory",
    label: "พ.ร.บ.",
    delegate: "compulsoryMotorInsuranceVehicle",
    idField: "CompulsoryMotorInsuranceVehicleId",
    orderBy: "EndDate",
    fields: [
      { name: "Year", label: "ปี", type: "number" },
      { name: "EndDate", label: "วันสิ้นอายุ", type: "date" },
      { name: "TotalPremium", label: "เบี้ยรวม", type: "money" },
      { name: "InsuranceCompany", label: "บริษัทประกัน", type: "text" },
      { name: "BrokerName", label: "นายหน้า", type: "text" },
      { name: "File", label: "ไฟล์เอกสาร", type: "file", optional: true },
    ],
  },
  {
    key: "insurance",
    label: "ประกันภัย",
    delegate: "insurancePolicyVehicle",
    idField: "InsurancePolicyVehicleId",
    orderBy: "EndDate",
    fields: [
      { name: "Year", label: "ปี", type: "number" },
      { name: "Type", label: "ประเภท", type: "text" },
      { name: "InsuranceCompany", label: "บริษัทประกัน", type: "text" },
      { name: "BrokerName", label: "นายหน้า", type: "text" },
      { name: "StartDate", label: "วันเริ่ม", type: "date" },
      { name: "EndDate", label: "วันสิ้นอายุ", type: "date" },
      { name: "TotalPremium", label: "เบี้ยรวม", type: "money" },
      { name: "PolicyFile", label: "กรมธรรม์", type: "file", optional: true },
    ],
  },
  {
    key: "tires",
    label: "ยาง",
    delegate: "carTires",
    idField: "CarTiresId",
    orderBy: "ChangeDate",
    fields: [
      { name: "ChangeDate", label: "วันเปลี่ยน", type: "date" },
      { name: "Position", label: "ตำแหน่ง", type: "text" },
      { name: "Brand", label: "ยี่ห้อ", type: "text" },
    ],
  },
  {
    key: "accident",
    label: "อุบัติเหตุ",
    delegate: "accidentVehicle",
    idField: "AccidentVehicleId",
    orderBy: "Date",
    fields: [
      { name: "Date", label: "วันที่", type: "date" },
      { name: "Time", label: "เวลา", type: "text" },
      { name: "Party", label: "คู่กรณี/ฝ่าย", type: "text" },
      { name: "LicensePlate", label: "ทะเบียน", type: "text" },
      { name: "DriverName", label: "คนขับ", type: "text" },
      { name: "Opponent", label: "ฝ่ายตรงข้าม", type: "text" },
      { name: "Files", label: "ไฟล์แนบ", type: "file", optional: true },
    ],
  },
  {
    key: "repair",
    label: "ซ่อม",
    delegate: "repairVehicle",
    idField: "RepairVehicleId",
    orderBy: "RepairDate",
    fields: [
      { name: "RepairDate", label: "วันซ่อม", type: "date" },
      { name: "LicensePlate", label: "ทะเบียน", type: "text" },
      { name: "RepairShop", label: "อู่/ร้าน", type: "text" },
      { name: "Description", label: "รายละเอียด", type: "text", optional: true },
      { name: "ReceiveDate", label: "วันรับรถ", type: "date" },
      { name: "InsurancePay", label: "ประกันจ่าย", type: "money" },
      { name: "CompanyPay", label: "บริษัทจ่าย", type: "money" },
    ],
  },
  {
    key: "gasoline",
    label: "ค่าน้ำมัน",
    delegate: "gasolineCost",
    idField: "GasolineCostId",
    orderBy: "DateTime",
    fields: [
      { name: "DateTime", label: "วันที่", type: "date" },
      { name: "Item", label: "รายการ", type: "text" },
      { name: "TaxInvoiceNumber", label: "เลขใบกำกับภาษี", type: "text", optional: true },
      { name: "Liters", label: "ลิตร", type: "number" },
      { name: "Amount", label: "จำนวนเงิน", type: "money" },
      { name: "OdometerStart", label: "เลขไมล์เริ่ม", type: "number" },
      { name: "OdometerEnd", label: "เลขไมล์สิ้นสุด", type: "number" },
    ],
  },
  {
    key: "drainoil",
    label: "เปลี่ยนถ่ายน้ำมันเครื่อง",
    delegate: "drainTheOilVehicle",
    idField: "DrainTheOilVehicleId",
    orderBy: "Date",
    fields: [
      { name: "Date", label: "วันที่", type: "date" },
      { name: "DueDate", label: "ครบกำหนดครั้งถัดไป", type: "date", optional: true },
      { name: "Odometer", label: "เลขไมล์", type: "number" },
      { name: "TextAlert", label: "ข้อความแจ้งเตือน", type: "text" },
    ],
  },
];

export function getRecordType(key: string): RecordTypeDef | undefined {
  return RECORD_TYPES.find((t) => t.key === key);
}
