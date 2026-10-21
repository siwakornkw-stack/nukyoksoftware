"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Puts a PK whose R3 failed back in the office PC's queue (admin).
export function R3Retry({ poNo }: { poNo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function retry() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/po/r3-retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poNo }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr((await r?.json().catch(() => ({})))?.error || "ไม่สำเร็จ");
    router.refresh();
  }
  return (
    <div className="mt-2">
      <button type="button" disabled={busy} onClick={retry} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-50">
        ลองสร้าง R3 อีกครั้ง
      </button>
      {err && <span className="ml-2 text-xs text-rose-400">{err}</span>}
    </div>
  );
}
