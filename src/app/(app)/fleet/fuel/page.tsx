import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht, num, thDate } from "@/lib/format";
import {
  ANOMALY_LABEL,
  addMonths,
  analyzeFuel,
  fuelFilterOptions,
  loadFuelRecords,
  monthsBetween,
  resolveRange,
  thMonth,
  type AnomalyKind,
} from "@/lib/fleet/fuel-report";
import { FuelTrendChart, FuelVehicleChart } from "../Charts";
import { FuelFilters } from "./FuelFilters";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string; vehicle?: string; receiver?: string };

function pct(cur: number, prev: number) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function Change({ cur, prev }: { cur: number; prev: number }) {
  const p = pct(cur, prev);
  if (p == null) return <span className="text-slate-500">-</span>;
  return <span className={p > 0 ? "text-rose-300" : "text-emerald-300"}>{p > 0 ? "▲" : "▼"} {Math.abs(p)}%</span>;
}

const th = "py-2 pr-3 font-normal";
const td = "py-2 pr-3";

export default async function FuelReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const opts = await fuelFilterOptions();
  const { from, to } = resolveRange(sp, opts.latestMonth);
  const months = monthsBetween(from, to);
  const prevTo = addMonths(from, -1);
  const prevFrom = addMonths(from, -months.length);
  const filter = { vehicleId: sp.vehicle || undefined, receiver: sp.receiver || undefined };

  const [rows, prevRows] = await Promise.all([
    loadFuelRecords({ from, to, ...filter }),
    loadFuelRecords({ from: prevFrom, to: prevTo, ...filter }),
  ]);
  const r = analyzeFuel(rows, months);
  const prev = analyzeFuel(prevRows, []);
  const prevByVehicle = new Map(prev.byVehicle.map((v) => [v.vehicleId, v.amount]));

  const rangeText = from === to ? thMonth(from) : `${thMonth(from)} - ${thMonth(to)}`;
  const prevText = prevFrom === prevTo ? thMonth(prevFrom) : `${thMonth(prevFrom)} - ${thMonth(prevTo)}`;
  const recordsHref = (extra: Record<string, string>) =>
    `/fleet/fuel/records?${new URLSearchParams({ from, to, ...(sp.receiver ? { receiver: sp.receiver } : {}), ...extra })}`;

  const anomalyCount = new Map<AnomalyKind, number>();
  for (const a of r.anomalies) anomalyCount.set(a.kind, (anomalyCount.get(a.kind) ?? 0) + 1);
  // Missing invoice/liters are data-entry gaps, not red flags; list them last.
  const serious = r.anomalies.filter((a) => a.kind !== "noInvoice" && a.kind !== "noLiters");
  const gaps = r.anomalies.filter((a) => a.kind === "noInvoice" || a.kind === "noLiters");

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="รายงานน้ำมัน"
        subtitle={`${rangeText} · เทียบกับ ${prevText}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={recordsHref(sp.vehicle ? { vehicle: sp.vehicle } : {})} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              รายละเอียด
            </Link>
            <Link href="/fleet/fuel/import" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              นำเข้าไฟล์
            </Link>
          </div>
        }
      />

      <FuelFilters action="/fleet/fuel" from={from} to={to} vehicle={sp.vehicle} receiver={sp.receiver} {...opts} />

      {!rows.length ? (
        <Card>
          <div className="py-10 text-center text-slate-400">
            ไม่มีข้อมูลน้ำมันในช่วงนี้ -{" "}
            <Link href="/fleet/fuel/import" className="text-sky-400 hover:underline">
              นำเข้าไฟล์ค่าน้ำมัน
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-6 mb-4">
            <StatCard
              label="ค่าน้ำมันรวม"
              value={baht(r.totals.amount)}
              sub={
                <>
                  ช่วงก่อน {baht(prev.totals.amount)} <Change cur={r.totals.amount} prev={prev.totals.amount} />
                </>
              }
              accent="sky"
            />
            <StatCard
              label="ปริมาณรวม"
              value={`${num(r.totals.liters, 2)} ลิตร`}
              sub={
                <>
                  ช่วงก่อน {num(prev.totals.liters, 2)} <Change cur={r.totals.liters} prev={prev.totals.liters} />
                </>
              }
              accent="amber"
            />
            <StatCard
              label="ราคาเฉลี่ย / ลิตร"
              value={`${num(r.totals.avgPrice, 2)} ฿`}
              sub={
                <>
                  ช่วงก่อน {num(prev.totals.avgPrice, 2)} <Change cur={r.totals.avgPrice} prev={prev.totals.avgPrice} />
                </>
              }
              accent="violet"
            />
            <StatCard label="จำนวนครั้งที่เติม" value={`${num(r.totals.count)} ครั้ง`} sub={`เฉลี่ย ${baht(r.totals.count ? Math.round(r.totals.amount / r.totals.count) : 0)} / ครั้ง`} accent="emerald" />
            <StatCard label="รถ / เครื่องจักรที่เติม" value={`${r.totals.vehicles} คัน`} sub={`เฉลี่ย ${baht(Math.round(r.totals.perVehicle))} / คัน`} accent="sky" />
            <StatCard
              label="ระยะทาง / ชั่วโมงงานรวม"
              value={num(r.totals.distance, 1)}
              sub={r.totals.bahtPerKm ? `${num(r.totals.bahtPerKm, 2)} บาท ต่อ กม./ชม.` : "ไม่มีเลขไมล์"}
              accent="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <FuelTrendChart data={r.monthly.map((m) => ({ ...m, label: thMonth(m.month) }))} />
            <FuelVehicleChart data={r.byVehicle.slice(0, 15).map((v) => ({ plate: v.plate, amount: v.amount }))} />
          </div>

          <Card className="mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <div className="font-medium">สรุปรายคัน</div>
              <div className="text-xs text-slate-500">
                ระยะทาง = เลขไมล์สูงสุด - ต่ำสุดในช่วง (เครื่องจักรเป็นชั่วโมงงาน) · กดทะเบียนเพื่อดูทุกรายการ
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className={th}>#</th>
                    <th className={th}>ทะเบียน / รุ่น</th>
                    <th className={`${th} text-right`}>ครั้ง</th>
                    <th className={`${th} text-right`}>ลิตร</th>
                    <th className={`${th} text-right`}>จำนวนเงิน</th>
                    <th className={th}>สัดส่วน</th>
                    <th className={`${th} text-right`}>฿/ลิตร</th>
                    <th className={`${th} text-right`}>ระยะทาง</th>
                    <th className={`${th} text-right`}>฿/กม.</th>
                    <th className={`${th} text-right`}>กม./ลิตร</th>
                    <th className={`${th} text-right`}>เฉลี่ย/ครั้ง</th>
                    <th className={`${th} text-right`}>เทียบช่วงก่อน</th>
                    <th className={th}>ผู้รับน้ำมัน</th>
                    <th className={th}>เติมล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byVehicle.map((v, i) => (
                    <tr key={v.vehicleId} className="border-b border-slate-800/50">
                      <td className={`${td} text-slate-500`}>{i + 1}</td>
                      <td className={td}>
                        <Link href={recordsHref({ vehicle: v.vehicleId })} className="text-sky-400 hover:underline">
                          {v.plate}
                        </Link>
                        {v.model && v.model !== v.plate && <div className="text-xs text-slate-500">{v.model}</div>}
                      </td>
                      <td className={`${td} text-right`}>{v.count}</td>
                      <td className={`${td} text-right`}>{num(v.liters, 2)}</td>
                      <td className={`${td} text-right font-medium`}>{baht(v.amount)}</td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded bg-slate-800">
                            <div className="h-1.5 rounded bg-sky-400" style={{ width: `${Math.min(100, v.share)}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{v.share}%</span>
                        </div>
                      </td>
                      <td className={`${td} text-right`}>{num(v.avgPrice, 2)}</td>
                      <td className={`${td} text-right`}>{v.distance ? num(v.distance, 1) : "-"}</td>
                      <td className={`${td} text-right`}>{v.bahtPerKm ? num(v.bahtPerKm, 2) : "-"}</td>
                      <td className={`${td} text-right`}>{v.kmPerLiter ? num(v.kmPerLiter, 2) : "-"}</td>
                      <td className={`${td} text-right`}>{baht(Math.round(v.perFill))}</td>
                      <td className={`${td} text-right text-xs`}>
                        <Change cur={v.amount} prev={prevByVehicle.get(v.vehicleId) ?? 0} />
                      </td>
                      <td className={`${td} text-slate-400`}>{v.receivers.join(", ") || "-"}</td>
                      <td className={`${td} text-slate-400`}>{thDate(v.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className={td} />
                    <td className={td}>รวม {r.totals.vehicles} คัน</td>
                    <td className={`${td} text-right`}>{r.totals.count}</td>
                    <td className={`${td} text-right`}>{num(r.totals.liters, 2)}</td>
                    <td className={`${td} text-right`}>{baht(r.totals.amount)}</td>
                    <td className={td}>100%</td>
                    <td className={`${td} text-right`}>{num(r.totals.avgPrice, 2)}</td>
                    <td className={`${td} text-right`}>{num(r.totals.distance, 1)}</td>
                    <td className={`${td} text-right`}>{r.totals.bahtPerKm ? num(r.totals.bahtPerKm, 2) : "-"}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <Card>
              <div className="font-medium mb-3">แยกตามผู้รับน้ำมัน</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className={th}>ผู้รับ</th>
                    <th className={`${th} text-right`}>รถ</th>
                    <th className={`${th} text-right`}>ครั้ง</th>
                    <th className={`${th} text-right`}>ลิตร</th>
                    <th className={`${th} text-right`}>จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byReceiver.map((x) => (
                    <tr key={x.name} className="border-b border-slate-800/50">
                      <td className={td}>
                        {x.name === "-" ? (
                          <span className="text-slate-500">ไม่ระบุ</span>
                        ) : (
                          <Link href={recordsHref({ receiver: x.name })} className="text-sky-400 hover:underline">
                            {x.name}
                          </Link>
                        )}
                      </td>
                      <td className={`${td} text-right`}>{x.vehicles}</td>
                      <td className={`${td} text-right`}>{x.count}</td>
                      <td className={`${td} text-right`}>{num(x.liters, 2)}</td>
                      <td className={`${td} text-right`}>{baht(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="space-y-4">
              <Card>
                <div className="font-medium mb-3">แยกตามชนิดน้ำมัน</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className={th}>รายการ</th>
                      <th className={`${th} text-right`}>ครั้ง</th>
                      <th className={`${th} text-right`}>ลิตร</th>
                      <th className={`${th} text-right`}>฿/ลิตร</th>
                      <th className={`${th} text-right`}>จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byItem.map((x) => (
                      <tr key={x.item} className="border-b border-slate-800/50">
                        <td className={td}>{x.item}</td>
                        <td className={`${td} text-right`}>{x.count}</td>
                        <td className={`${td} text-right`}>{num(x.liters, 2)}</td>
                        <td className={`${td} text-right`}>{num(x.avgPrice, 2)}</td>
                        <td className={`${td} text-right`}>{baht(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <div className="font-medium mb-3">รายเดือน</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className={th}>เดือน</th>
                      <th className={`${th} text-right`}>ครั้ง</th>
                      <th className={`${th} text-right`}>ลิตร</th>
                      <th className={`${th} text-right`}>฿/ลิตร</th>
                      <th className={`${th} text-right`}>จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.monthly.map((m) => (
                      <tr key={m.month} className="border-b border-slate-800/50">
                        <td className={td}>
                          <Link href={`/fleet/fuel?${new URLSearchParams({ from: m.month, to: m.month, ...(sp.vehicle ? { vehicle: sp.vehicle } : {}) })}`} className="text-sky-400 hover:underline">
                            {thMonth(m.month)}
                          </Link>
                        </td>
                        <td className={`${td} text-right`}>{m.count}</td>
                        <td className={`${td} text-right`}>{num(m.liters, 2)}</td>
                        <td className={`${td} text-right`}>{m.avgPrice ? num(m.avgPrice, 2) : "-"}</td>
                        <td className={`${td} text-right`}>{baht(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>

          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <div className="font-medium">ตรวจสอบความผิดปกติ</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(ANOMALY_LABEL) as AnomalyKind[]).map((k) => (
                  <span
                    key={k}
                    className={`rounded-md border px-2 py-0.5 ${
                      anomalyCount.get(k) ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-slate-700 text-slate-500"
                    }`}
                  >
                    {ANOMALY_LABEL[k]} {anomalyCount.get(k) ?? 0}
                  </span>
                ))}
              </div>
            </div>
            {!r.anomalies.length ? (
              <div className="py-6 text-center text-emerald-300 text-sm">ไม่พบรายการผิดปกติ</div>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className={th}>วันที่</th>
                      <th className={th}>ทะเบียน</th>
                      <th className={th}>ประเภท</th>
                      <th className={th}>รายละเอียด</th>
                      <th className={th}>เลขใบกำกับ</th>
                      <th className={`${th} text-right`}>ลิตร</th>
                      <th className={`${th} text-right`}>จำนวนเงิน</th>
                      <th className={th}>ผู้รับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...serious, ...gaps].map((a, i) => (
                      <tr key={`${a.row.id}-${a.kind}-${i}`} className="border-b border-slate-800/50">
                        <td className={`${td} text-slate-400`}>{thDate(a.row.date)}</td>
                        <td className={td}>
                          <Link href={recordsHref({ vehicle: a.row.vehicleId })} className="text-sky-400 hover:underline">
                            {a.row.plate}
                          </Link>
                        </td>
                        <td className={td}>
                          <span className={a.kind === "noInvoice" || a.kind === "noLiters" ? "text-slate-400" : "text-amber-300"}>
                            {ANOMALY_LABEL[a.kind]}
                          </span>
                        </td>
                        <td className={`${td} text-slate-300`}>{a.detail}</td>
                        <td className={`${td} text-slate-400`}>{a.row.invoice || "-"}</td>
                        <td className={`${td} text-right`}>{num(a.row.liters, 2)}</td>
                        <td className={`${td} text-right`}>{baht(a.row.amount)}</td>
                        <td className={`${td} text-slate-400`}>{a.row.receiver || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
