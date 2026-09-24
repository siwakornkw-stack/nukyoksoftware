import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin, hashPassword } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { MIN_PASSWORD, ROLES } from "@/lib/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const users = await prisma.customer.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    select: { CustomerId: true, Username: true, Name: true, Role: true, Status: true, LatestLogin: true, CreatedTime: true, TotpEnabled: true },
    orderBy: { CreatedTime: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const b = (await req.json().catch(() => null)) ?? {};
  const username = str(b.username);
  const name = str(b.name);
  const password = typeof b.password === "string" ? b.password : "";
  const role = str(b.role) || "staff";
  if (!username) return NextResponse.json({ error: "ต้องระบุชื่อผู้ใช้" }, { status: 400 });
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` }, { status: 400 });
  }
  if (!ROLES.includes(role)) return NextResponse.json({ error: "สิทธิ์ไม่ถูกต้อง" }, { status: 400 });
  // "Admin" next to "admin" would be two accounts that look the same.
  const taken = await prisma.customer.findFirst({
    where: { TenantId: DEFAULT_TENANT_ID, Username: { equals: username, mode: "insensitive" } },
  });
  if (taken) return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 400 });

  const user = await prisma.customer.create({
    data: {
      TenantId: DEFAULT_TENANT_ID,
      Username: username,
      Name: name || null,
      Role: role,
      Status: "active",
      Password: "",
      PasswordHash: await hashPassword(password),
      MobileNo: "",
      LatestIpAddress: "",
      CreatedByUsername: s.username,
    },
    select: { CustomerId: true, Username: true },
  });
  await audit("user", user.CustomerId, "create", s.username, null, { Username: username, Role: role });
  return NextResponse.json({ user }, { status: 201 });
}
