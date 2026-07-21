import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateRecordStatus } from "@/lib/debt/store";
import { STATUS_LIST, type DebtStatus } from "@/lib/debt/types";

export async function POST(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { docNo, status } = await req.json().catch(() => ({}));
  if (!docNo || !STATUS_LIST.includes(status)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const ok = await updateRecordStatus(docNo, status as DebtStatus);
  return NextResponse.json({ ok });
}
