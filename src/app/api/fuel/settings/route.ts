import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getLineAdminId, setLineAdminId } from "@/lib/fuel/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ line_admin_id: await getLineAdminId() });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const { line_admin_id } = await req.json().catch(() => ({}));
  await setLineAdminId(String(line_admin_id ?? "").trim());
  return NextResponse.json({ ok: true });
}
