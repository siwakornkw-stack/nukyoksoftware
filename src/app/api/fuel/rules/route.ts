import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { RULES } from "@/lib/fuel/fraud";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(RULES);
}
