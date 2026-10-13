"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { baht, num, thDate, thDateTime } from "@/lib/format";
import type { FuelRecord } from "@/lib/fleet/fuel-report";

export interface AuditItem extends FuelRecord {
  flags: string[];
  createdBy: string;
  auditStatus: "ok" | "problem" | null;
  auditNote: string;
  auditedBy: string;
  auditedAt: string;
}

type Vehicle = { id: string; plate: string };

const toForm = (r: AuditItem) => ({
  DateTime: r.date,
  VehicleId: r.vehicleId,
  Item: r.item,
  TaxInvoiceNumber: r.invoice,
  Liters: String(r.liters),
  Amount: String(r.amount),
  OdometerStart: r.odoStart ? String(r.odoStart) : "0",
  OdometerEnd: r.odoEnd ? String(r.odoEnd) : "0",
  Distance: r.distance == null ? "" : String(r.distance),
  ReceiverName: r.receiver,
});
type Form = ReturnType<typeof toForm>;

const CLEARED = { auditStatus: null, auditNote: "", auditedBy: "", auditedAt: "" } as const;

export function AuditRunner({ items, vehicles }: { items: AuditItem[]; vehicles: Vehicle[] }) {
  const [list, setList] = useState(items);
  const [idx, setIdx] = useState(0);
  const item = list[idx];
  const go = (n: number) => setIdx(Math.max(0, Math.min(list.length - 1, n)));

  // ← → move between items, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(list.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  const update = (p: Partial<AuditItem>) => setList((cur) => cur.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  const checked = list.filter((r) => r.auditStatus).length;
  const nextTodo = list.findIndex((r, i) => i > idx && !r.auditStatus);

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => go(idx - 1)} disabled={idx === 0} className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-40">
            ‹ ก่อนหน้า
          </button>
          <span>
            รายการที่ <b>{idx + 1}</b> / {list.length}
          </span>
          <button type="button" onClick={() => go(idx + 1)} disabled={idx === list.length - 1} className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-40">
            ถัดไป ›
          </button>
          {nextTodo > 0 && (
            <button type="button" onClick={() => go(nextTodo)} className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
              ไปที่ยังไม่ตรวจ ››
            </button>
          )}
          <span className="ml-auto text-slate-400">
            ตรวจแล้ว {checked} / {list.length} ในกลุ่มนี้
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(checked / list.length) * 100}%` }} />
        </div>
      </Card>

      <AuditCard
        key={item.id}
        item={item}
        vehicles={vehicles}
        onChange={update}
        onChecked={() => (idx < list.length - 1 ? go(idx + 1) : undefined)}
      />
    </div>
  );
}

function AuditCard({
  item: r,
  vehicles,
  onChange,
  onChecked,
}: {
  item: AuditItem;
  vehicles: Vehicle[];
  onChange: (p: Partial<AuditItem>) => void;
  onChecked: () => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(r));
  const [note, setNote] = useState(r.auditStatus === "problem" ? r.auditNote : "");
  const [askNote, setAskNote] = useState(false);
  const [rot, setRot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(r));

  // Changing either odometer recomputes the distance; the distance itself can still be typed over.
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => {
      const next = { ...f, [k]: e.target.value };
      if (k !== "OdometerStart" && k !== "OdometerEnd") return next;
      const start = Number(next.OdometerStart);
      const end = Number(next.OdometerEnd);
      return start > 0 && end >= start ? { ...next, Distance: String(Math.round((end - start) * 100) / 100) } : next;
    });

  // Saving an edit clears the check on the server, so the item shows as not checked.
  async function save(): Promise<boolean> {
    const res = await fetch(`/api/fleet/records/gasoline/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    if (!res?.ok) {
      setError((await res?.json().catch(() => ({})))?.error || "บันทึกการแก้ไขไม่สำเร็จ");
      return false;
    }
    const plate = vehicles.find((v) => v.id === form.VehicleId)?.plate ?? r.plate;
    onChange({
      ...CLEARED,
      date: form.DateTime,
      vehicleId: form.VehicleId,
      plate,
      item: form.Item,
      invoice: form.TaxInvoiceNumber,
      liters: Number(form.Liters) || 0,
      amount: Number(form.Amount) || 0,
      odoStart: Number(form.OdometerStart) || 0,
      odoEnd: Number(form.OdometerEnd) || 0,
      distance: form.Distance === "" ? null : Number(form.Distance) || 0,
      receiver: form.ReceiverName,
    });
    return true;
  }

  async function mark(status: "ok" | "problem" | "") {
    if (status === "problem" && !note.trim()) {
      setAskNote(true);
      setError("ใส่หมายเหตุว่ามีปัญหาอะไร");
      return;
    }
    setBusy(true);
    setError("");
    if (dirty && !(await save())) return setBusy(false);
    const res = await fetch("/api/fleet/fuel-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, status, note: status === "problem" ? note : "" }),
    }).catch(() => null);
    setBusy(false);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(d.error || "บันทึกผลตรวจไม่สำเร็จ");
    onChange({ auditStatus: d.auditStatus, auditNote: d.auditNote, auditedBy: d.auditedBy, auditedAt: d.auditedAt });
    if (status) onChecked();
  }

  const field = (label: string, k: keyof Form, type = "text", step?: string) => (
    <label>
      <span className="block text-slate-400 mb-1">{label}</span>
      <input type={type} step={step} value={form[k]} onChange={set(k)} className="field w-full" />
    </label>
  );

  return (
    <Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {r.billUrl ? (
            <>
              {/* Square box: the photo turned 90 degrees still fits inside it. */}
              <a href={r.billUrl} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม" className="block aspect-square overflow-hidden rounded-lg bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- private /uploads file behind the session */}
                <img src={r.billUrl} alt="รูปบิล" style={{ transform: `rotate(${rot}deg)` }} className="h-full w-full object-contain transition-transform" />
              </a>
              <div className="mt-2 flex gap-2 text-xs">
                <button type="button" onClick={() => setRot((x) => (x + 90) % 360)} className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                  ↻ หมุนรูป
                </button>
                <a href={r.billUrl} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                  🔍 เปิดรูปเต็ม
                </a>
              </div>
            </>
          ) : (
            <div className="aspect-square rounded-lg bg-slate-900 grid place-items-center text-center text-sm text-slate-500 px-6">
              ไม่มีรูปบิล
              <br />
              (เช่น นำเข้าจากไฟล์ Excel) ตรวจจากตัวเลขและธงเตือนแทน
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link href={`/fleet/vehicles/${r.vehicleId}`} className="font-semibold text-sky-300 hover:underline">
              {r.plate}
            </Link>
            <span className="text-sm text-slate-400">
              {thDate(r.date)} · {baht(r.amount)} · {num(r.liters, 2)} ลิตร
              {r.liters ? ` · ${num(r.amount / r.liters, 2)} บาท/ลิตร` : ""}
            </span>
            {r.createdBy && <span className="text-xs text-slate-500">บันทึกโดย {r.createdBy}</span>}
          </div>

          {r.auditStatus === "ok" && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              ✓ ถูกต้อง · ตรวจโดย {r.auditedBy} {r.auditedAt && thDateTime(r.auditedAt)}
            </div>
          )}
          {r.auditStatus === "problem" && (
            <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              ⚠ มีปัญหา: {r.auditNote} · ตรวจโดย {r.auditedBy} {r.auditedAt && thDateTime(r.auditedAt)}
            </div>
          )}
          {r.flags.length > 0 && (
            <ul className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 space-y-0.5">
              {r.flags.map((f) => (
                <li key={f}>⚑ {f}</li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <label>
              <span className="block text-slate-400 mb-1">รถ</span>
              <select value={form.VehicleId} onChange={set("VehicleId")} className="field w-full">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </label>
            {field("วันที่", "DateTime", "date")}
            {field("เลขที่ใบกำกับภาษี", "TaxInvoiceNumber")}
            {field("รายการ", "Item")}
            {field("ลิตร", "Liters", "number", "0.01")}
            {field("จำนวนเงิน", "Amount", "number", "0.01")}
            {field("เลขไมล์เริ่ม", "OdometerStart", "number", "0.01")}
            {field("เลขไมล์สิ้นสุด", "OdometerEnd", "number", "0.01")}
            {field("ระยะทาง", "Distance", "number", "0.01")}
            {field("ผู้รับน้ำมัน", "ReceiverName")}
          </div>

          {(askNote || r.auditStatus === "problem") && (
            <label className="block text-sm">
              <span className="block text-slate-400 mb-1">หมายเหตุปัญหา</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="field w-full" placeholder="เช่น ยอดในบิล 3,000 แต่บันทึก 300" />
            </label>
          )}

          {dirty && <div className="text-xs text-amber-300">มีการแก้ไขที่ยังไม่ได้บันทึก กดปุ่มด้านล่างแล้วจะบันทึกการแก้ไขก่อน</div>}
          {error && <div className="text-sm text-rose-400">{error}</div>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => mark("ok")} disabled={busy} className="rounded-lg px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium disabled:opacity-50">
              {dirty ? "✓ บันทึกการแก้ไข และถูกต้อง" : "✓ ถูกต้อง"}
            </button>
            <button
              type="button"
              onClick={() => (askNote ? mark("problem") : setAskNote(true))}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm bg-rose-500/80 hover:bg-rose-500 text-white font-medium disabled:opacity-50"
            >
              {askNote ? "⚠ บันทึกว่ามีปัญหา" : "⚠ มีปัญหา"}
            </button>
            {dirty && (
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  await save();
                  setBusy(false);
                }}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-50"
              >
                บันทึกการแก้ไขอย่างเดียว
              </button>
            )}
            {r.auditStatus && (
              <button type="button" onClick={() => mark("")} disabled={busy} className="ml-auto rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white">
                ล้างผลตรวจ
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
