import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  // Strings only: an object username ({ equals: "admin" }) would reach Prisma as a
  // filter and let a password be tried without knowing the account name.
  const username = typeof b.username === "string" ? b.username : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  const user = await prisma.customer.findFirst({
    where: { TenantId: DEFAULT_TENANT_ID, Username: username, Status: "active" },
  });
  if (!user || !(await verifyPassword(password, user.PasswordHash))) {
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  await prisma.customer.update({ where: { CustomerId: user.CustomerId }, data: { LatestLogin: new Date() } });

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
