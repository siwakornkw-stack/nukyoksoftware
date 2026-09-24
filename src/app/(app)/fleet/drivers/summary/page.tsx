import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht, num } from "@/lib/format";
import { driverMonth } from "@/lib/fleet/driver-summary";
import { addMonths } from "@/lib/fleet/fuel-report";

export const dynamic = "force-dynamic";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const label = (m: string) => `${TH_MONTH[Number(m.slice(5)) - 1]} ${Number(m.slice(0, 4)) + 543}`;
const thisMonth = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);

export default async function DriverSummaryPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const current = thisMonth();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") && sp.month! <= current ? sp.month! : current;
  const rows = await driverMonth(month);
  const jobs = rows.reduce((a, r) => a + r.jobs, 0);
  const amount = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="สรุปงานคนขับรายเดือน"
        subtitle={`${label(month)} · นับงานที่ปิดแล้วตามวันที่ปิดงาน`}
        action={
          <a href={`/api/export/driver-month?month=${month}`} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
            ส่งออก Excel
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[-5, -4, -3, -2, -1, 0].map((n) => {
          const m = addMonths(current, n);
          return (
            <Link key={m} href={`?month=${m}`} className={`rounded-lg px-3 py-1.5 text-sm ${m === month ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}>
              {label(m)}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 grid-cols-3 mb-4">
        <StatCard label="คนขับที่มีงาน" value={`${rows.length} คน`} accent="sky" />
        <StatCard label="งานที่ปิดแล้ว" value={`${num(jobs)} งาน`} accent="violet" />
        <StatCard label="ยอดค่างาน" value={baht(amount)} accent="emerald" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">คนขับ</th>
                <th className="py-2 pr-3 text-right">จำนวนงาน</th>
                <th className="py-2 pr-3 text-right">ยอดค่างาน</th>
                <th className="py-2 pr-3 text-right">เฉลี่ย/งาน</th>
                <th className="py-2 text-right">วางบิลแล้ว</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.driverId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3 text-right">{num(r.jobs)}</td>
                  <td className="py-2 pr-3 text-right text-emerald-300">{baht(r.amount)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{baht(Math.round(r.amount / r.jobs))}</td>
                  <td className="py-2 text-right text-slate-400">{r.billed} / {r.jobs}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">ไม่มีงานที่ปิดในเดือนนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
