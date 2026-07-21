import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht, thDate, thDateTime } from "@/lib/format";
import { dec } from "@/lib/fleet/queries";

export const dynamic = "force-dynamic";

export default async function VehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await prisma.vehicle.findFirst({
    where: { VehicleId: id, TenantId: DEFAULT_TENANT_ID },
    include: {
      VehicleBrand: true,
      VehicleType: true,
      VehicleDriver: true,
      FuelType: true,
      InstallmentsVehicle: { orderBy: { InstallmentNumber: "asc" } },
      IncomeVehicle: { orderBy: { DateTime: "desc" }, take: 20 },
    },
  });
  if (!v) notFound();

  const inst = v.InstallmentsVehicle;
  const paidCount = inst.filter((i) => i.DatePay).length;
  const unpaid = inst.filter((i) => !i.DatePay);
  const unpaidAmt = unpaid.reduce((a, i) => a + dec(i.Amount), 0);
  const incomeTotal = v.IncomeVehicle.reduce((a, i) => a + dec(i.AmountReceive), 0);

  const info: [string, string][] = [
    ["ประเภท", v.VehicleType?.Name ?? "-"],
    ["ยี่ห้อ", v.VehicleBrand?.Name ?? "-"],
    ["รุ่น", v.Model || "-"],
    ["สี", v.Color || "-"],
    ["คนขับ", v.VehicleDriver?.Name ?? "-"],
    ["ชนิดน้ำมัน", v.FuelType?.Name ?? "-"],
    ["เลขตัวถัง", v.ChassisNumber || "-"],
    ["เลขเครื่อง", v.EngineNumber || "-"],
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`${v.LicensePlatePrefix} ${v.LicensePlateSuffix}`}
        subtitle={v.LicensePlateProvince}
        action={
          <div className="flex gap-2">
            <Link href={`/fleet/vehicles/${v.VehicleId}/records`} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ประวัติ/เอกสาร
            </Link>
            <Link href={`/fleet/installments?vehicle=${v.VehicleId}`} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              จัดการค่างวด
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard label="ค่างวดคงเหลือ" value={baht(unpaidAmt)} sub={`${unpaid.length}/${inst.length} งวด`} accent="amber" />
        <StatCard label="ชำระแล้ว" value={`${paidCount} งวด`} accent="emerald" />
        <StatCard label="รายรับล่าสุด (20 รายการ)" value={baht(incomeTotal)} accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="font-medium mb-3">ข้อมูลรถ</div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {info.map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-slate-200">{val}</dd>
              </div>
            ))}
          </dl>
          {v.Note && <div className="mt-3 text-sm text-slate-400">หมายเหตุ: {v.Note}</div>}
        </Card>

        <Card>
          <div className="font-medium mb-3">ค่างวด</div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-1.5 pr-2">งวด</th>
                  <th className="py-1.5 pr-2">ครบกำหนด</th>
                  <th className="py-1.5 pr-2 text-right">ยอด</th>
                  <th className="py-1.5">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {inst.map((i) => (
                  <tr key={i.InstallmentsVehicleId} className="border-b border-slate-800/50">
                    <td className="py-1.5 pr-2">{i.InstallmentNumber}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{thDate(i.DueDate.toISOString())}</td>
                    <td className="py-1.5 pr-2 text-right">{baht(dec(i.Amount))}</td>
                    <td className="py-1.5">
                      {i.DatePay ? (
                        <span className="text-emerald-400 text-xs">ชำระแล้ว</span>
                      ) : (
                        <span className="text-amber-400 text-xs">ค้าง</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!inst.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      ยังไม่มีค่างวด — สร้างได้ที่หน้า &quot;จัดการค่างวด&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="font-medium mb-3">รายรับล่าสุด</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-1.5 pr-3">วันที่</th>
                <th className="py-1.5 pr-3">รายละเอียด</th>
                <th className="py-1.5 pr-3">ใบสั่งงาน</th>
                <th className="py-1.5 text-right">รับเงิน</th>
              </tr>
            </thead>
            <tbody>
              {v.IncomeVehicle.map((inc) => (
                <tr key={inc.IncomeVehicleId} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3 text-slate-400">{thDateTime(inc.DateTime)}</td>
                  <td className="py-1.5 pr-3">{inc.Description}</td>
                  <td className="py-1.5 pr-3 text-slate-400">{inc.WorkOrderNumber}</td>
                  <td className="py-1.5 text-right">{baht(dec(inc.AmountReceive))}</td>
                </tr>
              ))}
              {!v.IncomeVehicle.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    ยังไม่มีรายรับ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
