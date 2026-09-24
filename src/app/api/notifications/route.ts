import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Notifications belong to the signed-in user (session.sub = CustomerId).
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const unread = await prisma.notification.count({ where: { CustomerId: s.sub, IsRead: false } });
  if (new URL(req.url).searchParams.get("count") === "1") return NextResponse.json({ unread });
  const notifications = await prisma.notification.findMany({
    where: { CustomerId: s.sub },
    orderBy: { CreatedTime: "desc" },
    take: 200,
  });
  return NextResponse.json({ unread, notifications });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "readAll") {
    await prisma.notification.updateMany({ where: { CustomerId: s.sub, IsRead: false }, data: { IsRead: true } });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "read") {
    const id = typeof b.id === "string" ? b.id : "";
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    await prisma.notification.updateMany({ where: { NotificationId: id, CustomerId: s.sub }, data: { IsRead: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
