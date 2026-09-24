import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { verifyPassword, signToken, setSessionCookie, passwordVersion } from "@/lib/auth";
import { clientIp, loginLimiter } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/totp";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) ?? {};
  // Strings only: an object username ({ equals: "admin" }) would reach Prisma as a
  // filter and let a password be tried without knowing the account name.
  const username = typeof b.username === "string" ? b.username : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  // Checked before the password so a locked-out guesser learns nothing more.
  const ip = clientIp(req);
  const wait = loginLimiter.retryAfter(ip, username);
  if (wait > 0) {
    return NextResponse.json(
      { error: `ลองรหัสผ่านผิดหลายครั้ง กรุณารอ ${Math.ceil(wait / 60000)} นาทีแล้วลองใหม่` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } }
    );
  }

  const user = await prisma.customer.findFirst({
    where: { TenantId: DEFAULT_TENANT_ID, Username: username, Status: "active" },
  });
  if (!user || !(await verifyPassword(password, user.PasswordHash))) {
    loginLimiter.fail(ip, username);
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  // Two-step login: the password alone gets no cookie. A wrong code counts as a
  // failed attempt, so the same throttle covers guessing codes.
  if (user.TotpEnabled && user.TotpSecret) {
    const code = typeof b.code === "string" ? b.code : "";
    if (!code) return NextResponse.json({ needCode: true, error: "กรอกรหัส 6 หลักจากแอปยืนยันตัวตน" }, { status: 401 });
    if (!verifyTotp(user.TotpSecret, code, user.CustomerId)) {
      loginLimiter.fail(ip, username);
      return NextResponse.json({ needCode: true, error: "รหัสยืนยันไม่ถูกต้องหรือหมดเวลา" }, { status: 401 });
    }
  }
  loginLimiter.succeed(ip, username);

  await prisma.customer.update({ where: { CustomerId: user.CustomerId }, data: { LatestLogin: new Date() } });

  const token = signToken({
    sub: user.CustomerId,
    username: user.Username,
    role: user.Role,
    name: user.Name ?? undefined,
    tenantId: user.TenantId,
    pv: passwordVersion(user.PasswordHash),
  });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
