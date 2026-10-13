import { NextResponse } from "next/server";
import { bearerOk } from "@/lib/cron-auth";
import { syncStale } from "@/lib/po/purchase-orders";
import { getToday } from "@/lib/today";
import { getLineAdminId } from "@/lib/fuel/settings";
import { alertAdmin } from "@/lib/fuel/line";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const bkkTime = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

// Morning summary to the LINE admins (worker, 08:00 Bangkok). A missing or old
// backup also raises an ops alert, so it shows in the web inbox too.
export async function GET(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [t, po] = await Promise.all([getToday(), syncStale()]);
  // 08:00: the office PC may still be off overnight, so a stale sync is only
  // reported here; the hourly check from 09:00 raises the alert.
  const poLine = !po.at
    ? "⚠️ ยังไม่เคยดึง PO จาก Express"
    : `${po.stale ? "⚠️" : "✅"} ดึง PO จาก Express ล่าสุด ${bkkTime(po.at)}`;

  const backupLine = !t.backup
    ? "⚠️ ยังไม่มีรายงาน backup"
    : t.backup.stale
      ? `⚠️ backup ล่าสุดไม่สำเร็จหรือเก่าเกินไป (${bkkTime(t.backup.at)}${t.backup.message ? `: ${t.backup.message}` : ""})`
      : `✅ backup ${bkkTime(t.backup.at)} ${t.backup.size ? `${Math.round(t.backup.size / 1024)} KB` : ""}${t.backup.offsite ? " + Google Drive" : ""}`;

  const text = [
    "สรุปประจำวัน เทวาวณิชกิจ",
    backupLine,
    poLine,
    `ภาษี/พ.ร.บ./ประกัน: หมดอายุ ${t.renewals.expired} · ใกล้หมด 30 วัน ${t.renewals.due30}`,
    `ค่างวดเกินกำหนด: ${t.installments.overdue} งวด (${baht(t.installments.overdueAmount)} บาท)`,
    `หนี้ลูกค้าเกินกำหนด: ${t.debt.overdue} รายการ (${baht(t.debt.overdueAmount)} บาท)`,
    `บิลน้ำมันน่าสงสัย 7 วัน: ${t.fuelSuspect7d}`,
    `น้ำมันเครื่องเกินระยะ: ${t.oilOverdue} คัน`,
    `ยางครบกำหนด: ${t.tiresOverdue} เส้น · รถอยู่อู่: ${t.inShop} คัน · เกินงบเดือนนี้: ${t.overBudget} คัน`,
    `สินทรัพย์เลยกำหนดคืน: ${t.loansOverdue}`,
  ].join("\n");

  let pushed = false;
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    await alertAdmin(await getLineAdminId(), text);
    pushed = true;
  }
  if (!t.backup || t.backup.stale) await opsAlert("backup-stale", "Backup ไม่เป็นปัจจุบัน", backupLine);
  return NextResponse.json({ ok: true, pushed, text });
}
