import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { baht } from "@/lib/format";
import {
  KINDS,
  KIND_LABEL,
  KIND_RECORD,
  STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  daysText,
  loadInsuranceRecords,
  type Kind,
  type Status,
} from "@/lib/fleet/insurance-report";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateText } from "@/lib/fleet/plates";
import { InsRow } from "./InsRow";

export const dynamic = "force-dynamic";

type SP = { kind?: string; status?: string; vehicle?: string; q?: string; latest?: string };

const th = "py-2 pr-3 font-normal";

export default async function InsuranceRecordsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const kind = KINDS.includes(sp.kind as Kind) ? (sp.kind as Kind) : null;
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : null;
  const latestOnly = sp.latest === "1";
  const q = (sp.q ?? "").trim().toLowerCase();

  const [all, vehicleRows] = await Promise.all([
    loadInsuranceRecords(),
    prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true },
    }),
  ]);
  const allVehicles = vehicleRows
    .map((v) => {
      const plate = plateText(v) || v.Model;
      return { id: v.VehicleId, plate: v.Model && v.Model !== plate ? `${plate} - ${v.Model}` : plate };
    })
    .sort((a, b) => a.plate.localeCompare(b.plate, "th"));
  const vehicles = [...new Map(all.map((r) => [r.vehicleId, r.plate])).entries()].sort((a, b) => a[1].localeCompare(b[1], "th"));

  const newest = new Map<string, string>();
  for (const r of all) {
    const k = `${r.kind}|${r.vehicleId}`;
    if (!newest.has(k) || newest.get(k)! < r.end) newest.set(k, r.end);
  }
  const isLatest = (r: (typeof all)[number]) => newest.get(`${r.kind}|${r.vehicleId}`) === r.end;

  const rows = all
    .filter((r) => !kind || r.kind === kind)
    .filter((r) => !status || r.status === status)
    .filter((r) => !sp.vehicle || r.vehicleId === sp.vehicle)
    .filter((r) => !latestOnly || isLatest(r))
    .filter((r) => !q || `${r.plate} ${r.model} ${r.company} ${r.cls} ${r.note}`.toLowerCase().includes(q))
    .sort((a, b) => a.end.localeCompare(b.end) || a.plate.localeCompare(b.plate, "th"));

  const premium = rows.reduce((a, r) => a + r.premium, 0);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="รายละเอียด พ.ร.บ. & ประกัน"
        subtitle={`${rows.length} รายการ · เบี้ยรวม ${baht(premium)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/insurance" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ส่งออก Excel
            </a>
            <Link href="/fleet/insurance" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              รายงาน
            </Link>
            <Link href="/fleet/insurance/import" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              นำเข้าไฟล์
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <form action="/fleet/insurance/records" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">ประเภท</span>
            <select name="kind" defaultValue={kind ?? ""} className="field">
              <option value="">ทั้งหมด</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">สถานะ</span>
            <select name="status" defaultValue={status ?? ""} className="field">
              <option value="">ทั้งหมด</option>
              {STATUSES.filter((s) => s !== "none").map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">รถ</span>
            <select name="vehicle" defaultValue={sp.vehicle ?? ""} className="field">
              <option value="">ทั้งหมด</option>
              {vehicles.map(([id, plate]) => (
                <option key={id} value={id}>
                  {plate}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">ค้นหา</span>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="ทะเบียน / บริษัท / หมายเหตุ" className="field" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
            <input type="checkbox" name="latest" value="1" defaultChecked={latestOnly} />
            เฉพาะรายการล่าสุดของแต่ละคัน
          </label>
          <button className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">แสดง</button>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className={th}>ประเภท</th>
                <th className={th}>ทะเบียน</th>
                <th className={th}>ปี</th>
                <th className={th}>วันเริ่ม</th>
                <th className={th}>วันหมดอายุ</th>
                <th className={th}>สถานะ</th>
                <th className={th}>ชั้น</th>
                <th className={th}>บริษัท</th>
                <th className={`${th} text-right`}>เบี้ย</th>
                <th className={th}>หมายเหตุ</th>
                <th className={th}>ผู้บันทึก</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <InsRow
                  key={`${r.kind}-${r.id}`}
                  row={r}
                  label={KIND_LABEL[r.kind]}
                  recordType={KIND_RECORD[r.kind]}
                  latest={isLatest(r)}
                  statusLabel={STATUS_LABEL[r.status]}
                  statusStyle={STATUS_STYLE[r.status]}
                  daysText={daysText(r.days)}
                  vehicles={allVehicles}
                />
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
                    ไม่พบรายการ
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
