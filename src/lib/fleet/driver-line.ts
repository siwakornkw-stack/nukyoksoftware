import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { pushText } from "@/lib/fuel/line";
import { completeJob } from "./driver-jobs";

const bkk = (d: Date) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(d);

// Push a newly assigned job to the driver's LINE. Returns false when the driver
// has no LINE id or the push fails; the assignment itself still stands.
export async function notifyDriverOfJob(jobId: string): Promise<boolean> {
  const job = await prisma.driverJob.findUnique({
    where: { DriverJobId: jobId },
    include: { VehicleDriver: { select: { LineUserId: true } } },
  });
  const to = job?.VehicleDriver?.LineUserId;
  if (!job || !to || !process.env.LINE_CHANNEL_ACCESS_TOKEN) return false;
  const text = [
    `งานใหม่ #${job.JobNo}`,
    `${job.Origin} → ${job.Destination}`,
    job.ScheduledAt ? `เวลา: ${bkk(job.ScheduledAt)}` : null,
    job.Note ? `หมายเหตุ: ${job.Note}` : null,
    "",
    `ตอบ "รับ ${job.JobNo}" เพื่อรับงาน`,
    `ตอบ "เสร็จ ${job.JobNo}" เมื่อส่งงานเสร็จ`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  try {
    await pushText(to, text);
    return true;
  } catch (e) {
    console.error("job push failed:", (e as Error)?.message);
    return false;
  }
}

const REPLY = /^(รับงาน|รับ|เสร็จงาน|เสร็จ|ปิดงาน)\s*#?\s*(\d+)$/;
const LIST = /^(งาน|งานของฉัน|งานวันนี้)$/;

// The driver's open jobs (assigned or accepted), soonest first.
async function openJobsText(driverId: string): Promise<string> {
  const jobs = await prisma.driverJob.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, VehicleDriverId: driverId, Status: { in: ["assigned", "accepted"] } },
    orderBy: [{ ScheduledAt: { sort: "asc", nulls: "last" } }, { JobNo: "asc" }],
    take: 10,
  });
  if (!jobs.length) return "ตอนนี้ไม่มีงานค้าง";
  const lines = jobs.map(
    (j) => `#${j.JobNo} ${j.Origin} → ${j.Destination}${j.ScheduledAt ? ` (${bkk(j.ScheduledAt)})` : ""}${j.Status === "accepted" ? " ✅รับแล้ว" : ""}`,
  );
  return [`งานของคุณ ${jobs.length} งาน`, ...lines, "", 'ตอบ "รับ n" หรือ "เสร็จ n"'].join("\n");
}

// A driver's "รับ 12" / "เสร็จ 12" / "งาน" in the LINE chat. Returns the reply
// text, or null when the message is not a job command (the caller handles it otherwise).
export async function handleDriverReply(lineUserId: string | undefined, text: string): Promise<string | null> {
  const m = text.trim().match(REPLY);
  const list = LIST.test(text.trim());
  if (!m && !list) return null;
  if (!lineUserId) return "ไม่ทราบผู้ส่ง";

  const driver = await prisma.vehicleDriver.findFirst({
    where: { TenantId: DEFAULT_TENANT_ID, LineUserId: lineUserId },
    select: { VehicleDriverId: true, Name: true },
  });
  if (!driver) return "บัญชี LINE นี้ยังไม่ได้ผูกกับคนขับในระบบ แจ้งออฟฟิศพร้อมพิมพ์ id เพื่อดูรหัสของคุณ";
  if (!m) return openJobsText(driver.VehicleDriverId);
  const accept = m[1].startsWith("รับ");
  const jobNo = Number(m[2]);

  const job = await prisma.driverJob.findFirst({
    where: { TenantId: DEFAULT_TENANT_ID, JobNo: jobNo, VehicleDriverId: driver.VehicleDriverId },
  });
  if (!job) return `ไม่พบงาน #${jobNo} ที่มอบหมายให้คุณ`;
  if (job.Status === "cancelled") return `งาน #${jobNo} ถูกยกเลิกแล้ว`;
  if (job.Status === "done") return `งาน #${jobNo} ปิดไปแล้ว`;
  if (accept && job.Status === "accepted") return `รับงาน #${jobNo} ไว้แล้ว`;

  let income: number | null = null;
  if (accept) {
    await prisma.driverJob.update({ where: { DriverJobId: job.DriverJobId }, data: { Status: "accepted", RespondedAt: new Date() } });
  } else {
    // Same path as the office's "done" button: may record the job's income.
    const r = await completeJob(job.DriverJobId, `line:${driver.Name}`);
    if (!r.ok) return r.error;
    income = r.income;
  }

  // Tell the office in-app (one row per job, refreshed on each update).
  const message = `${driver.Name} ${accept ? "รับงาน" : "ส่งงานเสร็จ"} #${jobNo} (${job.Origin} → ${job.Destination})${income ? ` บันทึกรายได้ ${income.toLocaleString()} บาท` : ""}`;
  const users = await prisma.customer.findMany({ where: { TenantId: DEFAULT_TENANT_ID, Status: "active" }, select: { CustomerId: true } });
  for (const u of users) {
    await prisma.notification.upsert({
      where: { CustomerId_Key: { CustomerId: u.CustomerId, Key: `job|${job.DriverJobId}` } },
      create: { CustomerId: u.CustomerId, Key: `job|${job.DriverJobId}`, Title: "งานวิ่ง", Message: message },
      update: { Message: message, IsRead: false, CreatedTime: new Date() },
    });
  }
  return accept ? `รับงาน #${jobNo} แล้ว ขอบคุณครับ` : `บันทึกว่างาน #${jobNo} เสร็จแล้ว ขอบคุณครับ`;
}
