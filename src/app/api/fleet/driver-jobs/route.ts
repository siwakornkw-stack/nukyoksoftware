import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { notifyDriverOfJob } from "@/lib/fleet/driver-line";
import { completeJob } from "@/lib/fleet/driver-jobs";
import { createBill } from "@/lib/fleet/driver-bills";
import { isInShop } from "@/lib/fleet/repair";

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

const ownsDriver = async (id: string) =>
  !!(await prisma.vehicleDriver.findFirst({ where: { VehicleDriverId: id, TenantId: DEFAULT_TENANT_ID }, select: { VehicleDriverId: true } }));
const ownsVehicle = async (id: string) =>
  !!(await prisma.vehicle.findFirst({ where: { VehicleId: id, TenantId: DEFAULT_TENANT_ID }, select: { VehicleId: true } }));

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobs = await prisma.driverJob.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    include: { VehicleDriver: { select: { Name: true } } },
    orderBy: { CreatedAt: "desc" },
    take: 100,
  });
  // Decimal -> number at the JSON boundary.
  return NextResponse.json({ jobs: jobs.map((j) => ({ ...j, Price: j.Price == null ? null : Number(j.Price) })) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  // Strings only: an object here would reach Prisma as a filter, not a value.
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const jobId = str(b.jobId);
  const driverId = str(b.vehicleDriverId) || null;
  if (driverId && !(await ownsDriver(driverId))) return NextResponse.json({ error: "ไม่พบคนขับนี้" }, { status: 400 });

  if (b.action === "create") {
    const origin = str(b.origin);
    const destination = str(b.destination);
    if (!origin || !destination) {
      return NextResponse.json({ error: "ต้องระบุต้นทาง/ปลายทาง" }, { status: 400 });
    }
    const scheduledAt = str(b.scheduledAt) ? new Date(str(b.scheduledAt)) : null;
    if (scheduledAt && isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "วันเวลาไม่ถูกต้อง" }, { status: 400 });
    const vehicleId = str(b.vehicleId) || null;
    if (vehicleId && !(await ownsVehicle(vehicleId))) return NextResponse.json({ error: "ไม่พบรถคันนี้" }, { status: 400 });
    if (vehicleId && (await isInShop(vehicleId))) return NextResponse.json({ error: "รถคันนี้อยู่อู่ (ดูวันรับรถในบันทึกซ่อม)" }, { status: 400 });
    const priceText = str(String(b.price ?? ""));
    const price = priceText ? Number(priceText) : null;
    if (price != null && (!Number.isFinite(price) || price < 0)) return NextResponse.json({ error: "ค่าจ้างไม่ถูกต้อง" }, { status: 400 });

    const last = await prisma.driverJob.findFirst({
      where: { TenantId: DEFAULT_TENANT_ID, JobNo: { not: null } },
      orderBy: { JobNo: "desc" },
      select: { JobNo: true },
    });
    const job = await prisma.driverJob.create({
      data: {
        TenantId: DEFAULT_TENANT_ID,
        JobNo: (last?.JobNo ?? 0) + 1,
        VehicleDriverId: driverId,
        VehicleId: vehicleId,
        Origin: origin,
        Destination: destination,
        ScheduledAt: scheduledAt,
        Note: str(b.note) || null,
        Price: price,
        CustomerName: str(b.customerName) || null,
        Status: driverId ? "assigned" : "pending",
        CreatedByUsername: session.username,
      },
    });
    const lineSent = job.VehicleDriverId ? await notifyDriverOfJob(job.DriverJobId) : false;
    return NextResponse.json({ job: { ...job, Price: price }, lineSent });
  }

  if (b.action === "bill") {
    const ids = Array.isArray(b.jobIds) ? b.jobIds.filter((v: unknown): v is string => typeof v === "string") : [];
    const r = await createBill(ids, session.username);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  }

  if (!jobId) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 400 });
  if (!(await ownsJob(jobId))) return NextResponse.json({ error: "ไม่พบงานนี้" }, { status: 404 });

  if (b.action === "assign") {
    const job = await prisma.driverJob.findUnique({ where: { DriverJobId: jobId }, select: { VehicleId: true } });
    if (driverId && job?.VehicleId && (await isInShop(job.VehicleId))) {
      return NextResponse.json({ error: "รถของงานนี้อยู่อู่ (ดูวันรับรถในบันทึกซ่อม)" }, { status: 400 });
    }
    // An empty driver means "take the assignment back" — the picker offers that
    // as its first option, so it has to be a valid value, not a 400.
    await prisma.driverJob.update({
      where: { DriverJobId: jobId },
      data: {
        VehicleDriverId: driverId,
        Status: driverId ? "assigned" : "pending",
        RespondedAt: driverId ? new Date() : null,
      },
    });
    const lineSent = driverId ? await notifyDriverOfJob(jobId) : false;
    return NextResponse.json({ ok: true, lineSent });
  }

  if (b.action === "done") {
    const r = await completeJob(jobId, session.username);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  }

  if (b.action === "cancel") {
    await prisma.driverJob.update({
      where: { DriverJobId: jobId },
      data: { Status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
