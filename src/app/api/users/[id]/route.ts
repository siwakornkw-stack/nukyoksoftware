import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin, hashPassword } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { MIN_PASSWORD, ROLES } from "@/lib/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Admin edits another account: role, active/inactive, or a password reset.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  const { id } = await ctx.params;
  const user = await prisma.customer.findFirst({ where: { CustomerId: id, TenantId: DEFAULT_TENANT_ID } });
  if (!user) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data: { Role?: string; Status?: string; PasswordHash?: string; UpdatedByUsername: string; UpdatedTime: Date } = {
    UpdatedByUsername: s.username,
    UpdatedTime: new Date(),
  };

  if ("role" in b) {
    if (!ROLES.includes(b.role)) return NextResponse.json({ error: "สิทธิ์ไม่ถูกต้อง" }, { status: 400 });
    data.Role = b.role;
  }
  if ("status" in b) {
    if (b.status !== "active" && b.status !== "inactive") {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }
    data.Status = b.status;
  }
  // An admin demoting or disabling their own account could leave nobody able
  // to manage users.
  if (id === s.sub && (data.Role === "staff" || data.Status === "inactive")) {
    return NextResponse.json({ error: "ลดสิทธิ์หรือปิดบัญชีของตัวเองไม่ได้" }, { status: 400 });
  }
  if ("password" in b) {
    if (typeof b.password !== "string" || b.password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` }, { status: 400 });
    }
    data.PasswordHash = await hashPassword(b.password);
  }

  await prisma.customer.update({ where: { CustomerId: id }, data });
  // Never the hash itself; only that a reset happened.
  await audit(
    "user",
    id,
    "update",
    s.username,
    { Username: user.Username, Role: user.Role, Status: user.Status },
    { Role: data.Role ?? user.Role, Status: data.Status ?? user.Status, passwordReset: Boolean(data.PasswordHash) }
  );
  return NextResponse.json({ ok: true });
}
