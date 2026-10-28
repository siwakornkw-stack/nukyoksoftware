"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { thDate } from "@/lib/format";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  expressItem: string; // the vehicle's item in Express (chosen before, or suggested from the plate)
}

// Express master data sent by the office PC (suppliers, per-vehicle fuel items).
interface ExpressChoices {
  at: string;
  writer: boolean; // the office PC writes queued bills into Express
  suppliers: { code: string; name: string }[];
  items: { code: string; desc: string; depCode: string; depName: string; stock: boolean; vatClaim: boolean }[];
}

interface Order {
  id: string;
  status: string;
  withH3: boolean;
  plate: string;
  date: string;
  invoice: string;
  amount: number;
  pkNo: string;
  h3No: string;
  error: string;
}

// Mileage a fill-up starts from, and the date of the fill it came from.
interface Odo {
  odo: number;
  date: string;
}

interface Bill {
  key: number;
  fileName: string;
  url: string; // object URL of the photo, for checking the numbers by eye
  rot: number; // degrees, for photos taken sideways
  state: "reading" | "ok" | "error";
  error: string;
  readError: string; // the reader failed: the photo is stored, fields are typed by hand
  billUrl: string; // the stored photo, saved with the fuel row
  dbOdo: Odo | null; // latest stored fill of this vehicle on or before the bill date
  odoTouched: boolean; // the start mileage was typed, so it is no longer filled in
  odoPhoto: string; // object URL of the odometer photo
  odoUrl: string; // the stored odometer photo
  odoState: "" | "reading" | "ok" | "error";
  odoNote: string; // what the reader made of the odometer photo
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
  price: string;
  amount: string;
  odoStart: string;
  odoEnd: string;
  receiver: string;
  supplier: string; // Express supplier (the station)
  expressItem: string; // Express item of the vehicle
}

type Editable = "vehicleId" | "date" | "invoice" | "item" | "liters" | "price" | "amount" | "odoStart" | "odoEnd" | "receiver";

const ORDER_LABEL: Record<string, string> = { queued: "กำลังเปิดใน Express", done: "เปิดแล้ว", error: "ไม่สำเร็จ", cancelled: "ยกเลิก" };
const ORDER_STYLE: Record<string, string> = {
  queued: "text-sky-300",
  done: "text-emerald-300",
  error: "text-rose-300",
  cancelled: "text-slate-400",
};

let nextKey = 1;

