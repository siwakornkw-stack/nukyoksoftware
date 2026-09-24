import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht } from "@/lib/format";
import { budgetStatus } from "@/lib/fleet/budget";
import { getSession, isAdmin } from "@/lib/auth";
import { RowBudget } from "./RowBudget";

export const dynamic = "force-dynamic";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function Bar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default async function BudgetPage() {
  const [{ month, rows }, session] = await Promise.all([budgetStatus(), getSession()]);
  const admin = !!session && isAdmin(session);
  const [y, m] = month.split("-").map(Number);
  const withBudget = rows.filter((r) => r.budget != null);
  const over = withBudget.filter((r) => (r.pct ?? 0) >= 100).length;
  const near = withBudget.filter((r) => (r.pct ?? 0) >= 80 && (r.pct ?? 0) < 100).length;

  return (
    <div className="max-w-6xl">
      <PageHeader title="งบรายเดือนต่อคัน" subtitle={`${TH_MONTH[m - 1]} ${y + 543} · ค่าน้ำมัน + ค่าซ่อมส่วนที่บริษัทจ่าย (ไม่รวมภาษี/ประกัน)`} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <StatCard label="ตั้งงบแล้ว" value={`${withBudget.length} คัน`} accent="sky" />
        <StatCard label="เกินงบ" value={`${over} คัน`} accent="rose" />
        <StatCard label="ใช้ไป 80% ขึ้นไป" value={`${near} คัน`} accent="amber" />
        <StatCard label="ใช้จ่ายเดือนนี้ (ทุกคัน)" value={baht(rows.reduce((a, r) => a + r.spent, 0))} accent="violet" />
      </div>

      <Card>
        <div className="text-xs text-slate-500 mb-3">
          ระบบแจ้งเตือนเมื่อคันไหนใช้ถึง 80% และ 100% ของงบ (ครั้งเดียวต่อเดือน){admin ? " · พิมพ์งบในช่องแล้วกด Enter, เว้นว่าง = ไม่ตั้งงบ" : ""}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">รถ</th>
                <th className="py-2 pr-3 text-right">งบ/เดือน</th>
                <th className="py-2 pr-3 text-right">น้ำมัน</th>
                <th className="py-2 pr-3 text-right">ซ่อม</th>
                <th className="py-2 pr-3 text-right">รวม</th>
                <th className="py-2">ใช้ไป</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vehicleId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">
                    <Link href={`/fleet/vehicles/${r.vehicleId}`} className="hover:text-sky-300">{r.plate}</Link>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {admin ? <RowBudget vehicleId={r.vehicleId} value={r.budget} /> : r.budget == null ? <span className="text-slate-500">-</span> : baht(r.budget)}
                  </td>
                  <td className="py-2 pr-3 text-right">{baht(r.fuel)}</td>
                  <td className="py-2 pr-3 text-right">{baht(r.repair)}</td>
                  <td className="py-2 pr-3 text-right font-medium">{baht(r.spent)}</td>
                  <td className="py-2">
                    {r.pct == null ? (
                      <span className="text-slate-500">-</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Bar pct={r.pct} />
                        <span className={r.pct >= 100 ? "text-rose-300" : r.pct >= 80 ? "text-amber-300" : "text-slate-300"}>{r.pct}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
