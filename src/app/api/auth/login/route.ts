import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  const user = await prisma.customer.findFirst({
    where: { TenantId: DEFAULT_TENANT_ID, Username: username, Status: "active" },
  });
  if (!user || !(await verifyPassword(password, user.PasswordHash))) {
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const token = signToken({
    sub: user.CustomerId,
    username: user.Username,
    role: user.Role,
    name: user.Name ?? undefined,
    tenantId: user.TenantId,
  });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
