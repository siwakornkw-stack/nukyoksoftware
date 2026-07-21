import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { PageHeader, Card } from "@/components/ui";
import { baht } from "@/lib/format";
import { dec } from "@/lib/fleet/queries";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim();
  const vehicles = await prisma.vehicle.findMany({
    where: {
      TenantId: DEFAULT_TENANT_ID,
      ...(term ? { OR: [{ LicensePlateSuffix: { contains: term } }, { Model: { contains: term } }] } : {}),
    },
    include: { VehicleBrand: true, VehicleType: true, VehicleDriver: true },
    orderBy: { No: "desc" },
    take: 500,
  });

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="ทะเบียนรถ"
        subtitle={`${vehicles.length} คัน`}
        action={
          <Link href="/fleet/vehicles/new" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
            + เพิ่มรถ
          </Link>
        }
      />

      <Card className="mb-4">
        <form className="flex gap-2" action="/fleet/vehicles">
          <input name="q" defaultValue={term ?? ""} className="field max-w-sm" placeholder="ค้นหา ทะเบียน / รุ่น" />
          <button className="rounded-lg px-3 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">ค้นหา</button>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">ทะเบียน</th>
                <th className="py-2 pr-3">ประเภท / ยี่ห้อ</th>
                <th className="py-2 pr-3">รุ่น</th>
                <th className="py-2 pr-3">คนขับ</th>
                <th className="py-2 pr-3 text-right">ค่างวด</th>
                <th className="py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.VehicleId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">
                    <Link href={`/fleet/vehicles/${v.VehicleId}`} className="text-sky-400 hover:underline">
                      {v.LicensePlatePrefix} {v.LicensePlateSuffix}
                    </Link>
                    <div className="text-xs text-slate-500">{v.LicensePlateProvince}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-400">
                    {v.VehicleType?.Name ?? "-"} / {v.VehicleBrand?.Name ?? "-"}
                  </td>
                  <td className="py-2 pr-3">{v.Model || "-"}</td>
                  <td className="py-2 pr-3 text-slate-400">{v.VehicleDriver?.Name ?? "-"}</td>
                  <td className="py-2 pr-3 text-right">
                    {v.InstallmentAmount ? baht(dec(v.InstallmentAmount)) : "-"}
                    {v.InstallmentPeriods ? <span className="text-xs text-slate-500"> ×{v.InstallmentPeriods}</span> : null}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs ${
                        v.Status === "active"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                      }`}
                    >
                      {v.Status === "active" ? "ใช้งาน" : v.Status}
                    </span>
                  </td>
                </tr>
              ))}
              {!vehicles.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    ยังไม่มีรถ — กด &quot;เพิ่มรถ&quot;
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
