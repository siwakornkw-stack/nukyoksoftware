import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { readVersions, setCurrentVersion } from "@/lib/debt/store";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await readVersions());
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const { id } = (await req.json().catch(() => null)) ?? {};
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const ok = await setCurrentVersion(id);
  if (ok) await audit("debt-version", id, "set-current", s.username);
  return NextResponse.json({ ok });
}
