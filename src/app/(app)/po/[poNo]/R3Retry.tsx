"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Puts a PK whose R3 failed back in the office PC's queue (admin). duplicate:
// the day's R3 already has a line of the same amount without an H3 reference;
// "ยืนยันว่าไม่ซ้ำ" adds the H3 anyway once the admin checked it is another bill.
export function R3Retry({ poNo, duplicate = false }: { poNo: string; duplicate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function retry(force: boolean) {
    if (force && !confirm("ตรวจใน Express แล้วว่าบรรทัดที่ยอดเท่ากันเป็นบิลอื่น ให้ระบบเพิ่มบิลนี้เข้า R3?")) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/po/r3-retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poNo, force }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr((await r?.json().catch(() => ({})))?.error || "ไม่สำเร็จ");
    router.refresh();
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => retry(false)} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-50">
        ลองสร้าง R3 อีกครั้ง
      </button>
      {duplicate && (
        <button type="button" disabled={busy} onClick={() => retry(true)} className="rounded-lg px-3 py-1.5 text-sm bg-amber-500/80 hover:bg-amber-500 text-slate-900 disabled:opacity-50">
          ยืนยันว่าไม่ซ้ำ แล้วเพิ่มเข้า R3
        </button>
      )}
      {err && <span className="text-xs text-rose-400">{err}</span>}
    </div>
  );
}
