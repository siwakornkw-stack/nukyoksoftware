import * as XLSX from "xlsx";
import type { DebtRecord, DebtStatus } from "./types";
import { STATUS_LIST } from "./types";

function toISODate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toISODate(d);
  return null;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function normStatus(v: unknown): DebtStatus {
  const s = String(v ?? "").trim();
  return (STATUS_LIST.includes(s as DebtStatus) ? s : "เปิดบิลแล้ว") as DebtStatus;
}

// Parse the BillingNoteReport workbook into normalized debt records.
export function parseWorkbook(buf: ArrayBuffer): DebtRecord[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] || [];
    if (r.some((c) => String(c ?? "").trim() === "เลขที่เอกสาร")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 4;

  const out: DebtRecord[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const docNo = String(r[1] ?? "").trim();
    if (!docNo) continue;
    out.push({
      id: docNo || `row-${i}`,
      docNo,
      docType: String(r[2] ?? "").trim(),
      date: toISODate(r[3]),
      customer: String(r[4] ?? "").trim(),
      project: String(r[5] ?? "").trim(),
      taxId: String(r[6] ?? "").trim(),
      dueDate: toISODate(r[7]),
      branch: String(r[8] ?? "").trim(),
      value: toNum(r[9]),
      vat: toNum(r[10]),
      total: toNum(r[11]),
      depositRef: String(r[12] ?? "").trim(),
      status: normStatus(r[13]),
      salesperson: String(r[14] ?? "").trim(),
    });
  }
  return out;
}
