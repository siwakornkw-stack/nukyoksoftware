import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "@/lib/fleet/queries";
import { plateText } from "@/lib/fleet/plates";
import { getCurrentRecords } from "@/lib/debt/store";
import { KIND_LABEL, STATUS_LABEL, loadInsuranceRecords } from "@/lib/fleet/insurance-report";
import { loadFuelRecords, fuelFilterOptions, resolveRange } from "@/lib/fleet/fuel-report";
import { vehiclePnl } from "@/lib/fleet/vehicle-pnl";

export const dynamic = "force-dynamic";

type Row = Record<string, string | number | null>;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const DAY_MS = 86400000;
const bkkToday = () => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())}T00:00:00.000Z`);

// Each export: a file name and the rows (Thai column headers, numbers as numbers).
const EXPORTS: Record<string, (q: URLSearchParams) => Promise<{ name: string; rows: Row[] }>> = {
  async installments() {
    const today = bkkToday();
    const rows = await prisma.installmentsVehicle.findMany({
      where: { Vehicle: { TenantId: DEFAULT_TENANT_ID } },
      include: { Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true } } },
      orderBy: [{ DueDate: "asc" }, { InstallmentNumber: "asc" }],
    });
    return {
      name: "installments",
      rows: rows.map((i) => ({
        ทะเบียน: plateText(i.Vehicle) || i.Vehicle.Model,
        งวดที่: i.InstallmentNumber,
        ครบกำหนด: day(i.DueDate),
        ยอด: dec(i.Amount),
        วันที่ชำระ: day(i.DatePay),
        สถานะ: i.DatePay ? "ชำระแล้ว" : i.DueDate < today ? "เกินกำหนด" : "ยังไม่ถึงกำหนด",
        เกินกำหนดวัน: !i.DatePay && i.DueDate < today ? Math.floor((today.getTime() - i.DueDate.getTime()) / DAY_MS) : null,
      })),
    };
  },

  async debt() {
    const today = bkkToday();
    const { records } = await getCurrentRecords();
    return {
      name: "debt",
      rows: records.map((r) => ({
        เลขที่เอกสาร: r.docNo,
        ประเภท: r.docType,
        วันที่: r.date ?? "",
        ลูกค้า: r.customer,
        โครงการ: r.project,
        ครบกำหนด: r.dueDate ?? "",
        มูลค่า: r.value,
        VAT: r.vat,
        ยอดรวม: r.total,
        สถานะ: r.status,
        พนักงานขาย: r.salesperson,
        เกินกำหนดวัน: r.dueDate && Date.parse(r.dueDate) < today.getTime() ? Math.floor((today.getTime() - Date.parse(r.dueDate)) / DAY_MS) : null,
      })),
    };
  },

  async insurance() {
    const rows = await loadInsuranceRecords();
    return {
      name: "insurance",
      rows: rows
        .sort((a, b) => a.end.localeCompare(b.end))
        .map((r) => ({
          ประเภท: KIND_LABEL[r.kind],
          ทะเบียน: r.plate,
          รุ่น: r.model,
          บริษัท: r.company,
          โบรกเกอร์: r.broker,
          ชั้น: r.cls,
          เริ่ม: r.start ?? "",
          สิ้นสุด: r.end,
          เหลือวัน: r.days,
          สถานะ: STATUS_LABEL[r.status],
          เบี้ย: r.premium,
          หมายเหตุ: r.note,
        })),
    };
  },

  async fuel(q) {
    const opts = await fuelFilterOptions();
    const { from, to } = resolveRange({ from: q.get("from") ?? undefined, to: q.get("to") ?? undefined }, opts.latestMonth);
    const rows = await loadFuelRecords({ from, to, vehicleId: q.get("vehicle") || undefined, receiver: q.get("receiver") || undefined });
    return {
      name: `fuel-${from}_${to}`,
      rows: rows.map((r) => ({
        วันที่: r.date,
        ทะเบียน: r.plate,
        รายการ: r.item,
        เลขใบกำกับ: r.invoice,
        ลิตร: r.liters,
        จำนวนเงิน: r.amount,
        เลขไมล์เริ่ม: r.odoStart,
        เลขไมล์สิ้นสุด: r.odoEnd,
        ผู้รับ: r.receiver,
      })),
    };
  },

  async "vehicle-pnl"(q) {
    const y = Number(q.get("year"));
    const year = Number.isInteger(y) && y > 2000 && y < 2200 ? y : new Date().getUTCFullYear();
    const rows = await vehiclePnl(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)));
    return {
      name: `vehicle-pnl-${year + 543}`,
      rows: rows.map((r) => ({
        ทะเบียน: r.plate,
        รุ่น: r.model,
        รายรับ: r.income,
        น้ำมัน: r.fuel,
        ซ่อม: r.repair,
        "ภาษี/ประกัน": r.premiums,
        ต้นทุนรวม: r.expense,
        สุทธิ: r.net,
      })),
    };
  },
};

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  if (!(await getSession())) return new Response("unauthorized", { status: 401 });
  const { kind } = await ctx.params;
  const build = Object.hasOwn(EXPORTS, kind) ? EXPORTS[kind] : null;
  if (!build) return new Response("not found", { status: 404 });

  const { name, rows } = await build(new URL(req.url).searchParams);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "data");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
