import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

const bkkTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(d);

export type CompleteResult = { ok: true; income: number | null } | { ok: false; error: string };

// Close a job (driver's "เสร็จ" on LINE or the office's button). A job with a
// price becomes an IncomeVehicle row, so the per-vehicle P&L fills itself.
// IncomeVehicle.DriverJobId is unique: a repeat or a race records it once.
export async function completeJob(jobId: string, username: string): Promise<CompleteResult> {
  const job = await prisma.driverJob.findFirst({
    where: { DriverJobId: jobId, TenantId: DEFAULT_TENANT_ID },
    include: { VehicleDriver: { select: { Name: true, Vehicle: { where: { Status: "active" }, select: { VehicleId: true } } } } },
  });
  if (!job) return { ok: false, error: "ไม่พบงานนี้" };
  if (job.Status === "cancelled") return { ok: false, error: `งาน #${job.JobNo} ถูกยกเลิกแล้ว` };
  if (job.Status === "done") return { ok: false, error: `งาน #${job.JobNo} ปิดไปแล้ว` };
  if (!job.VehicleDriverId) return { ok: false, error: "งานนี้ยังไม่ได้มอบหมายคนขับ" };

  // The job's own vehicle, else the driver's only active vehicle.
  const driverVehicles = job.VehicleDriver?.Vehicle ?? [];
  const vehicleId = job.VehicleId ?? (driverVehicles.length === 1 ? driverVehicles[0].VehicleId : null);
  const price = job.Price == null ? 0 : Number(job.Price);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.driverJob.updateMany({
        where: { DriverJobId: jobId, Status: { notIn: ["done", "cancelled"] } },
        data: { Status: "done", RespondedAt: now },
      });
      if (!count) throw new Error("ALREADY_DONE");
      if (price > 0) {
        await tx.incomeVehicle.create({
          data: {
            TenantId: DEFAULT_TENANT_ID,
            VehicleId: vehicleId,
            VehicleDriverId: job.VehicleDriverId,
            DriverJobId: jobId,
            Description: `งานวิ่ง #${job.JobNo}: ${job.Origin} → ${job.Destination}`,
            Status: "active",
            SourceLabel: "driver-job",
            DateTime: now,
            Time: bkkTime(now),
            WorkOrderNumber: `JOB-${job.JobNo ?? ""}`,
            InvoiceNumber: "",
            AmountReceive: price,
            CreatedByUsername: username,
          },
        });
      }
    });
  } catch (e) {
    if ((e as Error).message === "ALREADY_DONE") return { ok: false, error: `งาน #${job.JobNo} ปิดไปแล้ว` };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `งาน #${job.JobNo} บันทึกรายได้ไปแล้ว` };
    }
    throw e;
  }

  await audit("driver-job", jobId, "done", username, { Status: job.Status }, { Status: "done", income: price || null, VehicleId: vehicleId });
  return { ok: true, income: price > 0 ? price : null };
}
