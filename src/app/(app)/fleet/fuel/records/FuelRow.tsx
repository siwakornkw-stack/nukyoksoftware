"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { baht, num, thDate } from "@/lib/format";
import type { FuelRecord } from "@/lib/fleet/fuel-report";
import { DeleteRecordButton } from "../../DeleteRecordButton";

const td = "py-1.5 pr-3";

const toForm = (r: FuelRecord) => ({
  DateTime: r.date,
  Item: r.item,
  TaxInvoiceNumber: r.invoice,
  OdometerStart: r.odoStart ? String(r.odoStart) : "0",
  OdometerEnd: r.odoEnd ? String(r.odoEnd) : "0",
  Distance: r.distance == null ? "" : String(r.distance),
  Amount: String(r.amount),
  Liters: String(r.liters),
  ReceiverName: r.receiver,
  VehicleId: r.vehicleId,
});

export function FuelRow({
  row: r,
  flags,
  vehicles,
}: {
  row: FuelRecord;
  flags: string;
  vehicles: { id: string; plate: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(r));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Changing either odometer recomputes the distance; the distance itself can still be typed over.
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => {
      const next = { ...f, [k]: e.target.value };
      if (k !== "OdometerStart" && k !== "OdometerEnd") return next;
      const start = Number(next.OdometerStart);
      const end = Number(next.OdometerEnd);
      return next.OdometerStart && next.OdometerEnd && start > 0 && end >= start
        ? { ...next, Distance: String(Math.round((end - start) * 100) / 100) }
        : next;
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/fleet/records/gasoline/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className="border-b border-slate-800/50">
        <td className={`${td} text-slate-400`}>{thDate(r.date)}</td>
        <td className={td}>{r.item}</td>
        <td className={`${td} text-slate-300`}>{r.invoice || "-"}</td>
        <td className={`${td} text-right`}>{r.odoStart ? num(r.odoStart, 2) : "-"}</td>
        <td className={`${td} text-right`}>{r.odoEnd ? num(r.odoEnd, 2) : "-"}</td>
        <td className={`${td} text-right`}>{r.distance ? num(r.distance, 2) : "-"}</td>
        <td className={`${td} text-right`}>{baht(r.amount)}</td>
        <td className={`${td} text-right`}>{num(r.liters, 2)}</td>
        <td className={`${td} text-right text-slate-400`}>{r.liters ? num(r.amount / r.liters, 2) : "-"}</td>
        <td className={`${td} text-slate-400`}>{r.receiver || "-"}</td>
        <td className={`${td} text-xs text-amber-300`}>{flags}</td>
        <td className={`${td} space-x-3`}>
          <button
            type="button"
            onClick={() => {
              setForm(toForm(r));
              setError("");
              setEditing(true);
            }}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            แก้ไข
          </button>
          <DeleteRecordButton type="gasoline" id={r.id} what="รายการน้ำมัน" />
        </td>
      </tr>
    );
  }

  const amount = Number(form.Amount) || 0;
  const liters = Number(form.Liters) || 0;
  const input = (label: string, k: keyof typeof form, type = "text", extra = "") => (
    <label className={`text-xs ${extra}`}>
      <span className="block text-slate-400 mb-1">{label}</span>
      <input type={type} step={type === "number" ? "0.01" : undefined} value={form[k]} onChange={set(k)} className="field" />
    </label>
  );

  return (
    <tr className="border-b border-sky-500/30 bg-sky-500/5">
      <td colSpan={12} className="p-3">
        <form onSubmit={save} className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 whitespace-normal">
          {input("วัน/เดือน/ปี", "DateTime", "date")}
          {input("รายการ", "Item")}
          {input("เลขที่ใบกำกับภาษี", "TaxInvoiceNumber", "text", "lg:col-span-2")}
          {input("จำนวนเงิน (บาท)", "Amount", "number")}
          {input("จำนวน (ลิตร)", "Liters", "number")}
          {input("เลขไมล์ต้นทาง", "OdometerStart", "number")}
          {input("เลขไมล์ปลายทาง", "OdometerEnd", "number")}
          {input("ระยะทาง", "Distance", "number")}
          {input("ผู้รับน้ำมัน", "ReceiverName")}
          <label className="text-xs lg:col-span-2">
            <span className="block text-slate-400 mb-1">รถ / เครื่องจักร (ย้ายรายการได้)</span>
            <select value={form.VehicleId} onChange={set("VehicleId")} className="field">
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 sm:col-span-4 lg:col-span-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg px-4 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium"
            >
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-4 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ยกเลิก
            </button>
            <span className="text-xs text-slate-400">{liters ? `${num(amount / liters, 2)} บาท/ลิตร` : ""}</span>
            {error && <span className="text-sm text-rose-400">{error}</span>}
          </div>
        </form>
      </td>
    </tr>
  );
}
