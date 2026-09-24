import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";
import { newTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Two-step login for the signed-in user.
//   setup   -> new secret (not active yet) + QR code for the authenticator app
//   enable  -> confirm with a code from the app; from then on login asks for one
//   disable -> requires the current password
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Admins must have it (the app layout sends them here until they do).
  return NextResponse.json({ enabled: !!s.mfa, required: s.role === "admin" });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  const user = await prisma.customer.findUnique({
    where: { CustomerId: s.sub },
    select: { TotpSecret: true, TotpEnabled: true, PasswordHash: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (b.action === "setup") {
    if (user.TotpEnabled) return NextResponse.json({ error: "เปิดใช้อยู่แล้ว" }, { status: 400 });
    const secret = newTotpSecret();
    await prisma.customer.update({ where: { CustomerId: s.sub }, data: { TotpSecret: secret, TotpEnabled: false } });
    const uri = otpauthUri(secret, s.username);
    const qr = await QRCode.toString(uri, { type: "svg", margin: 1, width: 200 });
    return NextResponse.json({ secret, qr });
  }

  if (b.action === "enable") {
    const code = typeof b.code === "string" ? b.code : "";
    if (!user.TotpSecret) return NextResponse.json({ error: "เริ่มตั้งค่าใหม่อีกครั้ง" }, { status: 400 });
    if (!verifyTotp(user.TotpSecret, code, s.sub)) {
      return NextResponse.json({ error: "รหัสไม่ถูกต้อง ตรวจเวลาในโทรศัพท์แล้วลองใหม่" }, { status: 400 });
    }
    await prisma.customer.update({ where: { CustomerId: s.sub }, data: { TotpEnabled: true } });
    await audit("user", s.sub, "enable-2fa", s.username);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "disable") {
    const password = typeof b.password === "string" ? b.password : "";
    if (!(await verifyPassword(password, user.PasswordHash))) {
      return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 400 });
    }
    await prisma.customer.update({ where: { CustomerId: s.sub }, data: { TotpEnabled: false, TotpSecret: null } });
    await audit("user", s.sub, "disable-2fa", s.username);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
