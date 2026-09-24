export type DebtStatus =
  | "รอวางบิล"
  | "วางบิลแล้ว"
  | "เปิดบิลแล้ว"
  | "ชำระแล้ว"
  | "ยกเลิก";

export const STATUS_LIST: DebtStatus[] = [
  "รอวางบิล",
  "วางบิลแล้ว",
  "เปิดบิลแล้ว",
  "ชำระแล้ว",
  "ยกเลิก",
];

export interface DebtRecord {
  id: string;
  docNo: string;
  docType: string;
  date: string | null;
  customer: string;
  project: string;
  taxId: string;
  dueDate: string | null;
  branch: string;
  value: number;
  vat: number;
  total: number;
  depositRef: string;
  status: DebtStatus;
  salesperson: string;
  paid: number; // recorded in the web app for this uploaded version
}

export interface VersionMeta {
  id: string;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  totalAmount: number;
}

export interface DataStore {
  currentVersionId: string | null;
  versions: VersionMeta[];
}

export const PAY_METHODS = ["โอน", "เงินสด", "เช็ค", "อื่นๆ"];
