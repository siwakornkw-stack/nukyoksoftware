"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin: change the oil-change distance used for every vehicle.
export function IntervalForm({ current }: { current: number }) {
  const router = useRouter();
  const [km, setKm] = useState(String(current));
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/fleet/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intervalKm: Number(km) }),
    });
    if (res.ok) router.refresh();
    else setErr((await res.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
  }

  return (
    <form onSubmit={save} className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">ทุก</span>
      <input type="number" min={1000} step={500} className="field w-28 py-1" value={km} onChange={(e) => setKm(e.target.value)} />
      <span className="text-slate-400">กม.</span>
      <button className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">บันทึก</button>
      {err && <span className="text-rose-400">{err}</span>}
    </form>
  );
}
