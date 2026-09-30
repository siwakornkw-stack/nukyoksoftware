import * as XLSX from "xlsx";
import type { DebtRecord, DebtStatus } from "./types";
import { STATUS_LIST } from "./types";
import { normalizeDate, toISO } from "@/lib/fleet/dates";

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
  const header = (rows[headerIdx] || []).map((c) => String(c ?? "").replace(/\s/g, ""));
  // Read again without cellDates: its Date objects depend on the machine time zone
  // (a day early on a UTC+7 PC); the raw Excel serial does not.
  if (!header.some((h) => h.includes("ครบกำหนด"))) return parseInvoiceReport(XLSX.read(buf, { type: "array" }));

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
      paid: 0,
    });
  }
  return out;
}

const CREDIT_DAYS = 30;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// FlowAccount "รายงานใบวางบิล/ใบแจ้งหนี้" of open invoices (e.g. "ลูกหนี้ 2018-2026
// ณ 30.09.69", one sheet per year). It has no due date, status or salesperson
// columns, and columns are found by header text. Every row is an open invoice
// (status วางบิลแล้ว); the due date is the document date + 30 days so aging and
// reminders work.
function parseInvoiceReport(wb: XLSX.WorkBook): DebtRecord[] {
  const out: DebtRecord[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true });
    const hi = rows.slice(0, 30).findIndex((r) => (r || []).some((c) => String(c ?? "").trim() === "เลขที่เอกสาร"));
    if (hi < 0) continue;
    const h = (rows[hi] || []).map((c) => String(c ?? "").replace(/\s/g, ""));
    const col = (pred: (x: string) => boolean) => h.findIndex(pred);
    const c = {
      doc: col((x) => x === "เลขที่เอกสาร"),
      date: col((x) => x.includes("วัน/เดือน/ปี")),
      customer: col((x) => x.includes("ชื่อลูกค้า")),
      project: col((x) => x.includes("ชื่อโปรเจ็ค")),
      taxId: col((x) => x.includes("เลขผู้เสียภาษี")),
      branch: col((x) => x.includes("สาขา")),
      value: col((x) => x === "มูลค่า"),
      vat: col((x) => x.includes("ภาษีมูลค่าเพิ่ม")),
      total: col((x) => x.includes("ยอดรวมสุทธิ")),
      deposit: col((x) => x.includes("มัดจำ")),
    };
    const at = (r: unknown[], i: number) => (i < 0 ? "" : r[i]);
    for (const row of rows.slice(hi + 1)) {
      const r = row || [];
      const docNo = String(at(r, c.doc) ?? "").trim();
      if (!/\d/.test(docNo)) continue; // blank lines, the totals row
      const date = toISO(normalizeDate(at(r, c.date)));
      out.push({
        id: docNo,
        docNo,
        docType: "ใบแจ้งหนี้",
        date,
        customer: String(at(r, c.customer) ?? "").replace(/\s+/g, " ").trim(),
        project: String(at(r, c.project) ?? "").trim(),
        taxId: String(at(r, c.taxId) ?? "").trim(),
        dueDate: date ? addDays(date, CREDIT_DAYS) : null,
        branch: String(at(r, c.branch) ?? "").trim(),
        value: toNum(at(r, c.value)),
        vat: toNum(at(r, c.vat)),
        total: toNum(at(r, c.total)),
        depositRef: String(at(r, c.deposit) ?? "").trim(),
        status: "วางบิลแล้ว", // open; "เปิดบิลแล้ว" would count as collected in summary.ts
        salesperson: "",
        paid: 0,
      });
    }
  }
  return out;
}
