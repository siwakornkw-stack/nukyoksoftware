import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { put, del } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { dec } from "@/lib/fleet/queries";
import { PAY_METHODS as METHODS } from "@/lib/debt/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const SLIP_EXT = ["jpg", "jpeg", "png", "webp", "pdf"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const currentRecord = (docNo: string) =>
  prisma.debtRecord.findFirst({ where: { docNo, version: { isCurrent: true } } });

// Re-sum the payments and keep the status in step: fully paid -> ชำระแล้ว; a
// deleted payment that reopens a balance puts a ชำระแล้ว row back to วางบิลแล้ว.
async function resync(recordId: string) {
  const r = await prisma.debtRecord.findUniqueOrThrow({ where: { id: recordId } });
  const sum = await prisma.debtPayment.aggregate({ where: { recordId }, _sum: { amount: true } });
  const paid = dec(sum._sum.amount);
  const total = dec(r.total);
  const status = paid >= total && total > 0 ? "ชำระแล้ว" : r.status === "ชำระแล้ว" ? "วางบิลแล้ว" : r.status;
  await prisma.debtRecord.update({ where: { id: recordId }, data: { paid, status } });
}

// ?docNo=  -> the record in the current version, its payments and the follow-up log.
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const docNo = new URL(req.url).searchParams.get("docNo") ?? "";
  const r = docNo ? await currentRecord(docNo) : null;
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [payments, followUps] = await Promise.all([
    prisma.debtPayment.findMany({ where: { recordId: r.id }, orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] }),
    prisma.debtFollowUp.findMany({ where: { docNo }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    record: { docNo: r.docNo, customer: r.customer, total: dec(r.total), paid: dec(r.paid), status: r.status, dueDate: r.dueDate },
    payments: payments.map((p) => ({ ...p, amount: dec(p.amount) })),
    followUps,
  });
}

// multipart: docNo, amount, paidAt (YYYY-MM-DD), method, note, slip (optional file)
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  const docNo = String(form.get("docNo") ?? "").trim();
  const amount = Math.round(Number(form.get("amount")) * 100) / 100;
  const paidAt = String(form.get("paidAt") ?? "");
  const method = String(form.get("method") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  if (!docNo || !(amount > 0) || !ISO.test(paidAt) || !METHODS.includes(method)) {
    return NextResponse.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
  }
  const r = await currentRecord(docNo);
  if (!r) return NextResponse.json({ error: "ไม่พบเอกสารในข้อมูลปัจจุบัน" }, { status: 404 });
  if (r.status === "ยกเลิก") return NextResponse.json({ error: "เอกสารถูกยกเลิกแล้ว" }, { status: 400 });
  const due = dec(r.total) - dec(r.paid);
  if (amount > due + 0.005) return NextResponse.json({ error: `ยอดเกินยอดค้าง (${due.toLocaleString()} บาท)` }, { status: 400 });

  let slipUrl: string | null = null;
  const slip = form.get("slip");
  if (slip instanceof File && slip.size) {
    if (slip.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 413 });
    const ext = (slip.name.includes(".") ? slip.name.split(".").pop()! : "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!SLIP_EXT.includes(ext)) return NextResponse.json({ error: `ไม่รองรับไฟล์ .${ext || "?"}` }, { status: 400 });
    slipUrl = (await put(`debt/slips/${randomUUID()}.${ext}`, Buffer.from(await slip.arrayBuffer()))).url;
  }

  const p = await prisma.debtPayment.create({
    data: { recordId: r.id, amount, paidAt, method, note, slipUrl, createdBy: s.username },
  });
  await resync(r.id);
  await audit("debt-payment", p.id, "create", s.username, null, { docNo, amount, paidAt, method, note, slipUrl });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// ?id=  (admin: deleting money data)
export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const p = id ? await prisma.debtPayment.findUnique({ where: { id }, include: { record: { select: { docNo: true } } } }) : null;
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.debtPayment.delete({ where: { id } });
  await resync(p.recordId);
  if (p.slipUrl) await del(p.slipUrl.replace(/^\/uploads\//, ""));
  await audit("debt-payment", id, "delete", s.username, { docNo: p.record.docNo, amount: dec(p.amount), paidAt: p.paidAt, method: p.method }, null);
  return NextResponse.json({ ok: true });
}
