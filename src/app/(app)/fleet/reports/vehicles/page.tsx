import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht } from "@/lib/format";
import { vehiclePnl } from "@/lib/fleet/vehicle-pnl";

export const dynamic = "force-dynamic";

const th = "py-2 pr-3 font-normal";
const td = "py-2 pr-3 text-right";

export default async function VehiclePnlPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y > 2000 && y <= thisYear + 1 ? y : thisYear;
  const rows = await vehiclePnl(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)));

  const total = rows.reduce(
    (a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, net: a.net + r.net }),
    { income: 0, expense: 0, net: 0 }
  );
  const losing = rows.filter((r) => r.net < 0).length;

  return (
    <div className="max-w-6xl">
      <PageHeader title="กำไร / ต้นทุนรายคัน" subtitle={`ปี ${year + 543} · เรียงจากขาดทุนมากที่สุด`} />

      <div className="flex gap-2 mb-4">
        {[thisYear - 2, thisYear - 1, thisYear].map((yy) => (
          <Link
            key={yy}
            href={`?year=${yy}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${yy === year ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}
          >
            {yy + 543}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <StatCard label="รายรับรวม" value={baht(total.income)} accent="emerald" />
        <StatCard label="ต้นทุนรวม" value={baht(total.expense)} accent="rose" />
        <StatCard label="สุทธิ" value={baht(total.net)} accent={total.net >= 0 ? "sky" : "rose"} />
        <StatCard label="คันที่ขาดทุน" value={`${losing} คัน`} accent="amber" />
      </div>

      <Card>
        <div className="text-xs text-slate-500 mb-3">
          ต้นทุน = น้ำมัน + ค่าซ่อมส่วนที่บริษัทจ่าย + ภาษี/พ.ร.บ./ประกัน (นับในปีที่เริ่มคุ้มครอง)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className={th}>รถ</th>
                <th className={`${th} text-right`}>รายรับ</th>
                <th className={`${th} text-right`}>น้ำมัน</th>
                <th className={`${th} text-right`}>ซ่อม</th>
                <th className={`${th} text-right`}>ภาษี/ประกัน</th>
                <th className={`${th} text-right`}>ต้นทุนรวม</th>
                <th className={`${th} text-right`}>สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vehicleId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">
                    <Link href={`/fleet/vehicles/${r.vehicleId}`} className="hover:text-sky-300">
                      {r.plate}
                    </Link>
                    {!r.active && <span className="ml-2 text-xs text-slate-500">(เลิกใช้)</span>}
                  </td>
                  <td className={`${td} text-emerald-300`}>{baht(r.income)}</td>
                  <td className={td}>{baht(r.fuel)}</td>
                  <td className={td}>{baht(r.repair)}</td>
                  <td className={td}>{baht(r.premiums)}</td>
                  <td className={td}>{baht(r.expense)}</td>
                  <td className={`${td} font-medium ${r.net < 0 ? "text-rose-300" : "text-sky-300"}`}>{baht(r.net)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">ไม่มีข้อมูล</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
