import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFuelWorkbook, SheetError } from "@/lib/fleet/office-sheets";

const HEADER = ["วัน / เดือน / ปี", "รายการ", "เลขที่ใบกำกับภาษี", "เลขไมล์\n(ต้นทาง)", "เลขไมล์\n(ปลายทาง)", "ระยะทาง\nที่วิ่งได้ / กม.", "จำนวนเงิน (บาท)", "จำนวนรับ (ลิตร)"];

function book(dateCell: unknown) {
  const ws = XLSX.utils.aoa_to_sheet([
    ["ประจำเดือน สิงหาคม 2569"],
    ["รุ่นรถ", "บย1326"],
    HEADER,
    [dateCell, "น้ำมันดีเซล B7", "INV1", 0, 0, 0, 2300, 60.71],
    ["รวม", "", "", "", "", "", 2300, 60.71],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "บย1326");
  return wb;
}

describe("fuel sheet dates", () => {
  it("reads a Buddhist-era date typed into Excel", () => {
    // 20/8/2569 typed into Excel is a serial in year 2569.
    const serial = Date.UTC(2569, 7, 20) / 86400000 + 25569;
    expect(parseFuelWorkbook(book(serial))[0].rows[0].date).toBe("2026-08-20");
  });
  it("rejects a mistyped year instead of letting the commit fail", () => {
    // "20/8/25669": one digit too many; Excel stores it as serial 8681683.
    expect(() => parseFuelWorkbook(book(8681683))).toThrow(SheetError);
    expect(() => parseFuelWorkbook(book(8681683))).toThrow(/แถว 4: วันที่ "20\/8\/25669"/);
  });
});
