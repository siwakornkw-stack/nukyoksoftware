import Link from "next/link";
import { getCurrentRecords } from "@/lib/debt/store";
import { computeSummary } from "@/lib/debt/summary";
import { baht, num } from "@/lib/format";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { DebtCharts } from "./Charts";

export const dynamic = "force-dynamic";

export default async function DebtDashboard() {
  const { meta, records } = await getCurrentRecords();
  const s = computeSummary(records);

  if (!meta) {
    return (
      <div className="max-w-5xl">
        <PageHeader title="แดชบอร์ดหนี้" subtitle="ยังไม่มีข้อมูล" />
        <Card>
          <div className="text-slate-400">
            ยังไม่มีข้อมูล อัปโหลดไฟล์ Excel ใบวางบิล/ใบแจ้งหนี้ก่อน{" "}
            <Link href="/debt/upload" className="text-sky-400 underline">
              ไปหน้าอัปโหลด
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="แดชบอร์ดหนี้"
        subtitle={`ข้อมูลชุด: ${meta.fileName} · ${num(meta.rowCount)} รายการ`}
        action={
          <Link
            href="/debt/upload"
            className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60"
          >
            อัปโหลด / เปลี่ยนชุดข้อมูล
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="มูลค่ารวม (ไม่รวมยกเลิก)" value={baht(s.totalAmount)} sub={`${num(s.totalCount)} รายการ`} />
        <StatCard label="ยอดค้าง" value={baht(s.outstandingAmount)} sub={`${num(s.outstandingCount)} รายการ`} accent="amber" />
        <StatCard label="เกินกำหนด" value={baht(s.overdueAmount)} sub={`${num(s.overdueCount)} รายการ`} accent="rose" />
        <StatCard label="เก็บแล้ว" value={baht(s.collectedAmount)} sub={`${num(s.collectedCount)} รายการ`} accent="emerald" />
      </div>

      <DebtCharts
        byStatus={s.byStatus}
        monthly={s.monthly}
        agingBuckets={s.agingBuckets}
        bySalesperson={s.bySalesperson}
      />

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <div className="font-medium mb-3">ลูกค้าค้างชำระสูงสุด</div>
          <div className="space-y-1.5">
            {s.topCustomers.map((c) => (
              <div key={c.customer} className="flex justify-between text-sm">
                <span className="truncate text-slate-300">{c.customer || "ไม่ระบุ"}</span>
                <span className="text-slate-400">
                  {baht(c.amount)} · {c.count}
                </span>
              </div>
            ))}
            {!s.topCustomers.length && <div className="text-sm text-slate-500">ไม่มีข้อมูลค้างชำระ</div>}
          </div>
        </Card>
        <Card>
          <div className="font-medium mb-3">อายุหนี้ (เกินกำหนด)</div>
          <div className="space-y-1.5">
            {s.agingBuckets.map((b) => (
              <div key={b.bucket} className="flex justify-between text-sm">
                <span className="text-slate-300">{b.bucket}</span>
                <span className="text-slate-400">
                  {baht(b.amount)} · {b.count}
                </span>
              </div>
            ))}
            {!s.agingBuckets.length && <div className="text-sm text-slate-500">ไม่มีหนี้เกินกำหนด</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
