"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { baht, num } from "@/lib/format";
import { FuelCharts } from "./Charts";

interface Bill {
  id: number;
  lineUserId: string;
  employeeName: string | null;
  imageUrl: string | null;
  receiptNo: string | null;
  station: string | null;
  billDate: string | null;
  billTime: string | null;
  fuelType: string | null;
  liters: number | null;
  pricePerLiter: number | null;
  total: number | null;
  plate: string | null;
  status: string;
  suspectReasons: string | null;
  createdAt: string;
}

interface MonthlyRow {
  ym: string;
  employee: string;
  count: number;
  liters: number;
  baht: number;
  suspects: number;
}

const STATUS_LABEL: Record<string, string> = {
  ok: "ปกติ",
  suspect: "น่าสงสัย",
  extract_failed: "อ่านไม่สำเร็จ",
};
const STATUS_CLASS: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  suspect: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  extract_failed: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const dateKey = (b: Bill) => (b.billDate ?? b.createdAt.slice(0, 10)).slice(0, 10);
const empKey = (b: Bill) => b.employeeName || b.lineUserId;

export default function FuelDashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [adminId, setAdminId] = useState("");
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (employee) p.set("employee", employee);
    if (status) p.set("status", status);
    return p.toString();
  }, [from, to, employee, status]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/fuel/bills?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setBills(d.bills ?? []);
        setEmployees(d.employees ?? []);
      })
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(load, [load]);

  useEffect(() => {
    fetch("/api/fuel/monthly")
      .then((r) => r.json())
      .then((d) => setMonthly(Array.isArray(d) ? d : []));
    fetch("/api/fuel/settings")
      .then((r) => r.json())
      .then((d) => setAdminId(d.line_admin_id ?? ""));
  }, []);

  const kpi = useMemo(() => {
    let liters = 0,
      total = 0,
      suspects = 0;
    for (const b of bills) {
      liters += b.liters ?? 0;
      total += b.total ?? 0;
      if (b.status === "suspect") suspects++;
    }
    return { count: bills.length, liters, total, suspects };
  }, [bills]);

  const daily = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bills) m.set(dateKey(b), (m.get(dateKey(b)) ?? 0) + (b.total ?? 0));
    return [...m.entries()].sort((a, z) => a[0].localeCompare(z[0])).map(([day, baht]) => ({ day: day.slice(5), baht }));
  }, [bills]);

  const byEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bills) m.set(empKey(b), (m.get(empKey(b)) ?? 0) + (b.total ?? 0));
    return [...m.entries()].sort((a, z) => z[1] - a[1]).slice(0, 10).map(([employee, baht]) => ({ employee, baht }));
  }, [bills]);

  const monthlyChart = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of monthly) m.set(r.ym, (m.get(r.ym) ?? 0) + r.baht);
    return [...m.entries()].sort((a, z) => a[0].localeCompare(z[0])).map(([ym, baht]) => ({ ym, baht }));
  }, [monthly]);

  async function saveAdmin() {
    await fetch("/api/fuel/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line_admin_id: adminId }),
    });
  }

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="ตรวจบิลน้ำมัน"
        subtitle="รับบิลผ่าน LINE, อ่านด้วย AI, ตรวจจับบิลผิดปกติ"
        action={
          <a
            href={`/api/fuel/export?${qs}`}
            className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60"
          >
            ดาวน์โหลด CSV
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="จำนวนบิล" value={num(kpi.count)} accent="sky" />
        <StatCard label="ลิตรรวม" value={num(kpi.liters, 1)} accent="violet" />
        <StatCard label="ยอดรวม" value={baht(kpi.total)} accent="emerald" />
        <StatCard label="น่าสงสัย" value={num(kpi.suspects)} accent="rose" />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">ตั้งแต่</span>
            <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">ถึง</span>
            <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">พนักงาน</span>
            <select className="field" value={employee} onChange={(e) => setEmployee(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {employees.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">สถานะ</span>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="ok">ปกติ</option>
              <option value="suspect">น่าสงสัย</option>
              <option value="extract_failed">อ่านไม่สำเร็จ</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="mb-4">
        <FuelCharts daily={daily} byEmployee={byEmployee} monthly={monthlyChart} />
      </div>

      <Card className="mb-4">
        <div className="font-medium mb-3">รายการบิล</div>
        {loading ? (
          <div className="text-slate-400 py-8 text-center">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">วันที่</th>
                  <th className="py-2 pr-3">พนักงาน</th>
                  <th className="py-2 pr-3">ปั๊ม</th>
                  <th className="py-2 pr-3 text-right">ลิตร</th>
                  <th className="py-2 pr-3 text-right">ยอด</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2">รูป</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-b border-slate-800/50 align-top">
                    <td className="py-2 pr-3 text-slate-500">{b.id}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">
                      {dateKey(b)} {b.billTime ?? ""}
                    </td>
                    <td className="py-2 pr-3">{b.employeeName || b.lineUserId}</td>
                    <td className="py-2 pr-3 max-w-[200px] truncate">{b.station || "-"}</td>
                    <td className="py-2 pr-3 text-right">{b.liters ?? "-"}</td>
                    <td className="py-2 pr-3 text-right">{b.total != null ? baht(b.total) : "-"}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_CLASS[b.status] ?? ""}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                      {b.suspectReasons && (
                        <div className="mt-1 text-[11px] text-rose-300/80 max-w-[240px]">{b.suspectReasons}</div>
                      )}
                    </td>
                    <td className="py-2">
                      {b.imageUrl ? (
                        <a href={b.imageUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline text-xs">
                          ดูบิล
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
                {!bills.length && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      ไม่พบบิล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="font-medium mb-3">ตั้งค่าผู้รับแจ้งเตือน (LINE)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="field max-w-md"
            placeholder="LINE userId ผู้ดูแล (คั่นหลายคนด้วยเว้นวรรค/คอมมา)"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
          />
          <button onClick={saveAdmin} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
            บันทึก
          </button>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          พนักงานพิมพ์ &quot;id&quot; ในแชท LINE เพื่อดู userId ของตัวเอง
        </div>
      </Card>
    </div>
  );
}
