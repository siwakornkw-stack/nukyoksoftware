import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { updateRecordStatus } from "@/lib/debt/store";
import { STATUS_LIST, type DebtStatus } from "@/lib/debt/types";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { docNo, status } = (await req.json().catch(() => null)) ?? {};
  // docNo must be a string: an object ({ not: "" }) would be a Prisma filter and
  // update every record of the current version.
  if (typeof docNo !== "string" || !docNo || !STATUS_LIST.includes(status)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const before = await prisma.debtRecord.findFirst({
    where: { docNo, version: { isCurrent: true } },
    select: { status: true },
  });
  const ok = await updateRecordStatus(docNo, status as DebtStatus);
  if (ok) await audit("debt", docNo, "status", s.username, before, { status });
  return NextResponse.json({ ok });
}
