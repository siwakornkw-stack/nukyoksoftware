import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentRecords } from "@/lib/debt/store";
import { computeSummary } from "@/lib/debt/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { records } = await getCurrentRecords();
  return NextResponse.json(computeSummary(records));
}
