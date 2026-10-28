"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

type Approval = { approvalStatus: string | null; approvalNote: string; approvedBy: string; approvedAt: string };

// Approve / reject a PO here. Only this app records the decision; Express is
// never touched.
export function ApprovalPanel({
  poNo,
  hash,
  canApprove,
  cancelled,
  received,
  initial,
}: {
  poNo: string;
  hash: string;
  canApprove: boolean;
  cancelled: boolean;
  received: boolean; // Express shows the goods fully received: counts as approved (not for a PK)
  initial: Approval;
}) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function decide(status: "approved" | "rejected" | "") {
    setErr("");
    if (status === "rejected" && !note.trim()) return setErr("ใส่เหตุผลที่ไม่อนุมัติ");
    if (status === "" && !confirm("ยกเลิกผลการอนุมัติ ให้กลับเป็นรออนุมัติ?")) return;
    setBusy(true);
    const r = await fetch("/api/po/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poNo, status, note, hash }),
    }).catch(() => null);
    setBusy(false);
    const out = await r?.json().catch(() => ({}));
    if (!r?.ok) return setErr(out?.error || "บันทึกไม่สำเร็จ");
    setA(out);
    setNote("");
    router.refresh();
  }

  const decided = a.approvalStatus === "approved" || a.approvalStatus === "rejected";
  return (
    <Card>
      <div className="mb-2 font-semibold">การอนุมัติ</div>
      {decided ? (
        <div className={`rounded-lg border p-3 text-sm ${a.approvalStatus === "approved" ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}>
          <div className={a.approvalStatus === "approved" ? "text-emerald-300" : "text-rose-300"}>
            {a.approvalStatus === "approved" ? "✅ อนุมัติแล้ว" : "⛔ ไม่อนุมัติ"} โดย {a.approvedBy} · {thDateTime(a.approvedAt)}
          </div>
          {a.approvalNote && <div className="mt-1 text-slate-300">หมายเหตุ: {a.approvalNote}</div>}
        </div>
      ) : received ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          ✅ อนุมัติแล้ว (อัตโนมัติ): Express แสดงว่ารับของครบแล้ว
        </div>
      ) : (
        <div className="text-sm text-slate-400">ยังไม่ได้อนุมัติ</div>
      )}

      {!canApprove ? (
        <div className="mt-3 text-xs text-slate-500">เฉพาะผู้ดูแลระบบ (admin) ที่อนุมัติได้</div>
      ) : decided ? (
        <button type="button" disabled={busy} onClick={() => decide("")} className="mt-3 rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-50">
          ยกเลิกผลอนุมัติ
        </button>
      ) : cancelled ? (
        <div className="mt-3 text-xs text-slate-500">ใบสั่งซื้อนี้ถูกยกเลิก/ลบใน Express แล้ว ไม่ต้องอนุมัติ</div>
      ) : received ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="field min-w-64 flex-1" placeholder="หมายเหตุ (ต้องใส่เมื่อไม่อนุมัติ)" />
          <button type="button" disabled={busy} onClick={() => decide("approved")} className="rounded-lg px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50">
            อนุมัติ
          </button>
          <button type="button" disabled={busy} onClick={() => decide("rejected")} className="rounded-lg px-4 py-2 text-sm font-medium bg-rose-500/80 hover:bg-rose-500 text-white disabled:opacity-50">
            ไม่อนุมัติ
          </button>
        </div>
      )}
      {err && <div className="mt-2 text-sm text-rose-400">{err}</div>}
    </Card>
  );
}
