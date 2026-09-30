import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getMonthlyFinance, dec } from "@/lib/fleet/queries";
import { fleetDashboard } from "@/lib/fleet/dashboard";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht } from "@/lib/format";
import { FinanceChart } from "../Charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const T = DEFAULT_TENANT_ID;
  const year = new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));

  const [dash, monthly, topIncome] = await Promise.all([
    fleetDashboard(year),
    getMonthlyFinance(12),
    prisma.incomeVehicle.groupBy({
      by: ["VehicleId"],
      where: { TenantId: T, VehicleId: { not: null }, DateTime: { gte: yearStart } },
      _sum: { AmountReceive: true },
      orderBy: { _sum: { AmountReceive: "desc" } },
      take: 10,
    }),
  ]);

  const ids = topIncome.map((t) => t.VehicleId).filter((x): x is string => Boolean(x));
  const vehicles = await prisma.vehicle.findMany({
    where: { VehicleId: { in: ids } },
    select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true },
  });
  const plateOf = (id: string | null) => {
    const v = vehicles.find((x) => x.VehicleId === id);
    return v ? `${v.LicensePlatePrefix} ${v.LicensePlateSuffix}` : "-";
  };

  const t = dash.totals;
  const net = t.income - t.expense;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="รายงานการเงิน"
        subtitle="ปีปัจจุบัน · 12 เดือนล่าสุด"
        action={
          <Link href="/fleet/income/import" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
            นำเข้ารายรับ
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard label="รายรับ (ปีนี้)" value={baht(t.income)} sub="ก่อน VAT" accent="emerald" />
        <StatCard
          label="ต้นทุนรถ (ปีนี้)"
          value={baht(t.expense)}
          sub={`น้ำมัน ${baht(t.fuel)} · ซ่อม ${baht(t.repair)} · ภาษี/ประกัน ${baht(t.premiums)}`}
          accent="rose"
        />
        <StatCard
          label="รายรับ - ต้นทุนรถ"
          value={baht(net)}
          sub="ยังไม่รวมค่างวดและค่าใช้จ่ายอื่นของบริษัท"
          accent={net >= 0 ? "sky" : "rose"}
        />
      </div>

      <div className="mb-4">
        <FinanceChart data={monthly} title="รายรับ vs ต้นทุนรถ รายเดือน (น้ำมัน ซ่อม ภาษี/ประกัน)" />
      </div>

      <Card>
        <div className="font-medium mb-3">รถที่สร้างรายรับสูงสุด (ปีนี้)</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="py-2 pr-3">ทะเบียน</th>
              <th className="py-2 text-right">รายรับ</th>
            </tr>
          </thead>
          <tbody>
            {topIncome.map((t) => (
              <tr key={t.VehicleId} className="border-b border-slate-800/50">
                <td className="py-2 pr-3">
                  <Link href={`/fleet/vehicles/${t.VehicleId}`} className="text-sky-400 hover:underline">
                    {plateOf(t.VehicleId)}
                  </Link>
                </td>
                <td className="py-2 text-right">{baht(dec(t._sum.AmountReceive))}</td>
              </tr>
            ))}
            {!topIncome.length && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-slate-500">
                  ยังไม่มีข้อมูลรายรับ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
