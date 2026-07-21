import crypto from "crypto";
import * as fuelDb from "@/lib/fuel/db";
import { extractBill } from "@/lib/fuel/extract";
import { checkFraud } from "@/lib/fuel/fraud";
import { textReport } from "@/lib/fuel/report";
import * as lineApi from "@/lib/fuel/line";
import { sha256, compressImage, storeBillImage } from "@/lib/fuel/image";
import { getLineAdminId } from "@/lib/fuel/settings";

export const dynamic = "force-dynamic";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; id: string; text?: string };
}

function bkkMonth(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}`;
}

async function handleImage(ev: LineEvent) {
  const userId = ev.source?.userId;
  const replyToken = ev.replyToken;
  if (!userId || !replyToken || !ev.message) return;

  await lineApi.acknowledgeImage(replyToken, userId, "📸 ได้รับบิลแล้ว กำลังตรวจสอบ...");
  const ym = bkkMonth();

  let buf: Buffer;
  try {
    const original = await lineApi.downloadImage(ev.message.id);
    buf = await compressImage(original);
  } catch {
    await lineApi.reply(replyToken, "ดาวน์โหลดรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง");
    return;
  }

  const hash = sha256(buf);
  const employeeName = await lineApi.displayName(userId);

  let extracted;
  try {
    extracted = await extractBill(buf, "image/jpeg");
  } catch {
    const { url } = await storeBillImage(buf, ym);
    await fuelDb.insertBill({
      lineUserId: userId,
      employeeName,
      imageUrl: url,
      imageHash: hash,
      status: "extract_failed",
      suspectReasons: "อ่านบิลด้วย AI ไม่สำเร็จ",
    });
    await lineApi.reply(replyToken, "อ่านบิลไม่สำเร็จ ลองถ่ายให้ชัดขึ้นแล้วส่งใหม่");
    return;
  }

  if (!extracted.is_fuel_bill) {
    await lineApi.reply(replyToken, "รูปนี้ไม่ใช่บิลเติมน้ำมัน กรุณาส่งเฉพาะบิลน้ำมัน");
    return;
  }

  const { url } = await storeBillImage(buf, ym);
  const bill = {
    receiptNo: extracted.receipt_no,
    station: extracted.station,
    billDate: extracted.bill_date,
    billTime: extracted.bill_time,
    fuelType: extracted.fuel_type,
    liters: extracted.liters,
    pricePerLiter: extracted.price_per_liter,
    total: extracted.total,
    plate: extracted.plate,
  };

  const [dupHash, dupReceipt, dupBill, lastBill] = await Promise.all([
    fuelDb.findByHash(hash),
    fuelDb.findByReceiptNo(bill.receiptNo),
    fuelDb.findDuplicateBill(bill),
    fuelDb.lastBillOf(userId),
  ]);
  const reasons = checkFraud({
    bill,
    duplicateByHash: dupHash,
    duplicateByReceipt: dupReceipt,
    duplicateBill: dupBill,
    lastBill,
  });
  const status = reasons.length ? "suspect" : "ok";

  const saved = await fuelDb.insertBill({
    lineUserId: userId,
    employeeName,
    imageUrl: url,
    imageHash: hash,
    receiptNo: bill.receiptNo,
    station: bill.station,
    billDate: bill.billDate,
    billTime: bill.billTime,
    fuelType: bill.fuelType,
    liters: bill.liters,
    pricePerLiter: bill.pricePerLiter,
    total: bill.total,
    plate: bill.plate,
    status,
    suspectReasons: reasons.join(" | ") || null,
  });

  const summaryText = [
    `บิล #${saved.id} บันทึกแล้ว`,
    bill.station ? `ปั๊ม: ${bill.station}` : null,
    bill.billDate ? `วันที่: ${bill.billDate} ${bill.billTime ?? ""}`.trim() : null,
    bill.liters != null ? `${bill.liters} ลิตร` : null,
    bill.total != null ? `${bill.total} บาท` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (status === "suspect") {
    await lineApi.reply(replyToken, `⚠️ บิลนี้น่าสงสัย\n${summaryText}\n\n${reasons.join("\n")}`);
    const admins = await getLineAdminId();
    const empLabel = employeeName || userId;
    await lineApi.alertAdmin(
      admins,
      `⚠️ พบบิลน่าสงสัยจาก ${empLabel}\nบิล #${saved.id}\n${summaryText}\n\n${reasons.join("\n")}`
    );
  } else {
    await lineApi.reply(replyToken, `✅ บันทึกบิลเรียบร้อย\n${summaryText}`);
  }
}

async function handleText(ev: LineEvent) {
  const text = (ev.message?.text || "").trim();
  const replyToken = ev.replyToken;
  const userId = ev.source?.userId;
  if (!replyToken) return;

  if (text === "id") {
    await lineApi.reply(replyToken, `LINE userId ของคุณ:\n${userId ?? "(ไม่ทราบ)"}`);
    return;
  }
  const lower = text.toLowerCase();
  if (text.startsWith("รายงาน") || lower.startsWith("report")) {
    const parts = text.split(/\s+/);
    const ym = parts[1] && /^\d{4}-\d{2}$/.test(parts[1]) ? parts[1] : bkkMonth();
    const bills = await fuelDb.billsInMonth(ym);
    await lineApi.reply(replyToken, textReport(ym, bills));
  }
}

async function handleEvent(ev: LineEvent) {
  try {
    if (ev.type !== "message" || !ev.message) return;
    if (ev.message.type === "image") await handleImage(ev);
    else if (ev.message.type === "text") await handleText(ev);
  } catch (e) {
    console.error("fuel webhook event error:", (e as Error)?.message);
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.LINE_CHANNEL_SECRET?.trim() || "";
  const sig = req.headers.get("x-line-signature") || "";
  const expected = secret ? crypto.createHmac("sha256", secret).update(raw).digest("base64") : "";
  if (!secret || sig !== expected) {
    return new Response("bad signature", { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Long-lived Node server: ack immediately, process in the background.
  for (const ev of body.events ?? []) void handleEvent(ev);
  return new Response("OK");
}
