"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface Bill {
  key: number;
  fileName: string;
  url: string; // object URL of the photo, for checking the numbers by eye
  rot: number; // degrees, for photos taken sideways
  state: "reading" | "ok" | "error";
  error: string;
  include: boolean;
  isFuel: boolean;
  station: string;
  time: string;
  plate: string;
  dup: string | null;
  vehicleId: string;
  date: string;
  invoice: string;
  item: string;
  liters: string;
  amount: string;
  odoStart: string;
  odoEnd: string;
  receiver: string;
}

type Editable = "vehicleId" | "date" | "invoice" | "item" | "liters" | "amount" | "odoStart" | "odoEnd" | "receiver";

let nextKey = 1;

export function BillImport() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; dup: number } | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    fetch("/api/fleet/fuel-bills")
      .then((r) => r.json())
      .then((d) => setVehicles(d.vehicles ?? []))
      .catch(() => {});
  }, []);

  const patch = (key: number, p: Partial<Bill>) => setBills((cur) => cur.map((b) => (b.key === key ? { ...b, ...p } : b)));

  async function read(b: Bill, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/fleet/fuel-bills", { method: "POST", body: fd }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return patch(b.key, { state: "error", error: d.error || "อ่านบิลไม่สำเร็จ", include: false });
    patch(b.key, {
      state: "ok",
      isFuel: d.isFuel,
      station: d.station,
      time: d.time,
      plate: d.plate,
      dup: d.dup,
      vehicleId: d.vehicleId ?? "",
      date: d.date,
      invoice: d.invoice,
      item: d.item,
      liters: d.liters ? String(d.liters) : "",
      amount: d.amount ? String(d.amount) : "",
      include: d.isFuel && !d.dup,
    });
  }

  // One photo at a time: the reader's free tier answers 429 to bursts.
  function pick(files: FileList) {
    setResult(null);
    setError("");
    for (const file of Array.from(files)) {
      const b: Bill = {
        key: nextKey++,
        fileName: file.name,
        url: URL.createObjectURL(file),
        rot: 0,
        state: "reading",
        error: "",
        include: false,
        isFuel: true,
        station: "",
        time: "",
        plate: "",
        dup: null,
        vehicleId: "",
        date: "",
        invoice: "",
        item: "",
        liters: "",
        amount: "",
        odoStart: "",
        odoEnd: "",
        receiver: "",
      };
      setBills((cur) => [...cur, b]);
      queue.current = queue.current.then(() => read(b, file));
    }
  }

  function remove(key: number) {
    setBills((cur) => {
      const b = cur.find((x) => x.key === key);
      if (b) URL.revokeObjectURL(b.url);
      return cur.filter((x) => x.key !== key);
    });
  }

  const chosen = bills.filter((b) => b.include && b.state === "ok");
  const reading = bills.some((b) => b.state === "reading");

  async function save() {
    setSaving(true);
    setError("");
    const rows = chosen.map((b) => ({
      no: bills.indexOf(b) + 1,
      vehicleId: b.vehicleId,
      plate: b.plate,
      date: b.date,
      invoice: b.invoice,
      item: b.item,
      liters: Number(b.liters) || 0,
      amount: Number(b.amount) || 0,
      odoStart: Number(b.odoStart) || 0,
      odoEnd: Number(b.odoEnd) || 0,
      receiver: b.receiver,
    }));
    const res = await fetch("/api/fleet/fuel-bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }).catch(() => null);
    setSaving(false);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(d.error || "บันทึกไม่สำเร็จ");
    setResult(d);
    const saved = new Set(chosen.map((b) => b.key));
    for (const b of bills) if (saved.has(b.key)) URL.revokeObjectURL(b.url);
    setBills((cur) => cur.filter((b) => !saved.has(b.key)));
  }

  const input = (b: Bill, f: Editable, type = "text", step?: string) => (
    <input
      type={type}
      step={step}
      value={b[f]}
      onChange={(e) => patch(b.key, { [f]: e.target.value })}
      className="field w-full"
    />
  );

  return (
    <div className="space-y-4">
      <Card>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400 mb-3">
          <li>เลือกรูปบิลได้หลายใบพร้อมกัน ระบบอ่านวันที่ เลขที่ใบกำกับ ทะเบียนรถ ลิตร และยอดเงินให้</li>
          <li>ตรวจกับรูปทุกใบก่อนบันทึก แก้ช่องที่อ่านผิดได้ ถ้าทะเบียนในบิลจับคู่รถไม่ได้ ให้เลือกรถเอง (ครั้งต่อไประบบจะจำให้)</li>
          <li>บิลที่มีอยู่แล้ว (เลขที่ใบกำกับซ้ำ) จะไม่ถูกติ๊กไว้ และไม่บันทึกซ้ำ ไฟล์ Excel ประจำเดือนที่นำเข้าทีหลังก็จะข้ามบิลเหล่านี้</li>
        </ul>
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-8 cursor-pointer hover:border-sky-400 transition-colors">
          <div className="text-3xl">🧾</div>
          <div className="text-sm text-slate-300">เลือกรูปบิล (JPG / PNG) ได้หลายใบ</div>
          <div className="text-xs text-slate-500">ยังไม่บันทึกจนกว่าจะกดยืนยัน</div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {error && <div className="mt-3 text-sm text-rose-400">{error}</div>}
      </Card>

      {result && (
        <Card>
          <div className="font-medium mb-2">บันทึกเรียบร้อย</div>
          <div className="text-sm text-slate-300">
            บันทึกใหม่ <span className="text-emerald-300 font-semibold">{result.created}</span> บิล
            {result.dup > 0 && <span className="text-amber-300"> · มีอยู่แล้ว (ข้าม) {result.dup} บิล</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/fleet/fuel/records" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              ดูรายละเอียดน้ำมัน
            </Link>
          </div>
        </Card>
      )}

      {bills.map((b, i) => (
        <Card key={b.key} className={b.include ? "" : "opacity-70"}>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Square box: the photo turned 90 degrees still fits inside it. */}
            <div>
              <a href={b.url} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม" className="block aspect-square overflow-hidden rounded-lg bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not an optimisable asset */}
                <img
                  src={b.url}
                  alt={b.fileName}
                  style={{ transform: `rotate(${b.rot}deg)` }}
                  className="h-full w-full object-contain transition-transform"
                />
              </a>
              <div className="mt-2 flex gap-2 text-xs">
                <button type="button" onClick={() => patch(b.key, { rot: (b.rot + 90) % 360 })} className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                  ↻ หมุนรูป
                </button>
                <a href={b.url} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                  🔍 เปิดรูปเต็ม
                </a>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={b.include}
                    disabled={b.state !== "ok"}
                    onChange={(e) => patch(b.key, { include: e.target.checked })}
                  />
                  บิลที่ {i + 1}
                </label>
                {b.station && <span className="text-xs text-slate-400">{b.station}{b.time && ` · ${b.time} น.`}</span>}
                {b.plate && <span className="text-xs text-slate-400">ทะเบียนในบิล: {b.plate}</span>}
                <button type="button" onClick={() => remove(b.key)} className="ml-auto text-xs text-rose-400 hover:text-rose-300">
                  เอาออก
                </button>
              </div>

              {b.state === "reading" && <div className="text-sm text-sky-400">กำลังอ่านบิล...</div>}
              {b.state === "error" && <div className="text-sm text-rose-400">{b.error}</div>}
              {b.state === "ok" && (
                <>
                  {!b.isFuel && <div className="mb-2 text-sm text-amber-300">รูปนี้อาจไม่ใช่บิลน้ำมัน ตรวจก่อนติ๊กบันทึก</div>}
                  {b.dup && <div className="mb-2 text-sm text-amber-300">{b.dup}</div>}
                  {!b.vehicleId && <div className="mb-2 text-sm text-amber-300">จับคู่รถไม่ได้ เลือกรถก่อนบันทึก</div>}
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <label>
                      <span className="block text-slate-400 mb-1">บันทึกเข้ารถ</span>
                      <select value={b.vehicleId} onChange={(e) => patch(b.key, { vehicleId: e.target.value })} className="field w-full">
                        <option value="">- เลือกรถ -</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.plate}
                            {v.model && v.model !== v.plate ? ` - ${v.model}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">วันที่</span>
                      {input(b, "date", "date")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">เลขที่ใบกำกับภาษี</span>
                      {input(b, "invoice")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">รายการ</span>
                      {input(b, "item")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">ลิตร</span>
                      {input(b, "liters", "number", "0.001")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">จำนวนเงิน (รวม VAT)</span>
                      {input(b, "amount", "number", "0.01")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">
                        เลขไมล์เริ่ม <span className="text-slate-600">(ไม่บังคับ)</span>
                      </span>
                      {input(b, "odoStart", "number", "0.01")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">
                        เลขไมล์สิ้นสุด <span className="text-slate-600">(ไม่บังคับ)</span>
                      </span>
                      {input(b, "odoEnd", "number", "0.01")}
                    </label>
                    <label>
                      <span className="block text-slate-400 mb-1">
                        ผู้รับน้ำมัน <span className="text-slate-600">(ไม่บังคับ)</span>
                      </span>
                      {input(b, "receiver")}
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}

      {bills.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || reading || !chosen.length}
            className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium"
          >
            {saving ? "กำลังบันทึก..." : reading ? "รออ่านบิลให้ครบ..." : `ยืนยันบันทึก ${chosen.length} บิล`}
          </button>
          <span className="text-xs text-slate-500">บันทึกเฉพาะบิลที่ติ๊กไว้</span>
        </div>
      )}
    </div>
  );
}
