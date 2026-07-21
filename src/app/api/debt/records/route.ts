import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentRecords } from "@/lib/debt/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { meta, records } = await getCurrentRecords();
  return NextResponse.json({ meta, records });
}
