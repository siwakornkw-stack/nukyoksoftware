// Parsers for the two spreadsheets the office keeps by hand:
//  - ค่าน้ำมัน: one sheet per vehicle/machine per month, a header block
//    (month, driver, model, odometer) then one row per fill-up.
//  - ตารางประกัน และ พรบ: one row per vehicle with insurance/พ.ร.บ./tax expiry.
// Columns are located by header text, not position, because the sheets drift
// (extra columns, the backhoe sheet has no "ลักษณะ", header rows move).
import type { WorkBook } from "xlsx";
import * as XLSX from "xlsx";
import { normalizeDate, toISO } from "./dates";
import { splitSheetName } from "./plates";

type Cell = string | number | boolean | Date;

const squash = (v: unknown) => String(v ?? "").replace(/[\s.]/g, "");
const text = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

function toNum(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function toDate(v: unknown): string | null {
  if (v === "" || v == null) return null;
  if (typeof v === "string" && !/\d/.test(v)) return null; // "ไมมี", "-"
  return toISO(normalizeDate(v));
}

function sheetRows(wb: WorkBook, name: string): Cell[][] {
  return XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, defval: "", raw: true });
}

const findCol = (header: string[], pred: (h: string) => boolean) => header.findIndex(pred);

export interface FuelRow {
  date: string;
  item: string;
  invoice: string;
  odoStart: number;
  odoEnd: number;
  distance: number | null;
  amount: number;
  liters: number;
  receiver: string;
}

export interface FuelSheet {
  sheet: string;
  label: string;
  driver: string;
  model: string;
  period: string;
  rows: FuelRow[];
}

export function parseFuelWorkbook(wb: WorkBook): FuelSheet[] {
  const out: FuelSheet[] = [];
  for (const name of wb.SheetNames) {
    const rows = sheetRows(wb, name);
    const hi = rows.findIndex((r) => squash(r[0]).startsWith("วัน") && r.some((c) => squash(c).includes("จำนวนเงิน")));
    if (hi < 0) continue;

    const h = rows[hi].map(squash);
    const c = {
      item: findCol(h, (x) => x.startsWith("รายการ")),
      invoice: findCol(h, (x) => x.includes("ใบกำกับ")),
      odoStart: findCol(h, (x) => x.includes("ไมล์") && x.includes("ต้นทาง")),
      odoEnd: findCol(h, (x) => x.includes("ไมล์") && x.includes("ปลายทาง")),
      distance: findCol(h, (x) => x.includes("ระยะทางที่วิ่ง")),
      amount: findCol(h, (x) => x.includes("จำนวนเงิน")),
      litersIn: findCol(h, (x) => x.includes("จำนวนรับ")),
      litersOut: findCol(h, (x) => x.includes("จำนวนจ่าย")),
      receiver: findCol(h, (x) => x.includes("ผู้รับ")),
    };
    const at = (r: Cell[], i: number) => (i < 0 ? "" : r[i]);

    const { label, hint } = splitSheetName(name);
    let driver = hint;
    let model = "";
    let period = "";
    for (const r of rows.slice(0, hi)) {
      const first = text(r[0]);
      const m = first.match(/ประจำเดือน\s*(.+)/);
      if (m) period = m[1].trim();
      const d = first.match(/ชื่อคนขับ\s*\(\s*(.*?)\s*\)/);
      if (d && d[1] && !/^[.\s-]*$/.test(d[1]) && !d[1].includes("ไม่มี")) driver = d[1];
      if (squash(r[0]) === "รุ่นรถ") model = text(r[1]);
    }

    const data: FuelRow[] = [];
    for (const r of rows.slice(hi + 1)) {
      const date = toDate(r[0]);
      const amount = toNum(at(r, c.amount));
      if (!date || !amount) continue; // blank lines, the totals row, signatures
      data.push({
        date,
        item: text(at(r, c.item)),
        invoice: text(at(r, c.invoice)),
        odoStart: toNum(at(r, c.odoStart)) ?? 0,
        odoEnd: toNum(at(r, c.odoEnd)) ?? 0,
        distance: toNum(at(r, c.distance)),
        amount,
        liters: toNum(at(r, c.litersIn)) ?? toNum(at(r, c.litersOut)) ?? 0,
        receiver: text(at(r, c.receiver)),
      });
    }
    if (data.length) out.push({ sheet: name, label, driver, model, period, rows: data });
  }
  return out;
}

export interface InsuranceRow {
  key: string; // stable id inside one file: "<sheet>!<row>"
  sheet: string;
  label: string;
  driver: string;
  vehicleType: string;
  characteristic: string;
  insEnd: string | null;
  insClass: string;
  insCompany: string;
  cmiEnd: string | null;
  taxEnd: string | null;
  note: string;
}

export function parseInsuranceWorkbook(wb: WorkBook): InsuranceRow[] {
  const out: InsuranceRow[] = [];
  for (const name of wb.SheetNames) {
    const rows = sheetRows(wb, name);
    const hi = rows.findIndex((r) => r.some((c) => squash(c).includes("ป้ายทะเบียน")));
    if (hi < 0) continue;

    const h = rows[hi].map(squash);
    const c = {
      plate: findCol(h, (x) => x.includes("ป้ายทะเบียน")),
      driver: findCol(h, (x) => x.includes("คนขับ")),
      type: findCol(h, (x) => x.includes("ประเภทรถ")),
      char: findCol(h, (x) => x.includes("ลักษณะ")),
      insEnd: findCol(h, (x) => x.includes("ประกันหมด")),
      insClass: findCol(h, (x) => x.includes("ชั้น")),
      cmi: findCol(h, (x) => x.includes("พรบ")),
      tax: findCol(h, (x) => x.includes("ภาษี")),
      note: findCol(h, (x) => x.includes("หมายเหตุ")),
    };
    // The backhoe sheet has two "ชื่อประกัน" columns and fills either one.
    const companyCols = h.flatMap((x, i) => (x.includes("ชื่อประกัน") ? [i] : []));
    const at = (r: Cell[], i: number) => (i < 0 ? "" : r[i]);

    rows.slice(hi + 1).forEach((r, i) => {
      const label = text(at(r, c.plate));
      if (!label) return;
      const clean = (v: unknown) => {
        const s = text(v);
        return s === "-" ? "" : s;
      };
      const company = companyCols.map((ci) => clean(r[ci])).find(Boolean) ?? "";
      const cls = clean(at(r, c.insClass)).replace(/ชั้น\s*/, "ชั้น ");
      // Anything after the note column is a scratch note someone typed in the margin.
      const margin = c.note < 0 ? [] : r.slice(c.note + 1).map(clean).filter(Boolean);
      out.push({
        key: `${name}!${hi + 1 + i}`,
        sheet: name,
        label,
        driver: clean(at(r, c.driver)),
        vehicleType: clean(at(r, c.type)),
        characteristic: clean(at(r, c.char)),
        insEnd: toDate(at(r, c.insEnd)),
        insClass: cls,
        insCompany: company,
        cmiEnd: toDate(at(r, c.cmi)),
        taxEnd: toDate(at(r, c.tax)),
        note: [clean(at(r, c.note)), ...margin].filter(Boolean).join(" / "),
      });
    });
  }
  return out;
}
