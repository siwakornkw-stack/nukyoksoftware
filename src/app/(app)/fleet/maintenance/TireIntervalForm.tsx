"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin: tire change limits (age and distance, whichever comes first).
export function TireIntervalForm({ months, km }: { months: number; km: number }) {
  const router = useRouter();
  const [m, setM] = useState(String(months));
  const [k, setK] = useState(String(km));
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/fleet/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tireMonths: Number(m), tireKm: Number(k) }),
    });
    if (res.ok) router.refresh();
    else setErr((await res.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-400">ทุก</span>
      <input type="number" min={1} max={120} className="field w-20 py-1" value={m} onChange={(e) => setM(e.target.value)} />
      <span className="text-slate-400">เดือน หรือ</span>
      <input type="number" min={1000} step={1000} className="field w-28 py-1" value={k} onChange={(e) => setK(e.target.value)} />
      <span className="text-slate-400">กม.</span>
      <button className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">บันทึก</button>
      {err && <span className="text-rose-400">{err}</span>}
    </form>
  );
}
