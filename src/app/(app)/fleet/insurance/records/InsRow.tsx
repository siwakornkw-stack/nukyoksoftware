"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { baht, thDate } from "@/lib/format";
import type { InsRecord } from "@/lib/fleet/insurance-report";
import { DeleteRecordButton } from "../../DeleteRecordButton";

const td = "py-2 pr-3";
const nextYear = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

const toForm = (r: InsRecord) => ({
  Year: String(r.year || ""),
  Type: r.cls,
  InsuranceCompany: r.company,
  BrokerName: r.broker,
  StartDate: r.start ?? "",
  EndDate: r.end,
  TotalPremium: String(r.premium),
  Note: r.note,
  VehicleId: r.vehicleId,
});
type Form = ReturnType<typeof toForm>;

export function InsRow({
  row: r,
  label,
  recordType,
  latest,
  statusLabel,
  statusStyle,
  daysText,
  vehicles,
}: {
  row: InsRecord;
  label: string;
  recordType: string;
  latest: boolean;
  statusLabel: string;
  statusStyle: string;
  daysText: string;
  vehicles: { id: string; plate: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(r));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isPolicy = r.kind === "ins";

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      [k]: v,
      // Year follows the expiry date (พ.ศ.); it can still be changed afterwards.
      ...(k === "EndDate" && /^\d{4}/.test(v) ? { Year: String(Number(v.slice(0, 4)) + 543) } : {}),
    }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body: Partial<Form> = { ...form };
    if (!isPolicy) {
      delete body.Type;
      delete body.StartDate;
    }
    const res = await fetch(`/api/fleet/records/${recordType}/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  // One click for next year's record: same company/broker/class, dates +1 year.
  async function renew() {
    const p = prompt(`ต่ออายุ${label} ${r.plate} ถึง ${thDate(nextYear(r.end))}\nเบี้ยปีใหม่ (บาท):`, String(r.premium || ""));
    if (p == null) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/fleet/records/${recordType}/${r.id}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ premium: Number(p.replace(/,/g, "")) }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "ต่ออายุไม่สำเร็จ");
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className={`border-b border-slate-800/50 ${latest ? "" : "opacity-60"}`}>
        <td className={td}>{label}</td>
        <td className={td}>
          <Link href={`/fleet/vehicles/${r.vehicleId}/records`} className="text-sky-400 hover:underline">
            {r.plate}
          </Link>
        </td>
        <td className={`${td} text-slate-400`}>{r.year || "-"}</td>
        <td className={`${td} text-slate-400`}>{r.start ? thDate(r.start) : "-"}</td>
        <td className={td}>{thDate(r.end)}</td>
        <td className={td}>
          <span className={`rounded-md border px-2 py-0.5 text-xs ${statusStyle}`}>{statusLabel}</span>
          <span className="ml-2 text-xs text-slate-500">{daysText}</span>
          {!latest && <span className="ml-2 text-xs text-slate-500">(ต่ออายุแล้ว)</span>}
        </td>
        <td className={`${td} text-slate-400`}>{r.cls || "-"}</td>
        <td className={`${td} text-slate-300`}>
          {r.company || "-"}
          {r.broker && <div className="text-xs text-slate-500">นายหน้า: {r.broker}</div>}
        </td>
        <td className={`${td} text-right`}>{r.premium ? baht(r.premium) : "-"}</td>
        <td className={`${td} text-xs text-slate-400 whitespace-normal min-w-40`}>{r.note || "-"}</td>
        <td className={`${td} text-xs text-slate-500`}>{r.createdBy || "-"}</td>
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
          {latest && (
            <button type="button" onClick={renew} disabled={busy} className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
              ต่ออายุ
            </button>
          )}
          <DeleteRecordButton type={recordType} id={r.id} what={label} />
          {error && <span className="text-xs text-rose-400">{error}</span>}
        </td>
      </tr>
    );
  }

  const input = (text: string, k: keyof Form, type = "text", extra = "") => (
    <label className={`text-xs ${extra}`}>
      <span className="block text-slate-400 mb-1">{text}</span>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={form[k]}
        onChange={set(k)}
        className="field"
        required={k === "EndDate" || (isPolicy && k === "StartDate")}
      />
    </label>
  );

  return (
    <tr className="border-b border-sky-500/30 bg-sky-500/5">
      <td colSpan={12} className="p-3">
        <div className="text-sm font-medium mb-2">
          แก้ไข{label} · {r.plate}
        </div>
        <form onSubmit={save} className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 whitespace-normal">
          {isPolicy && input("วันเริ่ม", "StartDate", "date")}
          {input("วันหมดอายุ", "EndDate", "date")}
          {input("ปี (พ.ศ.)", "Year", "number")}
          {isPolicy && input("ชั้นประกัน", "Type")}
          {input("บริษัท", "InsuranceCompany")}
          {input("นายหน้า", "BrokerName")}
          {input("เบี้ย (บาท)", "TotalPremium", "number")}
          {input("หมายเหตุ", "Note", "text", "lg:col-span-2")}
          <label className="text-xs lg:col-span-2">
            <span className="block text-slate-400 mb-1">รถ (ย้ายรายการได้)</span>
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
            {error && <span className="text-sm text-rose-400">{error}</span>}
          </div>
        </form>
      </td>
    </tr>
  );
}
