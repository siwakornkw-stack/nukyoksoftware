import Link from "next/link";
import { fleetDashboard } from "@/lib/fleet/dashboard";
import { baht, num, thDate } from "@/lib/format";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { MonthlyCostChart } from "./Charts";

export const dynamic = "force-dynamic";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (m: string) => `${TH_MONTH[Number(m.slice(5, 7)) - 1]} ${(Number(m.slice(0, 4)) + 543) % 100}`;
const th = "py-2 pr-3 font-normal";
const td = "py-1.5 pr-3 text-right tabular-nums";
const pct = (a: number, b: number) => (b ? `${num((a / b) * 100, 1)}%` : "-");

export default async function FleetDashboard({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y > 2000 && y <= thisYear ? y : thisYear;
  const d = await fleetDashboard(year);
  const t = d.totals;
  const net = t.income - t.expense;

  const alerts: { tone: "rose" | "amber"; text: string; href: string }[] = [];
  if (d.installments.overdueCount)
    alerts.push({ tone: "rose", text: `ค่างวดเกินกำหนด ${d.installments.overdueCount} งวด ${baht(d.installments.overdue)}`, href: "/fleet/installments?filter=overdue" });
  const expired = d.renewals.filter((r) => r.days < 0).length;
  if (expired) alerts.push({ tone: "rose", text: `ภาษี / พ.ร.บ. / ประกัน หมดอายุแล้ว ${expired} รายการ`, href: "/fleet/insurance" });
  const soon = d.renewals.length - expired;
  if (soon) alerts.push({ tone: "amber", text: `ภาษี / พ.ร.บ. / ประกัน หมดใน 30 วัน ${soon} รายการ`, href: "/fleet/insurance" });
  if (d.fuelGaps.length)
    alerts.push({ tone: "amber", text: `ยังไม่มีข้อมูลค่าน้ำมันเดือน ${d.fuelGaps.map(monthLabel).join(", ")} (ยังไม่ได้นำเข้าไฟล์?)`, href: "/fleet/fuel/import" });
  if (d.incomeGaps.length)
    alerts.push({ tone: "amber", text: `ยังไม่มีข้อมูลรายรับเดือน ${d.incomeGaps.map(monthLabel).join(", ")}`, href: "/fleet/income/import" });

  const breakdown = [
    { label: "น้ำมัน", value: t.fuel, color: "bg-sky-400" },
    { label: "ซ่อม (บริษัทจ่าย)", value: t.repair, color: "bg-violet-400" },
    { label: "ภาษีรถ", value: t.tax, color: "bg-amber-400" },
    { label: "พ.ร.บ.", value: t.cmi, color: "bg-amber-300" },
    { label: "ประกันภัย", value: t.ins, color: "bg-yellow-300" },
    { label: "ค่างวดที่จ่าย", value: t.installments, color: "bg-rose-400" },
  ];
  const outflow = t.expense + t.installments;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="กองรถ & การเงิน"
        subtitle={`รายงานปี ${year + 543} · รายรับ ต้นทุนรถ ค่างวด และสิ่งที่ต้องทำ`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/fleet/reports/vehicles?year=${year}`} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              กำไร / ต้นทุนรายคัน
            </Link>
            <Link href="/fleet/vehicles" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ทะเบียนรถ
            </Link>
          </div>
        }
      />

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

      {alerts.length > 0 && (
        <Card className="mb-4">
          <div className="font-medium mb-2">ต้องจัดการ</div>
          <ul className="space-y-1.5 text-sm">
            {alerts.map((a) => (
              <li key={a.text} className="flex items-center justify-between gap-3">
                <span className={a.tone === "rose" ? "text-rose-300" : "text-amber-300"}>{a.text}</span>
                <Link href={a.href} className="shrink-0 text-xs text-sky-400 hover:underline">
                  ไปจัดการ →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        <StatCard
          label="รายรับ (ก่อน VAT)"
          value={baht(t.income)}
          sub={`ในระบบ ${baht(t.incomeTax)} · บิลนอก ${baht(t.incomeCash)}${t.incomeOther ? ` · อื่น ๆ ${baht(t.incomeOther)}` : ""}`}
          accent="emerald"
        />
        <StatCard
          label="ต้นทุนรถ"
          value={baht(t.expense)}
          sub={`น้ำมัน ${baht(t.fuel)} · ซ่อม ${baht(t.repair)} · ภาษี/ประกัน ${baht(t.premiums)}`}
          accent="rose"
        />
        <StatCard
          label="รายรับ - ต้นทุนรถ"
          value={baht(net)}
          sub={`ต้นทุนรถ ${pct(t.expense, t.income)} ของรายรับ · หลังหักค่างวด ${baht(net - t.installments)}`}
          accent={net >= 0 ? "sky" : "rose"}
        />
        <StatCard label="ค่างวดที่จ่ายแล้ว (ปีนี้)" value={baht(t.installments)} sub="นับตามวันที่จ่าย" accent="violet" />
        <StatCard
          label="ค่างวดค้างจ่าย"
          value={baht(d.installments.outstanding)}
          sub={`${num(d.installments.outstandingCount)} งวด · ${num(d.installments.vehicles)} คัน · ครบเดือนนี้ ${baht(d.installments.dueThisMonth)}`}
          accent={d.installments.overdueCount ? "rose" : "amber"}
        />
        <StatCard
          label="รถ / เครื่องจักรใช้งาน"
          value={num(d.vehicles.active)}
          sub={`เลิกใช้ ${num(d.vehicles.inactive)} · เติมน้ำมัน ${num(d.fuelFills)} ครั้ง ${num(d.fuelLiters)} ลิตร`}
          accent="sky"
        />
      </div>

      <MonthlyCostChart data={d.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} />

      <Card className="mt-4">
        <div className="font-medium mb-3">สรุปรายเดือน</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className={th}>เดือน</th>
                <th className={`${th} text-right`}>ในระบบ</th>
                <th className={`${th} text-right`}>บิลนอก</th>
                <th className={`${th} text-right`}>อื่น ๆ</th>
                <th className={`${th} text-right`}>รายรับรวม</th>
                <th className={`${th} text-right`}>น้ำมัน</th>
                <th className={`${th} text-right`}>ซ่อม</th>
                <th className={`${th} text-right`}>ภาษี/ประกัน</th>
                <th className={`${th} text-right`}>รายรับ - ต้นทุนรถ</th>
                <th className={`${th} text-right`}>ค่างวดจ่าย</th>
              </tr>
            </thead>
            <tbody>
              {d.months.map((m) => {
                const gap = d.fuelGaps.includes(m.month);
                return (
                  <tr key={m.month} className="border-b border-slate-800/50">
                    <td className="py-1.5 pr-3">{monthLabel(m.month)}</td>
                    <td className={td}>{m.incomeTax ? baht(m.incomeTax) : "-"}</td>
                    <td className={td}>{m.incomeCash ? baht(m.incomeCash) : "-"}</td>
                    <td className={td}>{m.incomeOther ? baht(m.incomeOther) : "-"}</td>
                    <td className={`${td} text-emerald-300`}>{m.income ? baht(m.income) : "-"}</td>
                    <td className={`${td} ${gap ? "text-amber-300" : ""}`}>{m.fuel ? baht(m.fuel) : gap ? "ไม่มีข้อมูล" : "-"}</td>
                    <td className={td}>{m.repair ? baht(m.repair) : "-"}</td>
                    <td className={td}>{m.premiums ? baht(m.premiums) : "-"}</td>
                    <td className={`${td} ${m.income - m.expense < 0 ? "text-rose-300" : ""}`}>{m.income || m.expense ? baht(m.income - m.expense) : "-"}</td>
                    <td className={td}>{m.installments ? baht(m.installments) : "-"}</td>
                  </tr>
                );
              })}
              <tr className="font-medium">
                <td className="py-2 pr-3">รวม</td>
                <td className={td}>{baht(t.incomeTax)}</td>
                <td className={td}>{baht(t.incomeCash)}</td>
                <td className={td}>{baht(t.incomeOther)}</td>
                <td className={`${td} text-emerald-300`}>{baht(t.income)}</td>
                <td className={td}>{baht(t.fuel)}</td>
                <td className={td}>{baht(t.repair)}</td>
                <td className={td}>{baht(t.premiums)}</td>
                <td className={td}>{baht(net)}</td>
                <td className={td}>{baht(t.installments)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          ต้นทุนรถยังไม่รวมค่าใช้จ่ายอื่นของบริษัท (เงินเดือน ค่าวัสดุ ฯลฯ) · ภาษี/พ.ร.บ. นับปีก่อนวันหมดอายุ ประกันนับตามวันเริ่มคุ้มครอง
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <div className="font-medium mb-3">เงินออกทั้งปี {baht(outflow)}</div>
          <div className="space-y-2.5 text-sm">
            {breakdown.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between">
                  <span className="text-slate-300">{b.label}</span>
                  <span className="tabular-nums">
                    {baht(b.value)} <span className="text-slate-500">({pct(b.value, outflow)})</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-slate-800">
                  <div className={`h-1.5 rounded ${b.color}`} style={{ width: outflow ? `${(b.value / outflow) * 100}%` : 0 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-3">
            ลูกค้าสูงสุด 10 ราย <span className="text-xs text-slate-500">จากทั้งหมด {num(d.customerCount)} ราย</span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {d.topCustomers.map((c) => (
                <tr key={c.name} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3">
                    {c.name}
                    <span className="text-xs text-slate-500"> · {num(c.docs)} ใบ</span>
                  </td>
                  <td className={td}>{baht(c.amount)}</td>
                  <td className="py-1.5 text-right text-xs text-slate-500">{pct(c.amount, t.income)}</td>
                </tr>
              ))}
              {!d.topCustomers.length && (
                <tr>
                  <td className="py-6 text-center text-slate-500">ยังไม่มีรายรับในปีนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <div className="font-medium mb-3">ค่าน้ำมันสูงสุด 10 คัน</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className={th}>ทะเบียน</th>
                  <th className={`${th} text-right`}>ค่าน้ำมัน</th>
                  <th className={`${th} text-right`}>ลิตร</th>
                  <th className={`${th} text-right`}>ครั้ง</th>
                  <th className={`${th} text-right`}>ซ่อม</th>
                </tr>
              </thead>
              <tbody>
                {d.topFuel.map((v) => (
                  <tr key={v.vehicleId} className="border-b border-slate-800/50">
                    <td className="py-1.5 pr-3">
                      <Link href={`/fleet/vehicles/${v.vehicleId}`} className="text-sky-400 hover:underline">
                        {v.plate}
                      </Link>
                    </td>
                    <td className={td}>{baht(v.amount)}</td>
                    <td className={td}>{num(v.liters)}</td>
                    <td className={td}>{num(v.fills)}</td>
                    <td className={td}>{v.repair ? baht(v.repair) : "-"}</td>
                  </tr>
                ))}
                {!d.topFuel.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      ยังไม่มีค่าน้ำมันในปีนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Link href="/fleet/fuel" className="text-sm text-sky-400 hover:underline">
              รายงานน้ำมัน →
            </Link>
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-3">ภาษี / พ.ร.บ. / ประกัน หมดอายุ และใกล้หมดใน 30 วัน</div>
          <table className="w-full text-sm">
            <tbody>
              {d.renewals.slice(0, 15).map((r) => (
                <tr key={`${r.vehicleId}|${r.kind}`} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3">
                    <Link href={`/fleet/vehicles/${r.vehicleId}`} className="text-sky-400 hover:underline">
                      {r.plate}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-300">{r.kind}</td>
                  <td className="py-1.5 pr-3 text-slate-400">{thDate(r.end)}</td>
                  <td className={`py-1.5 text-right ${r.days < 0 ? "text-rose-400" : "text-amber-300"}`}>
                    {r.days < 0 ? `หมดแล้ว ${-r.days} วัน` : `อีก ${r.days} วัน`}
                  </td>
                </tr>
              ))}
              {!d.renewals.length && (
                <tr>
                  <td className="py-6 text-center text-slate-500">ไม่มีรายการที่ต้องต่ออายุใน 30 วัน</td>
                </tr>
              )}
            </tbody>
          </table>
          {d.renewals.length > 15 && <div className="mt-2 text-xs text-slate-500">และอีก {d.renewals.length - 15} รายการ</div>}
          <div className="mt-3">
            <Link href="/fleet/insurance" className="text-sm text-sky-400 hover:underline">
              รายงาน พ.ร.บ. & ประกัน →
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="font-medium mb-3">ค่างวดที่ต้องจ่าย (เรียงตามวันครบกำหนด)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className={th}>ทะเบียน</th>
                <th className={th}>งวด</th>
                <th className={th}>ครบกำหนด</th>
                <th className={`${th} text-right`}>ยอด</th>
                <th className={`${th} text-right`}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {d.installments.next.map((i) => (
                <tr key={`${i.vehicleId}|${i.no}`} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3">
                    <Link href={`/fleet/installments?vehicle=${i.vehicleId}`} className="text-sky-400 hover:underline">
                      {i.plate}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">{i.no}</td>
                  <td className="py-1.5 pr-3 text-slate-400">{thDate(i.due)}</td>
                  <td className={td}>{baht(i.amount)}</td>
                  <td className={`py-1.5 text-right ${i.days > 0 ? "text-rose-400" : "text-slate-400"}`}>
                    {i.days > 0 ? `เกิน ${i.days} วัน` : i.days === 0 ? "วันนี้" : `อีก ${-i.days} วัน`}
                  </td>
                </tr>
              ))}
              {!d.installments.next.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    ไม่มีค่างวดค้างจ่าย
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
  );
}
