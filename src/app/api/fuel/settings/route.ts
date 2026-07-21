import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLineAdminId, setLineAdminId } from "@/lib/fuel/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ line_admin_id: await getLineAdminId() });
}

export async function POST(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { line_admin_id } = await req.json().catch(() => ({}));
  await setLineAdminId(String(line_admin_id ?? "").trim());
  return NextResponse.json({ ok: true });
}
