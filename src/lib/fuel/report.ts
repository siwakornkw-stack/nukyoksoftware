import type { FuelBill } from "@prisma/client";

// Ported from โปรแกรมนำมัน/src/report.js (adapted to camelCase Prisma rows).
const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const STATUS_LABEL: Record<string, string> = {
  ok: "ปกติ",
  suspect: "น่าสงสัย",
  extract_failed: "อ่านไม่สำเร็จ",
};

export interface EmployeeTotal {
  count: number;
  liters: number;
  baht: number;
  suspects: number;
}

export function summarize(bills: FuelBill[]) {
  const totals = { count: bills.length, liters: 0, baht: 0, suspects: 0 };
  const byEmployee = new Map<string, EmployeeTotal>();
  for (const b of bills) {
    const suspect = b.status === "suspect" ? 1 : 0;
    const liters = Number(b.liters ?? 0);
    const baht = Number(b.total ?? 0);
    totals.liters += liters;
    totals.baht += baht;
    totals.suspects += suspect;
    const key = b.employeeName || b.lineUserId;
    const e = byEmployee.get(key) ?? { count: 0, liters: 0, baht: 0, suspects: 0 };
    e.count += 1;
    e.liters += liters;
    e.baht += baht;
    e.suspects += suspect;
    byEmployee.set(key, e);
  }
  return {
    totals,
    byEmployee: [...byEmployee.entries()].sort((a, z) => z[1].baht - a[1].baht),
  };
}

export function textReport(ym: string, bills: FuelBill[]): string {
  const { totals, byEmployee } = summarize(bills);
  const lines = [
    `รายงานน้ำมัน ${ym}`,
    `บิลทั้งหมด: ${totals.count} ใบ`,
    `รวม: ${fmt(totals.liters)} ลิตร / ${fmt(totals.baht)} บาท`,
    `น่าสงสัย: ${totals.suspects} ใบ`,
  ];
  if (byEmployee.length) {
    lines.push("", "รายคน:");
    for (const [name, e] of byEmployee) {
      const flag = e.suspects ? ` (น่าสงสัย ${e.suspects})` : "";
      lines.push(`- ${name}: ${e.count} ใบ, ${fmt(e.liters)} ลิตร, ${fmt(e.baht)} บาท${flag}`);
    }
  }
  return lines.join("\n");
}

const csvCell = (v: unknown): string => {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralize spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function buildCsv(bills: FuelBill[]): string {
  const headers = [
    "id", "วันที่", "เวลา", "พนักงาน", "ปั๊ม", "เลขที่ใบเสร็จ", "ชนิดน้ำมัน",
    "ลิตร", "บาท/ลิตร", "ยอดรวม", "ทะเบียน", "สถานะ", "หมายเหตุ",
  ];
  const rows = bills.map((b) =>
    [
      b.id,
      b.billDate ?? b.createdAt.toISOString().slice(0, 10),
      b.billTime ?? "",
      b.employeeName ?? b.lineUserId,
      b.station ?? "",
      b.receiptNo ?? "",
      b.fuelType ?? "",
      b.liters ?? "",
      b.pricePerLiter ?? "",
      b.total ?? "",
      b.plate ?? "",
      STATUS_LABEL[b.status] ?? b.status,
      b.suspectReasons ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\r\n");
}
