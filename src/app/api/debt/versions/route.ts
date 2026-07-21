import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readVersions, setCurrentVersion } from "@/lib/debt/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await readVersions());
}

export async function POST(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const ok = await setCurrentVersion(id);
  return NextResponse.json({ ok });
}
