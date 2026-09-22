import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht, thDate } from "@/lib/format";
import {
  KINDS,
  KIND_LABEL,
  STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  daysText,
  getCoverage,
  thMonthShort,
  type InsRecord,
  type Kind,
  type Status,
} from "@/lib/fleet/insurance-report";
import { ExpiryChart } from "../Charts";

export const dynamic = "force-dynamic";

type SP = { status?: string; kind?: string; all?: string };

const th = "py-2 pr-3 font-normal";
const td = "py-2 pr-3";

function Cell({ r, showCompany }: { r?: InsRecord; showCompany?: boolean }) {
  if (!r) return <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE.none}`}>ไม่มีข้อมูล</span>;
  return (
    <div>
      <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[r.status]}`}>{thDate(r.end)}</span>
      <div className="text-xs text-slate-500 mt-0.5">{daysText(r.days)}</div>
      {showCompany && (r.cls || r.company) && (
        <div className="text-xs text-slate-400">{[r.cls, r.company].filter(Boolean).join(" · ")}</div>
      )}
    </div>
  );
}

export default async function InsuranceReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const includeEmpty = sp.all === "1";
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : null;
  const kind = KINDS.includes(sp.kind as Kind) ? (sp.kind as Kind) : null;
  const r = await getCoverage(includeEmpty || status === "none");

  const kinds = kind ? [kind] : KINDS;
  const rows = status ? r.coverage.filter((c) => kinds.some((k) => (c.latest[k]?.status ?? "none") === status)) : r.coverage;

  const href = (p: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const merged = { status: status ?? "", kind: kind ?? "", all: includeEmpty ? "1" : "", ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/fleet/insurance?${s}` : "/fleet/insurance";
  };

  const due30All = KINDS.reduce((a, k) => a + r.stats[k].due30, 0);
  const expiredAll = KINDS.reduce((a, k) => a + r.stats[k].expired, 0);

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="รายงาน พ.ร.บ. & ประกัน"
        subtitle={`สถานะล่าสุดของแต่ละคัน ณ วันนี้ · ${r.coverage.length} คันที่มีข้อมูล`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/fleet/insurance/records" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              รายละเอียด
            </Link>
            <Link href="/fleet/insurance/import" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              นำเข้าไฟล์
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="หมดอายุแล้ว (ทุกประเภท)" value={`${expiredAll} รายการ`} sub="ต้องต่ออายุทันที" accent="rose" />
        <StatCard label="จะหมดใน 30 วัน" value={`${due30All} รายการ`} sub="ควรเริ่มดำเนินการต่อ" accent="amber" />
        <StatCard label="รถที่ยังไม่มีข้อมูลเลย" value={`${r.vehiclesWithout} คัน`} sub={`จากรถใช้งาน ${r.totalVehicles} คัน`} accent="violet" />
        <StatCard label="เบี้ยรวม (รายการปัจจุบัน)" value={baht(r.premium)} sub="ประกัน + พ.ร.บ. + ภาษี ล่าสุดของแต่ละคัน" accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        {KINDS.map((k) => (
          <Card key={k}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">{KIND_LABEL[k]}</div>
              <Link href={href({ kind: k, status: null })} className="text-xs text-sky-400 hover:underline">
                ดูเฉพาะ{KIND_LABEL[k]}
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {STATUSES.map((s) => (
                <Link
                  key={s}
                  href={href({ kind: k, status: s, all: s === "none" ? "1" : includeEmpty ? "1" : null })}
                  className={`rounded-lg border px-1 py-2 hover:brightness-125 ${STATUS_STYLE[s]}`}
                >
                  <div className="text-lg font-semibold">{r.stats[k][s]}</div>
                  <div className="text-[10px] leading-tight">{STATUS_LABEL[s]}</div>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <ExpiryChart data={r.forecast.map((f) => ({ ...f, label: thMonthShort(f.month) }))} />
        <Card>
          <div className="font-medium mb-3">ต้องดำเนินการ (หมดแล้ว / ภายใน 90 วัน)</div>
          <div className="max-h-[260px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {r.upcoming.map((u) => (
                  <tr key={`${u.kind}-${u.id}`} className="border-b border-slate-800/50">
                    <td className={td}>
                      <Link href={`/fleet/vehicles/${u.vehicleId}/records`} className="text-sky-400 hover:underline">
                        {u.plate}
                      </Link>
                    </td>
                    <td className={td}>{KIND_LABEL[u.kind]}</td>
                    <td className={td}>
                      <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[u.status]}`}>{thDate(u.end)}</span>
                    </td>
                    <td className={`${td} text-xs text-slate-400`}>{daysText(u.days)}</td>
                    <td className={`${td} text-xs text-slate-500`}>{u.note}</td>
                  </tr>
                ))}
                {!r.upcoming.length && (
                  <tr>
                    <td className="py-6 text-center text-emerald-300">ไม่มีรายการที่ต้องต่ออายุใน 90 วัน</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="font-medium">
            สถานะรายคัน
            {kind && <span className="text-slate-400"> · {KIND_LABEL[kind]}</span>}
            {status && <span className="text-slate-400"> · {STATUS_LABEL[status]}</span>}
            <span className="text-slate-500 text-sm"> ({rows.length} คัน)</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href={href({ status: null })} className={`rounded-lg border px-2.5 py-1 ${!status ? "border-sky-500/40 bg-sky-500/20 text-sky-200" : "border-slate-700 text-slate-300"}`}>
              ทั้งหมด
            </Link>
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={href({ status: s, all: s === "none" ? "1" : includeEmpty ? "1" : null })}
                className={`rounded-lg border px-2.5 py-1 ${status === s ? STATUS_STYLE[s] : "border-slate-700 text-slate-300"}`}
              >
                {STATUS_LABEL[s]}
              </Link>
            ))}
            {kind && (
              <Link href={href({ kind: null })} className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300">
                ทุกประเภท ✕
              </Link>
            )}
            <Link href={href({ all: includeEmpty ? null : "1" })} className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300">
              {includeEmpty ? "ซ่อนรถที่ไม่มีข้อมูล" : "แสดงรถทุกคัน"}
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className={th}>ทะเบียน</th>
                <th className={th}>ประเภท / ลักษณะ</th>
                <th className={th}>คนขับ</th>
                <th className={th}>ประกันภัย</th>
                <th className={th}>พ.ร.บ.</th>
                <th className={th}>ภาษี</th>
                <th className={th}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.vehicleId} className="border-b border-slate-800/50 align-top">
                  <td className={td}>
                    <Link href={`/fleet/vehicles/${c.vehicleId}/records`} className="text-sky-400 hover:underline">
                      {c.plate}
                    </Link>
                    {c.model && c.model !== c.plate && <div className="text-xs text-slate-500">{c.model}</div>}
                  </td>
                  <td className={`${td} text-slate-400`}>{c.characteristic || "-"}</td>
                  <td className={`${td} text-slate-400`}>{c.driver || "-"}</td>
                  <td className={td}>
                    <Cell r={c.latest.ins} showCompany />
                  </td>
                  <td className={td}>
                    <Cell r={c.latest.cmi} />
                  </td>
                  <td className={td}>
                    <Cell r={c.latest.tax} />
                  </td>
                  <td className={`${td} text-xs text-slate-400 max-w-56`}>{c.note || "-"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    ไม่มีข้อมูล -{" "}
                    <Link href="/fleet/insurance/import" className="text-sky-400 hover:underline">
                      นำเข้าไฟล์ตารางประกัน
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            ["บริษัทประกันภัย", r.byCompany],
            ["ชั้นประกัน", r.byClass],
          ] as const
        ).map(([title, list]) => (
          <Card key={title}>
            <div className="font-medium mb-3">แยกตาม{title} (ประกันภัยปัจจุบัน)</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className={th}>{title}</th>
                  <th className={`${th} text-right`}>คัน</th>
                  <th className={`${th} text-right`}>หมดอายุแล้ว</th>
                  <th className={`${th} text-right`}>เบี้ยรวม</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.name} className="border-b border-slate-800/50">
                    <td className={td}>{x.name}</td>
                    <td className={`${td} text-right`}>{x.count}</td>
                    <td className={`${td} text-right ${x.expired ? "text-rose-300" : "text-slate-500"}`}>{x.expired}</td>
                    <td className={`${td} text-right`}>{baht(x.premium)}</td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
