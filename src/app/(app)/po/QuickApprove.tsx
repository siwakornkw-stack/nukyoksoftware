"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// One-click approve on a pending row of /po (admin). Rejecting needs a reason,
// so that stays on the PO page.
export function QuickApprove({ poNo, hash, summary }: { poNo: string; hash: string; summary: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function approve() {
    if (!confirm(`อนุมัติใบสั่งซื้อ ${poNo}?\n${summary}`)) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/po/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poNo, status: "approved", note: "", hash }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr((await r?.json().catch(() => ({})))?.error || "อนุมัติไม่สำเร็จ");
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={busy}
        onClick={approve}
        className="rounded-md px-2.5 py-1 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50"
      >
        {busy ? "กำลังบันทึก…" : "✓ อนุมัติ"}
      </button>
      {err && <span className="mt-1 max-w-48 text-xs text-rose-400">{err}</span>}
    </span>
  );
}
