"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { baht } from "@/lib/format";

interface Row {
  id: string;
  vehicleId: string;
  plate: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  datePay: string | null;
  overdueDays: number;
}

const TABS = [
  { key: "unpaid", label: "ค้างชำระ" },
  { key: "overdue", label: "เกินกำหนด" },
  { key: "paid", label: "ชำระแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

function InstallmentsInner() {
  const searchParams = useSearchParams();
  const vehicle = searchParams.get("vehicle") || "";
  const [filter, setFilter] = useState("unpaid");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [genMsg, setGenMsg] = useState("");
  const [evidence, setEvidence] = useState<Record<string, File>>({});
  const [paying, setPaying] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ filter });
    if (vehicle) p.set("vehicle", vehicle);
    fetch(`/api/fleet/installments?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => setRows(d.installments ?? []))
      .finally(() => setLoading(false));
  }, [filter, vehicle]);

  useEffect(load, [load]);

  async function markPaid(id: string) {
    setPaying(id);
    const fd = new FormData();
    fd.append("action", "pay");
    fd.append("id", id);
    const f = evidence[id];
    if (f) fd.append("file", f);
    await fetch("/api/fleet/installments", { method: "POST", body: fd });
    setEvidence((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    setPaying(null);
    load();
  }

  async function generate() {
    setGenMsg("");
    const res = await fetch("/api/fleet/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", vehicleId: vehicle, startDate }),
    });
    const d = await res.json().catch(() => ({}));
    setGenMsg(res.ok ? `สร้างค่างวด ${d.created} งวดแล้ว` : d.error || "สร้างไม่สำเร็จ");
    if (res.ok) load();
  }

  const total = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="ค่างวด / ลูกหนี้"
        subtitle={vehicle ? "กรองเฉพาะรถที่เลือก" : `รวม ${baht(total)}`}
      />

      {vehicle && (
        <Card className="mb-4">
          <div className="font-medium mb-2">สร้างตารางค่างวด</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="block text-slate-400 mb-1">งวดแรกครบกำหนด</span>
              <input type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <button onClick={generate} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              สร้างจากจำนวนงวดของรถ
            </button>
            {genMsg && <span className="text-sm text-slate-300">{genMsg}</span>}
          </div>
        </Card>
      )}

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === t.key ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="py-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">ทะเบียน</th>
                  <th className="py-2 pr-3">งวด</th>
                  <th className="py-2 pr-3">ครบกำหนด</th>
                  <th className="py-2 pr-3 text-right">ยอด</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3">{r.plate}</td>
                    <td className="py-2 pr-3">{r.installmentNumber}</td>
                    <td className="py-2 pr-3 text-slate-400">{r.dueDate}</td>
                    <td className="py-2 pr-3 text-right">{baht(r.amount)}</td>
                    <td className="py-2 pr-3">
                      {r.datePay ? (
                        <span className="text-emerald-400 text-xs">ชำระ {r.datePay}</span>
                      ) : r.overdueDays > 0 ? (
                        <span className="text-rose-400 text-xs">เกิน {r.overdueDays} วัน</span>
                      ) : (
                        <span className="text-amber-400 text-xs">ค้าง</span>
                      )}
                    </td>
                    <td className="py-2">
                      {!r.datePay && (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            ref={(el) => {
                              fileInputs.current[r.id] = el;
                            }}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setEvidence((s) => {
                                const next = { ...s };
                                if (f) next[r.id] = f;
                                else delete next[r.id];
                                return next;
                              });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputs.current[r.id]?.click()}
                            className="rounded-md px-2 py-1 text-xs bg-slate-700/60 text-slate-300 hover:bg-slate-700 max-w-[120px] truncate"
                            title={evidence[r.id]?.name || "แนบหลักฐาน"}
                          >
                            {evidence[r.id] ? `📎 ${evidence[r.id].name}` : "แนบหลักฐาน"}
                          </button>
                          <button
                            onClick={() => markPaid(r.id)}
                            disabled={paying === r.id}
                            className="rounded-md px-2 py-1 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {paying === r.id ? "กำลังบันทึก..." : "บันทึกชำระ"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      ไม่มีรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function InstallmentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">กำลังโหลด...</div>}>
      <InstallmentsInner />
    </Suspense>
  );
}
