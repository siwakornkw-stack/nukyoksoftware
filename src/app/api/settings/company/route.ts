import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getCompany, setCompany } from "@/lib/company";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getCompany());
}

// { name, address, taxId, phone }  (admin)
export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const b = (await req.json().catch(() => null)) ?? {};
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const next = { name: str(b.name, 200), address: str(b.address, 500), taxId: str(b.taxId, 20), phone: str(b.phone, 50) };
  if (!next.name) return NextResponse.json({ error: "ต้องระบุชื่อบริษัท" }, { status: 400 });
  const before = await getCompany();
  await setCompany(next);
  await audit("company-profile", "company", "update", s.username, before, next);
  return NextResponse.json({ ok: true });
}
