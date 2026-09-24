"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { baht, num } from "@/lib/format";

interface Side { count: number; liters: number; baht: number }
interface VRow { vehicleId: string; plate: string; line: Side; office: Side }
interface Bill {
  id: number;
  date: string;
  employee: string;
  plate: string | null;
  vehiclePlate: string | null;
  liters: number | null;
  total: number | null;
  status: string;
}
interface Data {
  month: string;
  vehicles: VRow[];
  unmatched: Bill[];
  noOfficeRow: Bill[];
  vehicleOptions: { id: string; plate: string }[];
}

export default function FuelReconcilePage() {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    fetch(`/api/fuel/reconcile${month ? `?month=${month}` : ""}`)
      .then((r) => r.json())
      .then((d: Data) => {
        setData(d);
        if (!month) setMonth(d.month);
      });
  }, [month]);

  useEffect(load, [load]);

  async function post(body: object) {
    const res = await fetch("/api/fuel/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? ("linked" in d ? `จับคู่เพิ่มได้ ${d.linked} บิล` : "บันทึกแล้ว") : d.error || "ไม่สำเร็จ");
    load();
  }

  const billTable = (rows: Bill[], withAssign: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-800">
            <th className="py-2 pr-3">บิล</th>
            <th className="py-2 pr-3">วันที่</th>
            <th className="py-2 pr-3">ผู้ส่ง</th>
            <th className="py-2 pr-3">ทะเบียนในบิล</th>
            <th className="py-2 pr-3 text-right">ลิตร</th>
            <th className="py-2 pr-3 text-right">ยอด</th>
            <th className="py-2">{withAssign ? "ผูกกับรถ" : "รถ"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-slate-800/50">
              <td className="py-2 pr-3">#{b.id}</td>
              <td className="py-2 pr-3 text-slate-400">{b.date}</td>
              <td className="py-2 pr-3">{b.employee}</td>
              <td className="py-2 pr-3">{b.plate || "-"}</td>
              <td className="py-2 pr-3 text-right">{b.liters == null ? "-" : num(b.liters, 2)}</td>
              <td className="py-2 pr-3 text-right">{b.total == null ? "-" : baht(b.total)}</td>
              <td className="py-2">
                {withAssign ? (
                  <select className="field py-1" defaultValue="" onChange={(e) => e.target.value && post({ action: "assign", billId: b.id, vehicleId: e.target.value })}>
                    <option value="">- เลือกรถ -</option>
                    {data?.vehicleOptions.map((v) => (
                      <option key={v.id} value={v.id}>{v.plate}</option>
                    ))}
                  </select>
                ) : (
                  b.vehiclePlate
                )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-slate-500">ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-6xl">
      <PageHeader title="เทียบบิล LINE กับบัญชีน้ำมันออฟฟิศ" subtitle="บิลที่คนขับส่งทาง LINE เทียบกับไฟล์ค่าน้ำมันที่นำเข้า รายคัน รายเดือน" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button onClick={() => post({ action: "rematch" })} className="rounded-lg px-3 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">
          จับคู่ทะเบียนใหม่อีกครั้ง
        </button>
        {msg && <span className="text-sm text-slate-300">{msg}</span>}
      </div>

      <Card className="mb-4">
        <div className="font-medium mb-3">สรุปรายคัน</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">รถ</th>
                <th className="py-2 pr-3 text-right">บิล LINE</th>
                <th className="py-2 pr-3 text-right">ยอด LINE</th>
                <th className="py-2 pr-3 text-right">รายการออฟฟิศ</th>
                <th className="py-2 pr-3 text-right">ยอดออฟฟิศ</th>
                <th className="py-2 text-right">ส่วนต่าง</th>
              </tr>
            </thead>
            <tbody>
              {data?.vehicles.map((v) => {
                const diff = v.line.baht - v.office.baht;
                return (
                  <tr key={v.vehicleId} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3">{v.plate}</td>
                    <td className="py-2 pr-3 text-right">{v.line.count}</td>
                    <td className="py-2 pr-3 text-right">{baht(v.line.baht)}</td>
                    <td className="py-2 pr-3 text-right">{v.office.count}</td>
                    <td className="py-2 pr-3 text-right">{baht(v.office.baht)}</td>
                    <td className={`py-2 text-right ${Math.abs(diff) > 1 ? "text-amber-300" : "text-slate-500"}`}>{baht(diff)}</td>
                  </tr>
                );
              })}
              {data && !data.vehicles.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">ไม่มีข้อมูลเดือนนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="font-medium mb-1">บิล LINE ที่ไม่มีในบัญชีออฟฟิศ</div>
        <div className="text-xs text-slate-500 mb-3">รถคันเดียวกัน วันเดียวกัน ยอดต่างกันไม่เกิน 1 บาท ถือว่าตรงกัน ที่เหลือควรตรวจสอบ</div>
        {billTable(data?.noOfficeRow ?? [], false)}
      </Card>

      <Card>
        <div className="font-medium mb-1">บิลที่ยังระบุรถไม่ได้</div>
        <div className="text-xs text-slate-500 mb-3">อ่านทะเบียนไม่ได้หรือไม่ตรงกับรถในระบบ เลือกรถเองแล้วระบบจะจำทะเบียนนี้ไว้ใช้ครั้งต่อไป</div>
        {billTable(data?.unmatched ?? [], true)}
      </Card>
    </div>
  );
}
