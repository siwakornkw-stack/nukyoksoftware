import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export type BillResult = { ok: true; billNo: string } | { ok: false; error: string };

const bkkYymm = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" }).formatToParts(d);
  return p.find((x) => x.type === "year")!.value + p.find((x) => x.type === "month")!.value;
};

// Put finished jobs of one customer on a new billing note (no VAT). Each job can
// be billed once: the update only takes jobs whose BillNo is still null, and the
// BillNo primary key turns a numbering race into P2002 (retried).
export async function createBill(jobIds: string[], username: string): Promise<BillResult> {
  const ids = [...new Set(jobIds)];
  if (!ids.length) return { ok: false, error: "เลือกงานก่อน" };
  const jobs = await prisma.driverJob.findMany({ where: { DriverJobId: { in: ids }, TenantId: DEFAULT_TENANT_ID } });
  if (jobs.length !== ids.length) return { ok: false, error: "ไม่พบงานบางรายการ" };
  if (jobs.some((j) => j.Status !== "done")) return { ok: false, error: "วางบิลได้เฉพาะงานที่ปิดแล้ว" };
  if (jobs.some((j) => j.BillNo)) return { ok: false, error: "มีงานที่วางบิลไปแล้ว" };
  const customers = new Set(jobs.map((j) => (j.CustomerName ?? "").trim()));
  if (customers.size !== 1 || customers.has("")) return { ok: false, error: "งานที่เลือกต้องเป็นลูกค้าเดียวกัน และระบุชื่อลูกค้าแล้ว" };
  const customer = [...customers][0];
  const total = jobs.reduce((a, j) => a + Number(j.Price ?? 0), 0);

  const prefix = `BL${bkkYymm(new Date())}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.driverBill.findFirst({ where: { BillNo: { startsWith: prefix } }, orderBy: { BillNo: "desc" }, select: { BillNo: true } });
    const billNo = prefix + String((last ? Number(last.BillNo.slice(prefix.length)) : 0) + 1).padStart(3, "0");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.driverBill.create({ data: { BillNo: billNo, TenantId: DEFAULT_TENANT_ID, CustomerName: customer, Total: total, CreatedByUsername: username } });
        const { count } = await tx.driverJob.updateMany({ where: { DriverJobId: { in: ids }, BillNo: null }, data: { BillNo: billNo } });
        if (count !== ids.length) throw new Error("ALREADY_BILLED");
        await tx.incomeVehicle.updateMany({ where: { DriverJobId: { in: ids } }, data: { InvoiceNumber: billNo, CustomerName: customer } });
      });
      await audit("driver-bill", billNo, "create", username, null, { customer, total, jobs: jobs.map((j) => j.JobNo) });
      return { ok: true, billNo };
    } catch (e) {
      if ((e as Error).message === "ALREADY_BILLED") return { ok: false, error: "มีงานที่วางบิลไปแล้ว" };
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return { ok: false, error: "สร้างเลขที่ใบวางบิลไม่สำเร็จ ลองใหม่" };
}
