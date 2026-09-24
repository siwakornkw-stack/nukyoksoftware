import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// { docNo, note, promiseDate? }  One collection call / visit / promise.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  const docNo = typeof b.docNo === "string" ? b.docNo.trim() : "";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
  const promiseDate = typeof b.promiseDate === "string" && ISO.test(b.promiseDate) ? b.promiseDate : null;
  if (!docNo || !note) return NextResponse.json({ error: "กรอกบันทึกก่อน" }, { status: 400 });
  const r = await prisma.debtRecord.findFirst({ where: { docNo, version: { isCurrent: true } }, select: { customer: true } });
  if (!r) return NextResponse.json({ error: "ไม่พบเอกสารในข้อมูลปัจจุบัน" }, { status: 404 });
  const f = await prisma.debtFollowUp.create({
    data: { docNo, customer: r.customer, note, promiseDate, createdBy: s.username },
  });
  await audit("debt-followup", f.id, "create", s.username, null, { docNo, note, promiseDate });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// ?id=  (admin)
export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const f = id ? await prisma.debtFollowUp.findUnique({ where: { id } }) : null;
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.debtFollowUp.delete({ where: { id } });
  await audit("debt-followup", id, "delete", s.username, f, null);
  return NextResponse.json({ ok: true });
}
