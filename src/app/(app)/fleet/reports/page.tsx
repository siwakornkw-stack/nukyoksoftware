import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getFleetSummary, getMonthlyFinance, dec } from "@/lib/fleet/queries";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht } from "@/lib/format";
import { FinanceChart } from "../Charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const T = DEFAULT_TENANT_ID;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [summary, monthly, topIncome] = await Promise.all([
    getFleetSummary(),
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

  const net = summary.income - summary.expense;

  return (
    <div className="max-w-5xl">
      <PageHeader title="รายงานการเงิน" subtitle="ปีปัจจุบัน · 12 เดือนล่าสุด" />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard label="รายรับ (ปีนี้)" value={baht(summary.income)} accent="emerald" />
        <StatCard label="ค่าใช้จ่าย (ปีนี้)" value={baht(summary.expense)} accent="rose" />
        <StatCard label="คงเหลือสุทธิ" value={baht(net)} accent={net >= 0 ? "sky" : "rose"} />
      </div>

      <div className="mb-4">
        <FinanceChart data={monthly} />
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
