import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobs = await prisma.driverJob.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    include: { VehicleDriver: { select: { Name: true } } },
    orderBy: { CreatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "create") {
    if (!b.origin || !b.destination) {
      return NextResponse.json({ error: "ต้องระบุต้นทาง/ปลายทาง" }, { status: 400 });
    }
    const last = await prisma.driverJob.findFirst({
      where: { TenantId: DEFAULT_TENANT_ID, JobNo: { not: null } },
      orderBy: { JobNo: "desc" },
      select: { JobNo: true },
    });
    const job = await prisma.driverJob.create({
      data: {
        TenantId: DEFAULT_TENANT_ID,
        JobNo: (last?.JobNo ?? 0) + 1,
        VehicleDriverId: b.vehicleDriverId || null,
        Origin: b.origin,
        Destination: b.destination,
        ScheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
        Note: b.note || null,
        Status: b.vehicleDriverId ? "assigned" : "pending",
        CreatedByUsername: session.username,
      },
    });
    return NextResponse.json({ job });
  }

  if (b.action === "assign") {
    if (!b.jobId || !b.vehicleDriverId) {
      return NextResponse.json({ error: "missing jobId/driver" }, { status: 400 });
    }
    await prisma.driverJob.update({
      where: { DriverJobId: b.jobId },
      data: { VehicleDriverId: b.vehicleDriverId, Status: "assigned", RespondedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "cancel") {
    if (!b.jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });
    await prisma.driverJob.update({
      where: { DriverJobId: b.jobId },
      data: { Status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
