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

// A cell that holds a date the database cannot store (e.g. "20/8/25669", a
// typo for 2569, is year 25126 after the Buddhist-era shift). Reported at
// preview so the office fixes the file, instead of the commit failing whole.
export class SheetError extends Error {}

const plausible = (iso: string) => {
  const y = Number(iso.match(/^(\d{4})-/)?.[1]);
  return y >= 2000 && y <= 2100;
};

function cellText(v: unknown): string {
  if (typeof v !== "number") return String(v);
  const d = new Date(Math.round((v - 25569) * 86400 * 1000));
  return isNaN(d.getTime()) ? String(v) : `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
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
  const bad: string[] = [];
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
    for (const [i, r] of rows.slice(hi + 1).entries()) {
      const date = toDate(r[0]);
      const amount = toNum(at(r, c.amount));
      if (amount && /\d/.test(String(r[0])) && !(date && plausible(date))) {
        bad.push(`แผ่น "${name}" แถว ${hi + i + 2}: วันที่ "${cellText(r[0])}" ไม่ถูกต้อง`);
        continue;
      }
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
  if (bad.length) throw new SheetError(`แก้ไฟล์ก่อนนำเข้า: ${bad.join(" · ")}`);
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
  // Premiums from optional columns "เบี้ยประกัน", "เบี้ย พรบ" / "ค่า พรบ", "ค่าภาษี" / "เบี้ยภาษี".
  insPremium: number | null;
  cmiPremium: number | null;
  taxPremium: number | null;
  note: string;
}

// A money column ("เบี้ย พรบ", "ค่าภาษี") must not be taken for the พ.ร.บ. or tax date column.
const money = (header: string) => header.includes("เบี้ย") || header.startsWith("ค่า");

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
      cmi: findCol(h, (x) => x.includes("พรบ") && !money(x)),
      tax: findCol(h, (x) => x.includes("ภาษี") && !money(x)),
      insPremium: findCol(h, (x) => x.includes("เบี้ย") && !x.includes("พรบ") && !x.includes("ภาษี")),
      cmiPremium: findCol(h, (x) => x.includes("พรบ") && money(x)),
      taxPremium: findCol(h, (x) => x.includes("ภาษี") && money(x)),
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
      const premiumCols = [c.insPremium, c.cmiPremium, c.taxPremium];
      const margin = c.note < 0 ? [] : r.map((v, j) => (j > c.note && !premiumCols.includes(j) ? clean(v) : "")).filter(Boolean);
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
        insPremium: toNum(at(r, c.insPremium)),
        cmiPremium: toNum(at(r, c.cmiPremium)),
        taxPremium: toNum(at(r, c.taxPremium)),
        note: [clean(at(r, c.note)), ...margin].filter(Boolean).join(" / "),
      });
    });
  }
  return out;
}

export interface InstallmentItem {
  no: number;
  due: string;
  paid: boolean;
}

export interface InstallmentRow {
  key: string; // stable id inside one file: "<sheet>!<row>"
  sheet: string;
  label: string; // plate, or the machine code ("SY135") when the row has no plate
  asset: string;
  payNote: string;
  amount: number;
  periods: number;
  dueDay: number | null;
  items: InstallmentItem[];
  repeated: string[]; // "2/48 (08/69)": a number the row already used in an earlier month
}

// "รถแม็คโคร SANY / SY35 (PC35)" -> "SY35", "รถแม็คโคร KOMATSU / (PC130-10M0)" -> "PC130-10M0",
// "รถแม็คโคร CAT313GC" -> "CAT313GC". Only the text after the last "/": the bracket
// is an alias of another model ("SK130-10E (PC130)") and would match the wrong machine.
function machineCode(asset: string): string {
  if (!asset.includes("/")) return asset.match(/[A-Za-z][\w-]*\d[\w-]*/g)?.pop() ?? asset;
  const tail = asset.split("/").pop()!.trim();
  return tail.replace(/\(.*?\)/g, "").trim() || tail.replace(/[()]/g, "").trim();
}

// The office greens a month cell once that installment is paid.
function isGreen(cell: XLSX.CellObject | undefined): boolean {
  const s = cell?.s as { patternType?: string; fgColor?: { rgb?: string } } | undefined;
  const rgb = s?.patternType === "solid" ? s.fgColor?.rgb?.slice(-6) : undefined;
  if (!rgb || !/^[0-9a-f]{6}$/i.test(rgb)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  return g > r && g > b;
}

// ตารางทะเบียนเครื่องจักร: one row per vehicle, month columns ("เดือน 06/69") holding
// the installment number paid that month ("43/48"). Needs the workbook read with
// cellStyles so the green fill is visible.
export function parseInstallmentWorkbook(wb: WorkBook): InstallmentRow[] {
  const out: InstallmentRow[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = sheetRows(wb, name);
    const hi = rows.findIndex((r) => r.some((c) => squash(c).includes("รายการทรัพย์สิน")) && r.some((c) => /^เดือน\d/.test(squash(c))));
    if (hi < 0) continue;

    const h = rows[hi].map(squash);
    const c = {
      asset: findCol(h, (x) => x.includes("รายการทรัพย์สิน")),
      plate: findCol(h, (x) => x.includes("ทะเบียน")),
      pay: findCol(h, (x) => x.includes("วันที่ชำระ")),
      amount: findCol(h, (x) => x.includes("จำนวนเงิน")),
    };
    const months = h.flatMap((x, i) => {
      const m = x.match(/^เดือน(\d{1,2})\/(\d{2}|\d{4})$/);
      if (!m) return [];
      let y = Number(m[2]);
      if (y < 100) y += 2500; // "06/69" is Buddhist era
      return [{ col: i, label: `${m[1].padStart(2, "0")}/${m[2]}`, year: y - 543, month: Number(m[1]) }];
    });
    const at = (r: Cell[], i: number) => (i < 0 ? "" : r[i]);
    const origin = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

    rows.slice(hi + 1).forEach((r, i) => {
      const asset = text(at(r, c.asset));
      const plate = text(at(r, c.plate));
      const amount = toNum(at(r, c.amount));
      if (!(asset || plate) || !amount) return;

      const payNote = text(at(r, c.pay));
      const dm = payNote.match(/วันที่\s*(\d{1,2})/);
      const dueDay = dm ? Number(dm[1]) : null;
      const rowIdx = origin.s.r + hi + 1 + i;
      const items: InstallmentItem[] = [];
      const repeated: string[] = [];
      let periods = 0;
      for (const m of months) {
        const n = String(r[m.col] ?? "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
        if (!n) continue;
        const no = Number(n[1]);
        periods = Math.max(periods, Number(n[2]));
        if (items.some((x) => x.no === no)) {
          repeated.push(`${no}/${n[2]} (${m.label})`);
          continue;
        }
        const last = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
        const due = new Date(Date.UTC(m.year, m.month - 1, Math.min(dueDay ?? 1, last))).toISOString().slice(0, 10);
        const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: origin.s.c + m.col })];
        items.push({ no, due, paid: isGreen(cell) });
      }
      if (!items.length) return;

      out.push({
        key: `${name}!${rowIdx + 1}`,
        sheet: name,
        label: plate && /\d/.test(plate) ? plate : machineCode(asset) || plate,
        asset,
        payNote,
        amount,
        periods,
        dueDay,
        items,
        repeated,
      });
    });
  }
  return out;
}

export interface IncomeRow {
  sheet: string;
  kind: "tax" | "cash"; // tax: sales-tax report (RVV..., before-VAT amount); cash: billing notes paid in cash (BL...)
  docNo: string;
  date: string;
  customer: string;
  project: string;
  amount: number;
}

export interface IncomeSheet {
  sheet: string;
  kind: "tax" | "cash";
  rows: IncomeRow[];
  cancelled: number; // rows whose status column says ยกเลิก
}

// รายรับ MM.69: "ในระบบ" = the FlowAccount sales-tax report, "บิลนอก" = cash billing
// notes. Columns move between months, so they are found by header text. Sheets
// named "...(ยกเลิก)" are read too; only rows marked ยกเลิก in a status column are dropped.
// Sheets without "ยกเลิก" in the name come first so their amount wins for a document
// listed in both.
export function parseIncomeWorkbook(wb: WorkBook): IncomeSheet[] {
  const out: IncomeSheet[] = [];
  const bad: string[] = [];
  const names = [...wb.SheetNames].sort((a, b) => Number(a.includes("ยกเลิก")) - Number(b.includes("ยกเลิก")));
  for (const name of names) {
    const rows = sheetRows(wb, name);
    const hi = rows.findIndex((r) => r.some((c) => squash(c) === "ลำดับที่") && r.some((c) => squash(c) === "เลขที่เอกสาร"));
    if (hi < 0) continue;

    const h = rows[hi].map(squash);
    const kind = h.some((x) => x.includes("ก่อนภาษี")) ? "tax" : "cash";
    const c = {
      doc: findCol(h, (x) => x === "เลขที่เอกสาร"),
      date: findCol(h, (x) => x.includes("วัน/เดือน/ปี")),
      customer: findCol(h, (x) => x.includes("ชื่อลูกค้า")),
      project: findCol(h, (x) => x.includes("ชื่อโปรเจ็ค")),
      amount: kind === "tax" ? findCol(h, (x) => x.includes("ก่อนภาษี")) : findCol(h, (x) => x === "มูลค่า" || x.includes("ยอดรวมสุทธิ")),
      status: findCol(h, (x) => x === "สถานะ"),
    };
    if (c.doc < 0 || c.amount < 0) continue;
    const at = (r: Cell[], i: number) => (i < 0 ? "" : r[i]);

    const data: IncomeRow[] = [];
    let cancelled = 0;
    for (const [i, r] of rows.slice(hi + 1).entries()) {
      const docNo = text(at(r, c.doc));
      const amount = toNum(at(r, c.amount));
      if (!/\d/.test(docNo) || amount == null) continue; // blank lines, the totals row ("ยอดรวมทั้งหมด" may sit in this column)
      if (text(at(r, c.status)).includes("ยกเลิก")) {
        cancelled++;
        continue;
      }
      const date = toDate(at(r, c.date));
      if (!date || !plausible(date)) {
        bad.push(`แผ่น "${name}" แถว ${hi + i + 2}: วันที่ "${cellText(at(r, c.date))}" ไม่ถูกต้อง`);
        continue;
      }
      data.push({
        sheet: name,
        kind,
        docNo,
        date,
        customer: text(at(r, c.customer)),
        project: text(at(r, c.project)),
        amount,
      });
    }
    if (data.length || cancelled) out.push({ sheet: name, kind, rows: data, cancelled });
  }
  if (bad.length) throw new SheetError(`แก้ไฟล์ก่อนนำเข้า: ${bad.join(" · ")}`);
  return out;
}
