import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const drivers = await prisma.vehicleDriver.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    orderBy: { Name: "asc" },
  });
  return NextResponse.json({ drivers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.name) return NextResponse.json({ error: "ต้องระบุชื่อคนขับ" }, { status: 400 });
  const driver = await prisma.vehicleDriver.create({
    data: {
      TenantId: DEFAULT_TENANT_ID,
      Status: "active",
      Name: b.name,
      MobileNo: b.mobileNo || null,
      LicenseNo: b.licenseNo || null,
      LineUserId: b.lineUserId || null,
      CreatedByUsername: session.username,
    },
  });
  return NextResponse.json({ driver });
}
