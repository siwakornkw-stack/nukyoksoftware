import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/users";

export const dynamic = "force-dynamic";

// The signed-in user changes their own password (current one required).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const current = typeof b.current === "string" ? b.current : "";
  const next = typeof b.next === "string" ? b.next : "";
  if (next.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` }, { status: 400 });
  }
  const user = await prisma.customer.findUnique({ where: { CustomerId: s.sub }, select: { PasswordHash: true } });
  if (!user || !(await verifyPassword(current, user.PasswordHash))) {
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }
  await prisma.customer.update({
    where: { CustomerId: s.sub },
    data: { PasswordHash: await hashPassword(next), UpdatedByUsername: s.username, UpdatedTime: new Date() },
  });
  return NextResponse.json({ ok: true });
}
