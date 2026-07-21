"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Opt {
  id: string;
  name: string;
}
interface Options {
  types: Opt[];
  brands: Opt[];
  drivers: Opt[];
  fuelTypes: Opt[];
}

export function VehicleForm({ options }: { options: Options }) {
  const router = useRouter();
  const [form, setForm] = useState({
    platePrefix: "",
    plateSuffix: "",
    plateProvince: "",
    vehicleTypeId: "",
    vehicleBrandId: "",
    model: "",
    color: "",
    vehicleDriverId: "",
    fuelTypeId: "",
    installmentPeriods: "",
    installmentAmount: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/fleet/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      router.push(`/fleet/vehicles/${d.vehicle.VehicleId}`);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
      <div className="grid grid-cols-3 gap-2 sm:col-span-2">
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">หมวดทะเบียน</span>
          <input className="field" value={form.platePrefix} onChange={set("platePrefix")} placeholder="1กก" />
        </label>
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">เลขทะเบียน *</span>
          <input className="field" value={form.plateSuffix} onChange={set("plateSuffix")} placeholder="1234" required />
        </label>
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">จังหวัด</span>
          <input className="field" value={form.plateProvince} onChange={set("plateProvince")} placeholder="ภูเก็ต" />
        </label>
      </div>

      <label className="text-sm">
        <span className="block text-slate-400 mb-1">ประเภท</span>
        <select className="field" value={form.vehicleTypeId} onChange={set("vehicleTypeId")}>
          <option value="">-</option>
          {options.types.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-400 mb-1">ยี่ห้อ</span>
        <select className="field" value={form.vehicleBrandId} onChange={set("vehicleBrandId")}>
          <option value="">-</option>
          {options.brands.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-slate-400 mb-1">รุ่น</span>
        <input className="field" value={form.model} onChange={set("model")} />
      </label>
      <label className="text-sm">
        <span className="block text-slate-400 mb-1">สี</span>
        <input className="field" value={form.color} onChange={set("color")} />
      </label>

      <label className="text-sm">
        <span className="block text-slate-400 mb-1">คนขับ</span>
        <select className="field" value={form.vehicleDriverId} onChange={set("vehicleDriverId")}>
          <option value="">-</option>
          {options.drivers.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-400 mb-1">ชนิดน้ำมัน</span>
        <select className="field" value={form.fuelTypeId} onChange={set("fuelTypeId")}>
          <option value="">-</option>
          {options.fuelTypes.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-slate-400 mb-1">จำนวนงวด</span>
        <input type="number" className="field" value={form.installmentPeriods} onChange={set("installmentPeriods")} />
      </label>
      <label className="text-sm">
        <span className="block text-slate-400 mb-1">ค่างวด/งวด (บาท)</span>
        <input type="number" className="field" value={form.installmentAmount} onChange={set("installmentAmount")} />
      </label>

      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-400 mb-1">หมายเหตุ</span>
        <input className="field" value={form.note} onChange={set("note")} />
      </label>

      {error && <div className="sm:col-span-2 text-sm text-rose-400">{error}</div>}

      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium"
        >
          {busy ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg px-4 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
