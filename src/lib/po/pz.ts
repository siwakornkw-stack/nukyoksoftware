// Paying a PK's R3 back to the card owner from a bank transfer slip (one slip
// per bill, the owner's choice 2026-10-28). Once the R3 exists an admin uploads
// the slip on the PK page: it is stored, read by Gemini (a K-BIZ image or an SCB
// payment advice PDF), checked against the R3 and queued as a PkPayment. The
// office PC writes the PZ (PZ-จ่ายชำระหนี้-น้ำมัน) into Express
// (scripts/express/pz.mjs, EXPRESS_PZ_MODE) and reports back through
// /api/cron/express-pz.
import { randomUUID } from "crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { put } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { extractSlip } from "@/lib/fuel/extract";
import { normalizeDate, toISO } from "@/lib/fleet/dates";
import { getFuelMasters, type FuelMasters } from "@/lib/fleet/express-fuel";
import { isPk, poSchema } from "./purchase-orders";
import { matchBank } from "./pz-match";

export type Bank = FuelMasters["banks"][number];

// Only slips this feature stored itself may be attached.
export const SLIP_URL = /^\/uploads\/po-slips\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|pdf)$/;

const r2 = (n: number) => Math.round(n * 100) / 100;
const todayBkk = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

// Stored before it is read, like the fuel bill photos. An image becomes a JPEG
// (at most 2000 px); a PDF is kept as it is. Throws when it is neither.
export async function storeSlip(file: Buffer): Promise<{ url: string; buf: Buffer; mediaType: string }> {
  const month = new Date().toISOString().slice(0, 7);
  if (file.subarray(0, 5).toString("latin1") === "%PDF-") {
    const { url } = await put(`po-slips/${month}/${randomUUID()}.pdf`, file);
    return { url, buf: file, mediaType: "application/pdf" };
  }
  const buf = await sharp(file)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const { url } = await put(`po-slips/${month}/${randomUUID()}.jpg`, buf);
  return { url, buf, mediaType: "image/jpeg" };
}

export async function readSlip(buf: Buffer, mediaType: string, banks: Bank[]) {
  const s = await extractSlip(buf, mediaType);
  const date = toISO(normalizeDate(s.date ?? ""));
  return {
    isSlip: s.is_slip,
    amount: s.amount && s.amount > 0 ? r2(s.amount) : 0,
    date: date ?? "",
    time: s.time ?? "",
    fromName: s.from_name ?? "",
    fromAccount: s.from_account ?? "",
    toName: s.to_name ?? "",
    toAccount: s.to_account ?? "",
    ref: (s.reference ?? "").replace(/\s+/g, "").slice(0, 40),
    payType: matchBank(s.from_account ?? "", banks),
  };
}

// The R3 a PK's payment pays, with its amount as last read from Express.
export function r3Of(row: { R3DocNo: string | null; Data: unknown }) {
  if (!row.R3DocNo) return null;
  const receipts = poSchema.shape.receipts.parse((row.Data as { receipts?: unknown } | null)?.receipts);
  const r = receipts.find((x) => x.docNo === row.R3DocNo && x.docStat !== "C");
  return r ? { docNo: r.docNo, date: r.date, amount: r.netAmt } : null;
}

export interface PayInput {
  poNo: string;
  slipUrl: string;
  amount: number;
  date: string;
  payType: string;
  ref: string;
}

// Checks one payment against the PK, its R3 and the Express master data; the
// error is Thai. Pure, so the rules are tested.
export function checkPayment(
  p: PayInput,
  po: { PoNo: string; ApprovalStatus: string | null; MissingInExpress: boolean; R3DocNo: string | null; Data: unknown },
  masters: Pick<FuelMasters, "banks" | "pzWriter"> | null,
  today = todayBkk()
): { error: string } | { r3: NonNullable<ReturnType<typeof r3Of>> } {
  if (!masters?.pzWriter) return { error: "การเปิด PZ จากสลิปยังไม่เปิดใช้" };
  if (!isPk(po.PoNo)) return { error: "จ่ายด้วยสลิปได้เฉพาะใบสั่งซื้อน้ำมันใหม่ (PK)" };
  if (po.MissingInExpress) return { error: "ใบนี้ถูกลบใน Express แล้ว" };
  if (po.ApprovalStatus !== "approved") return { error: "ต้องอนุมัติ PK ก่อน" };
  const r3 = r3Of(po);
  if (!r3) return { error: "ยังไม่มี R3 ของใบนี้ใน Express (รอระบบสร้าง R3 แล้วดึงข้อมูลกลับมา 1-2 นาที)" };
  if (!SLIP_URL.test(p.slipUrl)) return { error: "อัปโหลดสลิปก่อน" };
  if (!(p.amount > 0)) return { error: "ใส่ยอดเงินที่โอน" };
  if (r2(p.amount) !== r2(r3.amount)) return { error: `ยอดในสลิป ${r2(p.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} ไม่เท่ากับยอด ${r3.docNo} (${r3.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })})` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return { error: "ใส่วันที่โอน" };
  if (p.date > today) return { error: "วันที่โอนเป็นวันในอนาคต" };
  if (r3.date && p.date < r3.date) return { error: `วันที่โอนอยู่ก่อนวันที่ของ ${r3.docNo}` };
  if (!masters.banks.some((b) => b.code === p.payType)) return { error: "เลือกบัญชีธนาคารที่โอนออก" };
  return { r3 };
}

// Queue the payment (or replace a failed one). Answers { error } or the row.
export async function queuePayment(p: PayInput, username: string) {
  const [po, masters] = await Promise.all([
    prisma.purchaseOrder.findUnique({ where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: p.poNo } }, include: { Payment: true } }),
    getFuelMasters(),
  ]);
  if (!po) return { error: "ไม่พบใบสั่งซื้อ" };
  const c = checkPayment(p, po, masters);
  if ("error" in c) return c;
  const prev = po.Payment;
  if (prev?.Status === "done") return { error: `ใบนี้จ่ายแล้ว (${prev.PzNo ?? "PZ"})` };
  if (prev?.Status === "queued") return { error: "กำลังเปิด PZ ของใบนี้ใน Express อยู่" };

  const data = {
    Status: "queued",
    R3DocNo: c.r3.docNo,
    PayDate: new Date(`${p.date}T00:00:00Z`),
    Amount: r2(p.amount),
    PayType: p.payType,
    BankRef: p.ref || null,
    SlipUrl: p.slipUrl,
    PzNo: null,
    Error: null,
    RequestedBy: username,
  };
  try {
    const row = prev
      ? // a failed one: only while it is still failed (two admins at once)
        await prisma.pkPayment.update({ where: { PkPaymentId: prev.PkPaymentId, Status: "error" }, data })
      : await prisma.pkPayment.create({ data: { ...data, TenantId: DEFAULT_TENANT_ID, PurchaseOrderId: po.PurchaseOrderId } });
    await audit("PkPayment", row.PkPaymentId, prev ? "requeue" : "queue", username, prev, row);
    return { row };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2025")) return { error: "มีคนบันทึกการจ่ายของใบนี้พร้อมกัน ลองรีเฟรชหน้า" };
    throw e;
  }
}

export const PAY_STATUS_LABEL: Record<string, string> = { queued: "กำลังเปิด PZ", done: "จ่ายแล้ว", error: "เปิด PZ ไม่สำเร็จ" };