export function BillImport() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [express, setExpress] = useState<ExpressChoices | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [toExpress, setToExpress] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; dup: number; queued: number } | null>(null);
  const queue = useRef(Promise.resolve());

  const loadLists = useCallback(() => {
    fetch("/api/fleet/fuel-bills")
      .then((r) => r.json())
      .then((d) => {
        setVehicles(d.vehicles ?? []);
        setExpress(d.express ?? null);
        setOrders(d.orders ?? []);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id);
  const itemOf = (code: string) => express?.items.find((i) => i.code === code);
  const patch = (key: number, p: Partial<Bill>) => setBills((cur) => cur.map((b) => (b.key === key ? { ...b, ...p } : b)));

  async function read(b: Bill, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/fleet/fuel-bills", { method: "POST", body: fd }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return patch(b.key, { state: "error", error: d.error || "อัปโหลดรูปไม่สำเร็จ", include: false });
    const v = vehicles.find((x) => x.id === d.vehicleId);
    patch(b.key, {
      state: "ok",
      billUrl: d.billUrl ?? "",
      readError: d.readError ?? "",
      isFuel: d.isFuel ?? true,
      station: d.station ?? "",
      time: d.time ?? "",
      plate: d.plate ?? "",
      dup: d.dup ?? null,
      dbOdo: d.lastOdo ?? null,
      vehicleId: d.vehicleId ?? "",
      date: d.date ?? "",
      invoice: d.invoice ?? "",
      item: d.item ?? "",
      liters: d.liters ? String(d.liters) : "",
      price: d.price ? String(d.price) : "",
      amount: d.amount ? String(d.amount) : "",
      supplier: d.supplier ?? "",
      expressItem: v?.expressItem ?? "",
      include: d.readError ? true : d.isFuel && !d.dup,
    });
  }

  // Odometer / hour-meter photo for one bill: stored, then read into "เลขไมล์สิ้นสุด".
  async function readOdo(key: number, file: File) {
    const url = URL.createObjectURL(file);
    setBills((cur) =>
      cur.map((b) => {
        if (b.key !== key) return b;
        if (b.odoPhoto) URL.revokeObjectURL(b.odoPhoto);
        return { ...b, odoPhoto: url, odoUrl: "", odoState: "reading", odoNote: "" };
      })
    );
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "odometer");
    const res = await fetch("/api/fleet/fuel-bills", { method: "POST", body: fd }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return patch(key, { odoState: "error", odoNote: d.error || "อัปโหลดรูปไม่สำเร็จ" });
    setBills((cur) =>
      cur.map((b) => {
        if (b.key !== key) return b;
        const reading = Number(d.reading) || 0;
        const note = d.readError
          ? d.readError
          : !d.isMeter
            ? "รูปนี้อาจไม่ใช่หน้าปัดเลขไมล์ ตรวจก่อนบันทึก"
            : reading
              ? `อ่านได้ ${reading.toLocaleString("th-TH")} ${d.unit === "hours" ? "ชั่วโมง" : "กม."} ใส่ในเลขไมล์สิ้นสุดแล้ว`
              : "อ่านเลขไมล์ไม่ออก กรอกเองจากรูป";
        return { ...b, odoUrl: d.odoUrl ?? "", odoState: "ok", odoNote: note, odoEnd: reading ? String(reading) : b.odoEnd };
      })
    );
  }

  // The vehicle or the date changed: look up where that vehicle's previous fill ended.
  async function refreshOdo(key: number, vehicleId: string, date: string) {
    if (!vehicleId) return patch(key, { dbOdo: null });
    const d = await fetch(`/api/fleet/fuel-bills?odo=${encodeURIComponent(vehicleId)}&date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .catch(() => ({}));
    // Ignore an answer that arrives after the user picked yet another vehicle or date.
    setBills((cur) => cur.map((b) => (b.key === key && b.vehicleId === vehicleId && b.date === date ? { ...b, dbOdo: d.lastOdo ?? null } : b)));
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
        readError: "",
        billUrl: "",
        dbOdo: null,
        odoTouched: false,
        odoPhoto: "",
        odoUrl: "",
        odoState: "",
        odoNote: "",
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
        price: "",
        amount: "",
        odoStart: "",
        odoEnd: "",
        receiver: "",
        supplier: "",
        expressItem: "",
      };
      setBills((cur) => [...cur, b]);
      queue.current = queue.current.then(() => read(b, file));
    }
  }

  function remove(key: number) {
    setBills((cur) => {
      const b = cur.find((x) => x.key === key);
      if (b) {
        URL.revokeObjectURL(b.url);
        if (b.odoPhoto) URL.revokeObjectURL(b.odoPhoto);
      }
      return cur.filter((x) => x.key !== key);
    });
  }

  // Start mileage filled in for each bill: the latest earlier fill of the same
  // vehicle, from the database or from a bill above it in this batch (by date),
  // so the second bill of a vehicle starts where the first one ended.
  const autoOdo = useMemo(() => {
    const out = new Map<number, Odo>();
    const running = new Map<string, Odo>();
    const order = bills
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.vehicleId)
      .sort((x, y) => x.b.date.localeCompare(y.b.date) || x.i - y.i);
    for (const { b } of order) {
      const prev = running.get(b.vehicleId);
      const base = prev && (!b.dbOdo || prev.date >= b.dbOdo.date) ? prev : b.dbOdo;
      if (base && base.odo > 0) out.set(b.key, base);
      const start = b.odoTouched ? Number(b.odoStart) || 0 : base?.odo ?? 0;
      const end = Number(b.odoEnd) || 0;
      if (end > 0 || start > 0) running.set(b.vehicleId, { odo: end > 0 ? end : start, date: b.date });
    }
    return out;
  }, [bills]);
  const startOf = (b: Bill) => (b.odoTouched ? b.odoStart : String(autoOdo.get(b.key)?.odo ?? ""));

  const useExpress = toExpress && !!express?.writer;
  // What keeps a bill from being sent to Express ("" = ready).
  const expressProblem = (b: Bill) => {
    if (!b.supplier) return "เลือกปั๊ม (ผู้จำหน่ายใน Express)";
    if (!itemOf(b.expressItem)) return "เลือกรหัสรถใน Express";
    if (!b.invoice.trim()) return "ต้องมีเลขที่ใบกำกับภาษี";
    if (!(Number(b.liters) > 0)) return "ต้องกรอกจำนวนลิตร";
    return "";
  };

  const chosen = bills.filter((b) => b.include && b.state === "ok");
  const reading = bills.some((b) => b.state === "reading" || b.odoState === "reading");
  const blocked = useExpress ? chosen.filter((b) => expressProblem(b)) : [];

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
      price: Number(b.price) || 0,
      amount: Number(b.amount) || 0,
      odoStart: Number(startOf(b)) || 0,
      odoEnd: Number(b.odoEnd) || 0,
      receiver: b.receiver,
      billUrl: b.billUrl,
      odoUrl: b.odoUrl,
      station: b.station,
      express: useExpress ? { supplier: b.supplier, item: b.expressItem } : null,
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
    for (const b of bills) {
      if (!saved.has(b.key)) continue;
      URL.revokeObjectURL(b.url);
      if (b.odoPhoto) URL.revokeObjectURL(b.odoPhoto);
    }
    setBills((cur) => cur.filter((b) => !saved.has(b.key)));
    loadLists();
  }

  const input = (b: Bill, f: Editable, type = "text", step?: string) => (
    <input
      type={type}
      step={step}
      value={b[f]}
      onChange={(e) => {
        patch(b.key, { [f]: e.target.value });
        if (f === "date") refreshOdo(b.key, b.vehicleId, e.target.value);
      }}
      className="field w-full"
    />
  );

  return (
    <div className="space-y-4">
      <Card>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400 mb-3">
          <li>เลือกรูปบิลได้หลายใบพร้อมกัน ระบบอ่านวันที่ เลขที่ใบกำกับ ทะเบียนรถ ลิตร และยอดเงินให้</li>
          <li>ถ่ายรูปเลขไมล์ (หรือชั่วโมงเครื่องจักร) แนบกับแต่ละบิลได้ ระบบอ่านเลขไมล์ใส่ให้</li>
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
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
          {express && !express.writer ? (
            <div className="text-xs text-slate-500">สั่งเปิด PK + H3 ใน Express: ยังไม่เปิดใช้ (บันทึกบิลได้ตามปกติ แล้วคีย์ใน Express เอง)</div>
          ) : express ? (
            <>
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={toExpress} onChange={(e) => setToExpress(e.target.checked)} />
                สั่งเปิด PK + H3 ใน Express ให้บิลที่บันทึก
              </label>
              <div className="mt-1 text-xs text-slate-400">
                ระบบเปิดใบสั่งซื้อน้ำมัน (PK) และ H3 (ซื้อสดด้วยบัตร ลงภาษีซื้อ) ใน Express ให้ภายใน 1-2 นาที แล้ว admin อนุมัติ PK ที่เมนู
                ใบสั่งซื้อน้ำมันใหม่ (PK) เพื่อสร้าง R3 · <b className="text-amber-300">ตรวจเลขที่ใบกำกับภาษีให้ตรงกับบิล</b> เพราะเข้ารายงานภาษีซื้อ ·
                บิลที่สั่งเปิดแล้ว อย่าคีย์ซ้ำใน Express
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">สั่งเปิด PK + H3 ใน Express: ยังไม่มีข้อมูลจาก Express (รอเครื่องที่มี Express ส่งข้อมูลมา)</div>
          )}
        </div>
        {error && <div className="mt-3 text-sm text-rose-400">{error}</div>}
      </Card>

      {result && (
        <Card>
          <div className="font-medium mb-2">บันทึกเรียบร้อย</div>
          <div className="text-sm text-slate-300">
            บันทึกใหม่ <span className="text-emerald-300 font-semibold">{result.created}</span> บิล
            {result.dup > 0 && <span className="text-amber-300"> · มีอยู่แล้ว (ข้าม) {result.dup} บิล</span>}
            {result.queued > 0 && <span className="text-sky-300"> · สั่งเปิดใน Express {result.queued} บิล (ดูสถานะด้านล่าง)</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/fleet/fuel/records" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              ดูรายละเอียดน้ำมัน
            </Link>
          </div>
        </Card>
      )}

      {bills.map((b, i) => {
        const it = itemOf(b.expressItem);
        const problem = useExpress && b.include && b.state === "ok" ? expressProblem(b) : "";
        return (
          <Card key={b.key} className={b.include ? "" : "opacity-70"}>
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Square box: the photo turned 90 degrees still fits inside it. */}
              <div>
                <a href={b.url} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม" className="block aspect-square overflow-hidden rounded-lg bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not an optimisable asset */}
                  <img src={b.url} alt={b.fileName} style={{ transform: `rotate(${b.rot}deg)` }} className="h-full w-full object-contain transition-transform" />
                </a>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button type="button" onClick={() => patch(b.key, { rot: (b.rot + 90) % 360 })} className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                    ↻ หมุนรูป
                  </button>
                  <a href={b.url} target="_blank" rel="noreferrer" className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                    🔍 เปิดรูปเต็ม
                  </a>
                  {b.state === "ok" && (
                    <label className="cursor-pointer rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                      📷 {b.odoPhoto ? "เปลี่ยนรูปเลขไมล์" : "รูปเลขไมล์"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) readOdo(b.key, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {b.odoPhoto && (
                  <div className="mt-2 flex items-start gap-2">
                    <a href={b.odoPhoto} target="_blank" rel="noreferrer" title="เปิดรูปเลขไมล์" className="block h-20 w-28 shrink-0 overflow-hidden rounded-md bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not an optimisable asset */}
                      <img src={b.odoPhoto} alt="เลขไมล์" className="h-full w-full object-contain" />
                    </a>
                    <div className={`text-xs ${b.odoState === "error" ? "text-rose-400" : "text-slate-400"}`}>
                      {b.odoState === "reading" ? "กำลังอ่านเลขไมล์..." : b.odoNote}
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={b.include} disabled={b.state !== "ok"} onChange={(e) => patch(b.key, { include: e.target.checked })} />
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
                    {b.readError && <div className="mb-2 text-sm text-amber-300">⚠ {b.readError}</div>}
                    {!b.readError && !b.isFuel && <div className="mb-2 text-sm text-amber-300">รูปนี้อาจไม่ใช่บิลน้ำมัน ตรวจก่อนติ๊กบันทึก</div>}
                    {b.dup && <div className="mb-2 text-sm text-amber-300">{b.dup}</div>}
                    {!b.vehicleId && <div className="mb-2 text-sm text-amber-300">จับคู่รถไม่ได้ เลือกรถก่อนบันทึก</div>}
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <label>
                        <span className="block text-slate-400 mb-1">บันทึกเข้ารถ</span>
                        <select
                          value={b.vehicleId}
                          onChange={(e) => {
                            const v = vehicleOf(e.target.value);
                            patch(b.key, { vehicleId: e.target.value, expressItem: v?.expressItem ?? "" });
                            refreshOdo(b.key, e.target.value, b.date);
                          }}
                          className="field w-full"
                        >
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
                        <span className="block text-slate-400 mb-1">
                          เลขที่ใบกำกับภาษี{useExpress && <span className="text-amber-300"> (เข้ารายงานภาษีซื้อ ตรวจให้ตรง)</span>}
                        </span>
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
                        <span className="block text-slate-400 mb-1">
                          ราคาต่อลิตร <span className="text-slate-600">(ไม่บังคับ)</span>
                        </span>
                        {input(b, "price", "number", "0.01")}
                      </label>
                      <label>
                        <span className="block text-slate-400 mb-1">จำนวนเงิน (รวม VAT)</span>
                        {input(b, "amount", "number", "0.01")}
                      </label>
                      <label>
                        <span className="block text-slate-400 mb-1">
                          ผู้รับน้ำมัน <span className="text-slate-600">(ไม่บังคับ)</span>
                        </span>
                        {input(b, "receiver")}
                      </label>
                      <label>
                        <span className="block text-slate-400 mb-1">
                          เลขไมล์เริ่ม <span className="text-slate-600">(ไม่บังคับ)</span>
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={startOf(b)}
                          onChange={(e) => patch(b.key, { odoStart: e.target.value, odoTouched: true })}
                          className="field w-full"
                        />
                        {!b.odoTouched && autoOdo.has(b.key) && (
                          <span className="block mt-1 text-xs text-slate-500">ดึงจากการเติมครั้งก่อน ({thDate(autoOdo.get(b.key)!.date)})</span>
                        )}
                      </label>
                      <label>
                        <span className="block text-slate-400 mb-1">
                          เลขไมล์สิ้นสุด <span className="text-slate-600">(ไม่บังคับ)</span>
                        </span>
                        {input(b, "odoEnd", "number", "0.01")}
                      </label>
                    </div>

                    {useExpress && (
                      <div className="mt-3 rounded-lg border border-slate-800 p-3">
                        <div className="mb-2 text-xs font-medium text-slate-300">เปิดใน Express</div>
                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                          <label>
                            <span className="block text-slate-400 mb-1">ปั๊ม (ผู้จำหน่าย)</span>
                            <select value={b.supplier} onChange={(e) => patch(b.key, { supplier: e.target.value })} className="field w-full">
                              <option value="">- เลือกปั๊ม -</option>
                              {express!.suppliers.map((s) => (
                                <option key={s.code} value={s.code}>
                                  {s.code} {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="block text-slate-400 mb-1">รหัสรถใน Express</span>
                            <select value={b.expressItem} onChange={(e) => patch(b.key, { expressItem: e.target.value })} className="field w-full">
                              <option value="">- เลือกรหัสรถ -</option>
                              {express!.items.map((x) => (
                                <option key={x.code} value={x.code}>
                                  {x.code} · {x.desc}
                                </option>
                              ))}
                            </select>
                            {it && (
                              <span className="block mt-1 text-xs text-slate-500">
                                แผนก {it.depCode} {it.depName}
                              </span>
                            )}
                          </label>
                        </div>
                        {it && (it.stock || !it.vatClaim) && (
                          <div className="mt-2 text-xs text-amber-300">
                            รถคันนี้ระบบเปิดให้เฉพาะ PK · H3 ต้องทำใน Express เอง ({it.stock ? "เป็นสินค้าคงคลังที่คิดต้นทุนแบบล็อต" : "ขอคืนภาษีซื้อไม่ได้"})
                          </div>
                        )}
                        {problem && <div className="mt-2 text-xs text-rose-300">ยังสั่งเปิดไม่ได้: {problem}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {bills.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || reading || !chosen.length || blocked.length > 0}
            className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium"
          >
            {saving ? "กำลังบันทึก..." : reading ? "รออ่านรูปให้ครบ..." : `ยืนยันบันทึก ${chosen.length} บิล${useExpress ? " + สั่งเปิดใน Express" : ""}`}
          </button>
          <span className="text-xs text-slate-500">
            บันทึกเฉพาะบิลที่ติ๊กไว้{blocked.length > 0 && <span className="text-rose-300"> · มี {blocked.length} บิลที่ยังเลือกข้อมูล Express ไม่ครบ</span>}
          </span>
        </div>
      )}

      {orders.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium">สั่งเปิดใน Express ล่าสุด</div>
            <button type="button" onClick={loadLists} className="rounded-lg px-2.5 py-1 text-xs bg-slate-800/60 hover:bg-slate-700/60">
              ↻ รีเฟรช
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">วันที่</th>
                  <th className="py-2 pr-3">รถ</th>
                  <th className="py-2 pr-3">ใบกำกับ</th>
                  <th className="py-2 pr-3 text-right">ยอด</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2">เอกสารใน Express</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3 whitespace-nowrap">{thDate(o.date)}</td>
                    <td className="py-2 pr-3">{o.plate}</td>
                    <td className="py-2 pr-3 text-slate-400">{o.invoice}</td>
                    <td className="py-2 pr-3 text-right">{o.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                    <td className={`py-2 pr-3 ${ORDER_STYLE[o.status] ?? ""}`}>
                      {ORDER_LABEL[o.status] ?? o.status}
                      {o.error && <div className="text-xs text-rose-300">{o.error}</div>}
                    </td>
                    <td className="py-2 text-slate-300">
                      {o.pkNo && (
                        <Link href={`/po/${encodeURIComponent(o.pkNo)}`} className="text-sky-400 hover:underline">
                          {o.pkNo}
                        </Link>
                      )}
                      {o.h3No && <span className="ml-2">{o.h3No}</span>}
                      {o.status === "done" && !o.withH3 && <span className="ml-2 text-xs text-amber-300">H3 ทำใน Express เอง</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
