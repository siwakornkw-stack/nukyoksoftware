import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { monthlyByEmployee } from "@/lib/fuel/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await monthlyByEmployee());
}
