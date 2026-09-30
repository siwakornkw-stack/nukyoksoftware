import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFuelWorkbook, parseInsuranceWorkbook, SheetError } from "@/lib/fleet/office-sheets";

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

describe("insurance sheet premiums", () => {
  const serial = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000 + 25569;
  const wb = (rows: unknown[][]) => {
    const b = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(b, XLSX.utils.aoa_to_sheet(rows), "6 ล้อ");
    return b;
  };

  it("reads premium columns without mistaking them for the พ.ร.บ./tax date columns", () => {
    const [r] = parseInsuranceWorkbook(
      wb([
        ["ลำดับ", "ป้ายทะเบียน ", "ค่า พรบ", "ประกันหมดวันที่", "ประกันชั้น", "เบี้ยประกัน", "พรบ.ยาว", "ภาษี .สั้น", "หมายเหตุ ", "ค่าภาษี"],
        [1, "81-2993", 645.21, serial("2027-05-23"), "1", "25,000", serial("2027-05-20"), serial("2027-06-01"), "ต่อแล้ว", 1800],
      ])
    );
    expect([r.insEnd, r.cmiEnd, r.taxEnd]).toEqual(["2027-05-23", "2027-05-20", "2027-06-01"]);
    expect([r.insPremium, r.cmiPremium, r.taxPremium]).toEqual([25000, 645.21, 1800]);
    expect(r.note).toBe("ต่อแล้ว"); // the ค่าภาษี column after หมายเหตุ is not a margin note
  });

  it("leaves premiums empty when the sheet has no premium columns", () => {
    const [r] = parseInsuranceWorkbook(
      wb([
        ["ลำดับ", "ป้ายทะเบียน ", "ประกันหมดวันที่", "พรบ.ยาว", "ภาษี .สั้น", "หมายเหตุ ", ""],
        [1, "81-2993", serial("2027-05-23"), serial("2027-05-20"), serial("2027-06-01"), "", "โทรตาม"],
      ])
    );
    expect([r.insPremium, r.cmiPremium, r.taxPremium]).toEqual([null, null, null]);
    expect(r.cmiEnd).toBe("2027-05-20");
    expect(r.note).toBe("โทรตาม");
  });
});
