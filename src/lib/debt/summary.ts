import type { DebtRecord, DebtStatus } from "./types";

const OUTSTANDING: DebtStatus[] = ["รอวางบิล", "วางบิลแล้ว"];
const PAID: DebtStatus[] = ["เปิดบิลแล้ว", "ชำระแล้ว"];

export interface Summary {
  totalCount: number;
  totalAmount: number;
  outstandingAmount: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  collectedAmount: number;
  collectedCount: number;
  cancelledAmount: number;
  byStatus: { status: DebtStatus; count: number; amount: number }[];
  topCustomers: { customer: string; amount: number; count: number }[];
  monthly: { month: string; amount: number; count: number }[];
  bySalesperson: { name: string; amount: number; count: number }[];
  agingBuckets: { bucket: string; amount: number; count: number }[];
}

export function computeSummary(records: DebtRecord[], today = new Date()): Summary {
  const todayStr = today.toISOString().slice(0, 10);
  const statusMap = new Map<DebtStatus, { count: number; amount: number }>();
  const custMap = new Map<string, { amount: number; count: number }>();
  const monMap = new Map<string, { amount: number; count: number }>();
  const salesMap = new Map<string, { amount: number; count: number }>();
  const aging = new Map<string, { amount: number; count: number }>();

  let totalAmount = 0,
    outstandingAmount = 0,
    outstandingCount = 0,
    overdueAmount = 0,
    overdueCount = 0,
    collectedAmount = 0,
    collectedCount = 0,
    cancelledAmount = 0;

  for (const r of records) {
    const sm = statusMap.get(r.status) ?? { count: 0, amount: 0 };
    sm.count++;
    sm.amount += r.total;
    statusMap.set(r.status, sm);

    if (r.status === "ยกเลิก") {
      cancelledAmount += r.total;
      continue;
    }
    totalAmount += r.total;

    if (PAID.includes(r.status)) {
      collectedAmount += r.total;
      collectedCount++;
    }

    if (OUTSTANDING.includes(r.status)) {
      outstandingAmount += r.total;
      outstandingCount++;

      const c = custMap.get(r.customer) ?? { amount: 0, count: 0 };
      c.amount += r.total;
      c.count++;
      custMap.set(r.customer, c);

      const sp = r.salesperson || "ไม่ระบุ";
      const s = salesMap.get(sp) ?? { amount: 0, count: 0 };
      s.amount += r.total;
      s.count++;
      salesMap.set(sp, s);

      if (r.dueDate && r.dueDate < todayStr) {
        overdueAmount += r.total;
        overdueCount++;
        const days = Math.floor(
          (today.getTime() - new Date(r.dueDate).getTime()) / 86400000
        );
        const b = days <= 30 ? "1-30 วัน" : days <= 60 ? "31-60 วัน" : days <= 90 ? "61-90 วัน" : "90+ วัน";
        const ab = aging.get(b) ?? { amount: 0, count: 0 };
        ab.amount += r.total;
        ab.count++;
        aging.set(b, ab);
      }
    }

    if (r.date) {
      const m = r.date.slice(0, 7);
      const mm = monMap.get(m) ?? { amount: 0, count: 0 };
      mm.amount += r.total;
      mm.count++;
      monMap.set(m, mm);
    }
  }

  const byStatus = [...statusMap.entries()].map(([status, v]) => ({ status, ...v }));
  const topCustomers = [...custMap.entries()]
    .map(([customer, v]) => ({ customer, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  const monthly = [...monMap.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-18);
  const bySalesperson = [...salesMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  const order = ["1-30 วัน", "31-60 วัน", "61-90 วัน", "90+ วัน"];
  const agingBuckets = order
    .filter((b) => aging.has(b))
    .map((bucket) => ({ bucket, ...aging.get(bucket)! }));

  return {
    totalCount: records.length,
    totalAmount,
    outstandingAmount,
    outstandingCount,
    overdueAmount,
    overdueCount,
    collectedAmount,
    collectedCount,
    cancelledAmount,
    byStatus,
    topCustomers,
    monthly,
    bySalesperson,
    agingBuckets,
  };
}
