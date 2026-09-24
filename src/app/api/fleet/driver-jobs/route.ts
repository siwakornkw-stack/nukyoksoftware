import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { notifyDriverOfJob } from "@/lib/fleet/driver-line";

export const dynamic = "force-dynamic";

// Updates address a job by its id alone, so without this the tenant scope that
// guards every other query here would be missing on assign/cancel.
async function ownsJob(jobId: string): Promise<boolean> {
  const job = await prisma.driverJob.findUnique({
    where: { DriverJobId: jobId },
    select: { TenantId: true },
  });
  return job?.TenantId === DEFAULT_TENANT_ID;
}

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
  const b = (await req.json().catch(() => null)) ?? {};

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
    const lineSent = job.VehicleDriverId ? await notifyDriverOfJob(job.DriverJobId) : false;
    return NextResponse.json({ job, lineSent });
  }

  if (b.action === "assign") {
    if (!b.jobId) return NextResponse.json({ error: "ไม่พบงานที่จะมอบหมาย" }, { status: 400 });
    if (!(await ownsJob(b.jobId))) {
      return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
    }
    // An empty driver means "take the assignment back" — the picker offers that
    // as its first option, so it has to be a valid value, not a 400.
    const driverId = b.vehicleDriverId || null;
    await prisma.driverJob.update({
      where: { DriverJobId: b.jobId },
      data: {
        VehicleDriverId: driverId,
        Status: driverId ? "assigned" : "pending",
        RespondedAt: driverId ? new Date() : null,
      },
    });
    const lineSent = driverId ? await notifyDriverOfJob(b.jobId) : false;
    return NextResponse.json({ ok: true, lineSent });
  }

  if (b.action === "cancel") {
    if (!b.jobId) return NextResponse.json({ error: "ไม่พบงานที่จะยกเลิก" }, { status: 400 });
    if (!(await ownsJob(b.jobId))) {
      return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });
    }
    await prisma.driverJob.update({
      where: { DriverJobId: b.jobId },
      data: { Status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
