import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { num, thDate } from "@/lib/format";
import { oilStatusAll } from "@/lib/fleet/maintenance";
import { IntervalForm } from "./IntervalForm";
import { RowInterval } from "./RowInterval";
import { getSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS = {
  overdue: { label: "เกินระยะ", cls: "text-rose-300" },
  soon: { label: "ใกล้ถึง", cls: "text-amber-300" },
  ok: { label: "ปกติ", cls: "text-emerald-300" },
  unknown: { label: "ข้อมูลไม่พอ", cls: "text-slate-500" },
} as const;

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function MaintenancePage() {
  const [{ intervalKm, rows }, session] = await Promise.all([oilStatusAll(), getSession()]);
  const admin = !!session && isAdmin(session);
  const count = (s: keyof typeof STATUS) => rows.filter((r) => r.status === s).length;

  return (
    <div className="max-w-6xl">
      <PageHeader title="บำรุงรักษาตามเลขไมล์" subtitle={`ค่าเริ่มต้น: เปลี่ยนน้ำมันเครื่องทุก ${num(intervalKm)} กม. · ตั้งรายคันได้ (เครื่องจักรใช้ชั่วโมงทำงาน)`} action={admin ? <IntervalForm current={intervalKm} /> : undefined} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <StatCard label="เกินระยะ" value={`${count("overdue")} คัน`} accent="rose" />
        <StatCard label="ใกล้ถึง" value={`${count("soon")} คัน`} accent="amber" />
        <StatCard label="ปกติ" value={`${count("ok")} คัน`} accent="emerald" />
        <StatCard label="ข้อมูลไม่พอ" value={`${count("unknown")} คัน`} accent="sky" />
      </div>

      <Card>
        <div className="text-xs text-slate-500 mb-3">
          &quot;ข้อมูลไม่พอ&quot; = ยังไม่มีบันทึกเปลี่ยนน้ำมันเครื่องที่ใส่เลขไมล์ หรือไม่มีเลขไมล์จากบิลน้ำมัน วันที่คาดการณ์คำนวณจากระยะทางเฉลี่ย 90 วันล่าสุด
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">รถ</th>
                <th className="py-2 pr-3 text-right">ระยะเปลี่ยน</th>
                <th className="py-2 pr-3 text-right">เลขไมล์/ชม. ล่าสุด</th>
                <th className="py-2 pr-3">เปลี่ยนล่าสุด</th>
                <th className="py-2 pr-3 text-right">ใช้งานมาแล้ว</th>
                <th className="py-2 pr-3 text-right">เหลือ</th>
                <th className="py-2 pr-3 text-right">ต่อวัน</th>
                <th className="py-2 pr-3">คาดว่าถึงกำหนด</th>
                <th className="py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vehicleId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">
                    <Link href={`/fleet/vehicles/${r.vehicleId}/records`} className="hover:text-sky-300">{r.plate}</Link>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {admin ? <RowInterval vehicleId={r.vehicleId} value={r.interval} custom={r.custom} /> : <span className={r.custom ? "" : "text-slate-500"}>{num(r.interval)}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right">{r.currentKm == null ? "-" : num(r.currentKm)}</td>
                  <td className="py-2 pr-3 text-slate-400">
                    {r.lastOilDate ? `${thDate(iso(r.lastOilDate))}${r.lastOilKm ? ` @ ${num(r.lastOilKm)}` : ""}` : "-"}
                  </td>
                  <td className="py-2 pr-3 text-right">{r.sinceKm == null ? "-" : num(r.sinceKm)}</td>
                  <td className={`py-2 pr-3 text-right ${STATUS[r.status].cls}`}>{r.remainingKm == null ? "-" : num(r.remainingKm)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{r.kmPerDay == null ? "-" : num(r.kmPerDay)}</td>
                  <td className="py-2 pr-3 text-slate-400">{r.dueDate ? thDate(iso(r.dueDate)) : "-"}</td>
                  <td className={`py-2 ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
