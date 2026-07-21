import Link from "next/link";
import { getFleetSummary } from "@/lib/fleet/queries";
import { baht, num } from "@/lib/format";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { FleetAgingChart } from "./Charts";

export const dynamic = "force-dynamic";

export default async function FleetDashboard() {
  const s = await getFleetSummary();

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="กองรถ & การเงิน"
        subtitle="ภาพรวมการเงิน · ลูกหนี้ค่างวด"
        action={
          <Link href="/fleet/vehicles" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
            ทะเบียนรถ
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-4">
        <StatCard label="รายรับ (ปีนี้)" value={baht(s.income)} accent="emerald" />
        <StatCard label="ค่าใช้จ่าย (ปีนี้)" value={baht(s.expense)} accent="rose" />
        <StatCard label="ลูกหนี้ค้าง" value={baht(s.ar.outstanding)} sub={`${num(s.ar.outstandingCount)} งวด`} accent="amber" />
        <StatCard label="เกินกำหนด" value={baht(s.ar.overdue)} sub={`${num(s.ar.overdueCount)} งวด`} accent="rose" />
        <StatCard label="รถในระบบ" value={num(s.vehicleCount)} accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FleetAgingChart data={s.ar.agingBuckets} />

        <Card>
          <div className="font-medium mb-3">ค่างวดใกล้/เกินกำหนด</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-1.5 pr-3">ทะเบียน</th>
                  <th className="py-1.5 pr-3">งวด</th>
                  <th className="py-1.5 pr-3">ครบกำหนด</th>
                  <th className="py-1.5 pr-3 text-right">ยอด</th>
                  <th className="py-1.5">เกิน</th>
                </tr>
              </thead>
              <tbody>
                {s.ar.dueSoon.map((d, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-1.5 pr-3">
                      <Link href={`/fleet/vehicles/${d.vehicleId}`} className="text-sky-400 hover:underline">
                        {d.plate}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3">{d.installmentNumber}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{d.dueDate}</td>
                    <td className="py-1.5 pr-3 text-right">{baht(d.amount)}</td>
                    <td className="py-1.5">
                      {d.overdueDays > 0 ? (
                        <span className="text-rose-400">{d.overdueDays} วัน</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!s.ar.dueSoon.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      ไม่มีค่างวดค้าง
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Link href="/fleet/installments" className="text-sm text-sky-400 hover:underline">
              จัดการค่างวดทั้งหมด →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
