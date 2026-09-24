import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLineAdminId } from "@/lib/fuel/settings";
import { alertAdmin } from "@/lib/fuel/line";
import { addMonths } from "@/lib/fleet/fuel-report";
import { monthTrend } from "@/lib/fleet/trend";
import { vehiclePnl } from "@/lib/fleet/vehicle-pnl";
import { driverMonth } from "@/lib/fleet/driver-summary";
import { getCurrentRecords } from "@/lib/debt/store";
import { computeSummary } from "@/lib/debt/summary";
import { dec } from "@/lib/fleet/queries";

export const dynamic = "force-dynamic";

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

// 1st of the month (worker): the previous month for the LINE admins. ?month=YYYY-MM
// picks another month (manual re-run).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("month") ?? "";
  const thisMonth = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(q) ? q : addMonths(thisMonth, -1);
  // vehiclePnl works on UTC dates, like the /fleet/reports/vehicles page.
  const utcFrom = new Date(`${month}-01T00:00:00Z`);
  const utcTo = new Date(`${addMonths(month, 1)}-01T00:00:00Z`);

  const [[point], [prev], pnl, drivers, { records }, collected] = await Promise.all([
    monthTrend(month, 1),
    monthTrend(addMonths(month, -1), 1),
    vehiclePnl(utcFrom, utcTo),
    driverMonth(month),
    getCurrentRecords(),
    prisma.debtPayment.aggregate({ where: { paidAt: { gte: `${month}-01`, lt: `${addMonths(month, 1)}-01` } }, _sum: { amount: true } }),
  ]);
  const cost = point.fuel + point.repair;
  const prevCost = prev.fuel + prev.repair;
  const change = (now: number, before: number) => (before ? ` (${now >= before ? "+" : ""}${Math.round(((now - before) / before) * 100)}%)` : "");
  const debt = computeSummary(records);
  const losing = pnl.filter((r) => r.net < 0).slice(0, 3);

  const text = [
    `สรุปเดือน${TH_MONTH[Number(month.slice(5)) - 1]} ${Number(month.slice(0, 4)) + 543}`,
    `รายรับรถ: ${baht(point.income)} บาท${change(point.income, prev.income)}`,
    `ค่าน้ำมัน: ${baht(point.fuel)} · ค่าซ่อม: ${baht(point.repair)} บาท`,
    `ต้นทุนรวม: ${baht(cost)} บาท${change(cost, prevCost)}`,
    `สุทธิ (ก่อนภาษี/ประกัน): ${baht(point.income - cost)} บาท`,
    `งานวิ่งที่ปิด: ${drivers.reduce((a, d) => a + d.jobs, 0)} งาน (${baht(drivers.reduce((a, d) => a + d.amount, 0))} บาท)`,
    losing.length ? `คันที่ขาดทุน: ${losing.map((r) => `${r.plate} ${baht(r.net)}`).join(", ")}` : "ไม่มีคันที่ขาดทุน",
    `หนี้ลูกค้าคงค้างตอนนี้: ${baht(debt.outstandingAmount)} บาท (เกินกำหนด ${baht(debt.overdueAmount)})`,
    `รับชำระหนี้ที่บันทึกในเว็บเดือนนี้: ${baht(dec(collected._sum.amount))} บาท`,
  ].join("\n");

  let pushed = false;
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    await alertAdmin(await getLineAdminId(), text);
    pushed = true;
  }
  return NextResponse.json({ ok: true, month, pushed, text });
}
