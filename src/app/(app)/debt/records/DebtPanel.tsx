"use client";

import { useCallback, useEffect, useState } from "react";
import { baht, thDate, thDateTime } from "@/lib/format";
import { PAY_METHODS } from "@/lib/debt/types";

interface Payment { id: string; amount: number; paidAt: string; method: string; note: string; slipUrl: string | null; createdBy: string }
interface FollowUp { id: string; note: string; promiseDate: string | null; createdBy: string; createdAt: string }
interface Detail {
  record: { docNo: string; customer: string; total: number; paid: number; status: string; dueDate: string | null };
  payments: Payment[];
  followUps: FollowUp[];
}

const todayISO = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); // Bangkok

// Side panel for one document: record payments (with slip) and the collection log.
export function DebtPanel({ docNo, admin, onClose, onChanged }: { docNo: string; admin: boolean; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [promise, setPromise] = useState("");

  const load = useCallback(() => {
    fetch(`/api/debt/payments?docNo=${encodeURIComponent(docNo)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setErr("โหลดข้อมูลไม่สำเร็จ"));
  }, [docNo]);
  useEffect(load, [load]);

  async function send(res: Promise<Response>) {
    setBusy(true);
    setErr("");
    const r = await res.catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const j = await r?.json().catch(() => ({}));
      setErr(j?.error || "บันทึกไม่สำเร็จ");
      return false;
    }
    load();
    onChanged();
    return true;
  }

  async function addPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("docNo", docNo);
    if (await send(fetch("/api/debt/payments", { method: "POST", body: fd }))) form.reset();
  }

  async function addFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send(
      fetch("/api/debt/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docNo, note, promiseDate: promise || null }),
      }),
    );
    if (ok) {
      setNote("");
      setPromise("");
    }
  }

  const remove = (url: string) => {
    if (confirm("ลบรายการนี้?")) send(fetch(url, { method: "DELETE" }));
  };

  const due = d ? Math.max(0, d.record.total - d.record.paid) : 0;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 w-full bg-slate-950/70" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-slate-400">{docNo}</div>
            <div className="font-semibold">{d?.record.customer ?? "..."}</div>
            {d && <div className="text-xs text-slate-500">ครบกำหนด {thDate(d.record.dueDate)} · {d.record.status}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-800/60 px-2 py-1 text-sm hover:bg-slate-700/60">✕</button>
        </div>

        {d && (
          <div className="mb-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-900/60 p-3"><div className="text-[11px] text-slate-500">ยอดรวม</div><div className="font-semibold">{baht(d.record.total)}</div></div>
            <div className="rounded-xl bg-emerald-500/10 p-3"><div className="text-[11px] text-slate-500">รับแล้ว</div><div className="font-semibold text-emerald-300">{baht(d.record.paid)}</div></div>
            <div className="rounded-xl bg-rose-500/10 p-3"><div className="text-[11px] text-slate-500">คงค้าง</div><div className="font-semibold text-rose-300">{baht(due)}</div></div>
          </div>
        )}

        {err && <div className="mb-3 text-sm text-rose-400">{err}</div>}

        <h3 className="mb-2 text-sm font-semibold">รับชำระ</h3>
        {due > 0 && d?.record.status !== "ยกเลิก" ? (
          <form onSubmit={addPayment} className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 p-3">
            <input name="amount" type="number" step="0.01" min="0.01" max={due} defaultValue={due} required className="field" placeholder="จำนวนเงิน" />
            <input name="paidAt" type="date" defaultValue={todayISO()} required className="field" />
            <select name="method" className="field">
              {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input name="slip" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="field text-xs" />
            <input name="note" className="field col-span-2" placeholder="หมายเหตุ (ถ้ามี)" />
            <button disabled={busy} className="col-span-2 rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50">บันทึกรับชำระ</button>
          </form>
        ) : (
          <div className="mb-3 text-xs text-slate-500">ไม่มียอดค้าง</div>
        )}
        <div className="mb-6 flex flex-col gap-1.5">
          {d?.payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
              <div className="flex-1">
                <div>{baht(p.amount)} <span className="text-xs text-slate-500">· {p.method} · {thDate(p.paidAt)}</span></div>
                <div className="text-xs text-slate-500">{p.note ? `${p.note} · ` : ""}{p.createdBy}</div>
              </div>
              {p.slipUrl && <a href={p.slipUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">สลิป</a>}
              {admin && <button type="button" onClick={() => remove(`/api/debt/payments?id=${p.id}`)} className="text-xs text-rose-400 hover:underline">ลบ</button>}
            </div>
          ))}
        </div>

        <h3 className="mb-2 text-sm font-semibold">บันทึกการติดตาม</h3>
        <form onSubmit={addFollowUp} className="mb-3 grid gap-2 rounded-xl border border-slate-800 p-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} required className="field" placeholder="เช่น โทรคุยกับฝ่ายบัญชี จะโอนสิ้นเดือน" />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            นัดชำระภายใน
            <input type="date" value={promise} onChange={(e) => setPromise(e.target.value)} className="field max-w-44" />
          </label>
          <button disabled={busy} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50">บันทึก</button>
        </form>
        <div className="flex flex-col gap-1.5">
          {d?.followUps.map((f) => (
            <div key={f.id} className="rounded-lg bg-slate-900/50 px-3 py-2 text-sm">
              <div className="whitespace-pre-wrap">{f.note}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <span className="flex-1">
                  {thDateTime(f.createdAt)} · {f.createdBy}
                  {f.promiseDate && <span className="text-amber-300"> · นัด {thDate(f.promiseDate)}</span>}
                </span>
                {admin && <button type="button" onClick={() => remove(`/api/debt/followups?id=${f.id}`)} className="text-rose-400 hover:underline">ลบ</button>}
              </div>
            </div>
          ))}
          {d && !d.followUps.length && <div className="text-xs text-slate-500">ยังไม่มีบันทึก</div>}
        </div>
      </div>
    </div>
  );
}
