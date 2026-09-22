import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { baht, num, thDate } from "@/lib/format";
import {
  ANOMALY_LABEL,
  distanceOf,
  findAnomalies,
  fuelFilterOptions,
  loadFuelRecords,
  resolveRange,
  thMonth,
  type FuelRecord,
} from "@/lib/fleet/fuel-report";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateText } from "@/lib/fleet/plates";
import { FuelFilters } from "../FuelFilters";
import { FuelRow } from "./FuelRow";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; vehicle?: string; receiver?: string; q?: string };

const th = "py-1.5 pr-3 font-normal";
const td = "py-1.5 pr-3";

export default async function FuelRecordsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const opts = await fuelFilterOptions();
  const { from, to } = resolveRange(sp, opts.latestMonth);
  const q = (sp.q ?? "").trim().toLowerCase();

  const [all, vehicleRows] = await Promise.all([
    loadFuelRecords({ from, to, vehicleId: sp.vehicle || undefined, receiver: sp.receiver || undefined }),
    prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true },
      orderBy: { No: "asc" },
    }),
  ]);
  const allVehicles = vehicleRows
    .map((v) => {
      const plate = plateText(v) || v.Model;
      return { id: v.VehicleId, plate: v.Model && v.Model !== plate ? `${plate} - ${v.Model}` : plate };
    })
    .sort((a, b) => a.plate.localeCompare(b.plate, "th"));
  const rows = q ? all.filter((r) => `${r.invoice} ${r.item} ${r.receiver}`.toLowerCase().includes(q)) : all;

  // Flags are computed over the whole range, then shown on the matching rows.
  const flags = new Map<string, string[]>();
  for (const a of findAnomalies(all)) flags.set(a.row.id, [...(flags.get(a.row.id) ?? []), ANOMALY_LABEL[a.kind]]);

  const groups = new Map<string, FuelRecord[]>();
  for (const r of rows) groups.set(r.vehicleId, [...(groups.get(r.vehicleId) ?? []), r]);
  const blocks = [...groups.values()].sort((a, b) => a[0].plate.localeCompare(b[0].plate, "th"));

  const total = rows.reduce((a, r) => a + r.amount, 0);
  const liters = rows.reduce((a, r) => a + r.liters, 0);
  const rangeText = from === to ? thMonth(from) : `${thMonth(from)} - ${thMonth(to)}`;

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="รายละเอียดค่าน้ำมัน"
        subtitle={`${rangeText} · ${rows.length} รายการ · ${blocks.length} คัน · ${baht(total)} · ${num(liters, 2)} ลิตร`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/fleet/fuel?${new URLSearchParams({ from, to, ...(sp.vehicle ? { vehicle: sp.vehicle } : {}) })}`}
              className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60"
            >
              รายงาน
            </Link>
            <Link href="/fleet/fuel/import" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              นำเข้าไฟล์
            </Link>
          </div>
        }
      />

      <FuelFilters action="/fleet/fuel/records" from={from} to={to} vehicle={sp.vehicle} receiver={sp.receiver} q={sp.q ?? ""} {...opts} />

      {!blocks.length && (
        <Card>
          <div className="py-10 text-center text-slate-400">ไม่พบรายการ</div>
        </Card>
      )}

      <div className="space-y-4">
        {blocks.map((list) => {
          const v = list[0];
          const readings = list.flatMap((r) => [r.odoStart, r.odoEnd]).filter((x) => x > 0);
          const odoFrom = readings.length ? Math.min(...readings) : 0;
          const odoTo = readings.length ? Math.max(...readings) : 0;
          const dist = distanceOf(list);
          const amount = list.reduce((a, r) => a + r.amount, 0);
          const lit = list.reduce((a, r) => a + r.liters, 0);
          const receivers = [...new Set(list.map((r) => r.receiver).filter(Boolean))];
          return (
            <Card key={v.vehicleId}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <Link href={`/fleet/vehicles/${v.vehicleId}`} className="font-semibold text-sky-300 hover:underline">
                    {v.plate}
                  </Link>
                  {v.model && v.model !== v.plate && <span className="ml-2 text-sm text-slate-400">{v.model}</span>}
                  <div className="text-xs text-slate-500 mt-0.5">ผู้รับน้ำมัน: {receivers.join(", ") || "-"}</div>
                </div>
                <dl className="grid grid-cols-3 sm:grid-cols-6 gap-x-5 gap-y-1 text-xs">
                  <div>
                    <dt className="text-slate-500">เลขไมล์เริ่มต้น</dt>
                    <dd className="text-slate-200">{odoFrom ? num(odoFrom, 2) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">เลขไมล์ปลายทาง</dt>
                    <dd className="text-slate-200">{odoTo ? num(odoTo, 2) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ระยะทางที่ใช้งาน</dt>
                    <dd className="text-slate-200">{dist ? num(dist, 2) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">บาท / กม.</dt>
                    <dd className="text-slate-200">{dist ? num(amount / dist, 2) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ลิตรรวม</dt>
                    <dd className="text-slate-200">{num(lit, 2)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ยอดรวม</dt>
                    <dd className="text-sky-300 font-medium">{baht(amount)}</dd>
                  </div>
                </dl>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className={th}>วัน/เดือน/ปี</th>
                      <th className={th}>รายการ</th>
                      <th className={th}>เลขที่ใบกำกับภาษี</th>
                      <th className={`${th} text-right`}>ไมล์ต้นทาง</th>
                      <th className={`${th} text-right`}>ไมล์ปลายทาง</th>
                      <th className={`${th} text-right`}>ระยะทาง</th>
                      <th className={`${th} text-right`}>จำนวนเงิน</th>
                      <th className={`${th} text-right`}>ลิตร</th>
                      <th className={`${th} text-right`}>฿/ลิตร</th>
                      <th className={th}>ผู้รับ</th>
                      <th className={th}>ตรวจสอบ</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <FuelRow key={r.id} row={r} flags={flags.get(r.id)?.join(", ") ?? ""} vehicles={allVehicles} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium">
                      <td className={td} colSpan={5}>
                        รวม {list.length} ครั้ง
                      </td>
                      <td className={`${td} text-right`}>{dist ? num(dist, 2) : "-"}</td>
                      <td className={`${td} text-right`}>{baht(amount)}</td>
                      <td className={`${td} text-right`}>{num(lit, 2)}</td>
                      <td className={`${td} text-right text-slate-400`}>{lit ? num(amount / lit, 2) : "-"}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
