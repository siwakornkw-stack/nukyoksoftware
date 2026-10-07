"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

interface Item {
  auditId: string;
  label: string;
  vehicle: string;
  summary: string;
  deletedBy: string | null;
  deletedAt: string;
  restored: boolean;
}

export default function TrashPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    fetch("/api/trash")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return setErr(d.error || "โหลดรายการไม่สำเร็จ");
        setErr("");
        setItems(d.items ?? []);
      })
      .catch(() => setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function restore(it: Item) {
    if (!confirm(`กู้คืน${it.label} ของ ${it.vehicle}?`)) return;
    setBusy(it.auditId);
    const r = await fetch("/api/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditId: it.auditId }),
    });
    setBusy("");
    if (r.ok) load();
    else setErr((await r.json().catch(() => ({}))).error || "กู้คืนไม่สำเร็จ");
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="ถังขยะ" subtitle="รายการประวัติรถที่ถูกลบ (น้ำมัน, ประกัน, ภาษี, ซ่อม, รายรับ ...) · กู้คืนได้ · 300 รายการล่าสุด" />
      {err && <div className="mb-3 text-sm text-rose-400">{err}</div>}
      <Card>
        {loading ? (
          <div className="py-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">ลบเมื่อ</th>
                  <th className="py-2 pr-3">ผู้ลบ</th>
                  <th className="py-2 pr-3">ประเภท</th>
                  <th className="py-2 pr-3">รถ</th>
                  <th className="py-2 pr-3">รายละเอียด</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.auditId} className="border-b border-slate-800/50 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{thDateTime(it.deletedAt)}</td>
                    <td className="py-2 pr-3">{it.deletedBy ?? "-"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{it.label}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{it.vehicle}</td>
                    <td className="py-2 pr-3 text-xs text-slate-300">{it.summary || "-"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {it.restored ? (
                        <span className="text-xs text-emerald-400">กู้คืนแล้ว</span>
                      ) : (
                        <button
                          onClick={() => restore(it)}
                          disabled={busy === it.auditId}
                          className="rounded-md px-2 py-1 text-xs bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
                        >
                          {busy === it.auditId ? "..." : "กู้คืน"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!items.length && !err && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">ไม่มีรายการที่ถูกลบ</td>
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
