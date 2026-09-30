import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/lib/debt/parse";

function buf(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const serial = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000 + 25569;
const TOP = [["รายงานใบวางบิล/ใบแจ้งหนี้"], ["ชื่อบริษัท", "x"], ["เลขผู้เสียภาษี :", "0"], ["ช่วงเวลา :", "2026"]];
const INV_HEADER = ["ลำดับที่", "เลขที่เอกสาร", "วัน/เดือน/ปี", "ชื่อลูกค้า", "ชื่อโปรเจ็ค", "เลขผู้เสียภาษี", "สำนักงานใหญ่/สาขา", "มูลค่า", "ภาษีมูลค่าเพิ่ม", "ยอดรวมสุทธิ", "เอกสารอ้างอิงรับมัดจำ"];

describe("debt workbook", () => {
  it("reads an open-invoice report from every sheet, due = date + 30 days", () => {
    const rows = parseWorkbook(
      buf({
        "2026": [...TOP, INV_HEADER, [1, "INV2026090102", serial("2026-09-29"), "บริษัท ก", "หน้างาน", "083", "สำนักงานใหญ่", 18000, 1260, 19260, ""], [null, null, "ยอดรวมทั้งหมด", null, null, null, null, 18000, 1260, 19260]],
        "2025": [...TOP, INV_HEADER, [1, "INV2025120092", serial("2025-12-31"), "บริษัท\tข", null, null, "", 3000, 210, 3210, ""]],
      })
    );
    // Object keys "2025"/"2026" are integer-like, so the helper adds sheet 2025 first.
    expect(rows.map((r) => [r.docNo, r.date, r.dueDate, r.total, r.status])).toEqual([
      ["INV2025120092", "2025-12-31", "2026-01-30", 3210, "วางบิลแล้ว"],
      ["INV2026090102", "2026-09-29", "2026-10-29", 19260, "วางบิลแล้ว"],
    ]);
    expect(rows[0].customer).toBe("บริษัท ข");
  });

  it("keeps the BillingNoteReport layout (has a due-date column) positional", () => {
    const header = ["ลำดับที่", "เลขที่เอกสาร", "ประเภท", "วันที่", "ลูกค้า", "โปรเจ็ค", "เลขผู้เสียภาษี", "ครบกำหนด", "สาขา", "มูลค่า", "VAT", "รวม", "มัดจำ", "สถานะ", "พนักงานขาย"];
    const [r] = parseWorkbook(buf({ s: [...TOP, header, [1, "BL1", "ใบวางบิล", "2026-09-01", "ลูกค้า", "", "", "2026-09-30", "", 100, 7, 107, "", "วางบิลแล้ว", "เอ"]] }));
    expect([r.docNo, r.dueDate, r.total, r.status, r.salesperson]).toEqual(["BL1", "2026-09-30", 107, "วางบิลแล้ว", "เอ"]);
  });
});
