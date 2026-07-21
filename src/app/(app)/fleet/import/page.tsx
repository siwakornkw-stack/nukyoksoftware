"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";

const MODES = [
  {
    key: "vehicles",
    label: "รถ",
    columns: "เลขทะเบียน, หมวด, จังหวัด, รุ่น, สี, จำนวนงวด, ค่างวด",
    note: "แถวที่ทะเบียนซ้ำกับที่มีอยู่จะถูกข้าม",
  },
  {
    key: "installments",
    label: "ค่างวด",
    columns: "ทะเบียน, งวด, ครบกำหนด, ยอด",
    note: "แถวที่หาทะเบียนไม่พบจะถูกข้าม",
  },
  {
    key: "income",
    label: "รายรับ",
    columns: "ทะเบียน, วันที่, รายละเอียด, เลขที่ใบสั่งงาน, เลขที่ใบแจ้งหนี้, รับเงิน",
    note: "แถวที่หาทะเบียนไม่พบจะถูกข้าม",
  },
];

export default function FleetImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState("vehicles");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    dup: number;
    skipped: number;
    total: number;
    mode: string;
  } | null>(null);
  const [error, setError] = useState("");

  const current = MODES.find((m) => m.key === mode) ?? MODES[0];

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    const res = await fetch("/api/fleet/import", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) {
      setResult(await res.json());
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "นำเข้าไม่สำเร็จ");
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="นำเข้าข้อมูล" subtitle="นำเข้าข้อมูลจากไฟล์ Excel/CSV" />

      <Card className="mb-4">
        <label className="block text-sm mb-3">
          <span className="block text-slate-400 mb-1">ประเภทข้อมูล</span>
          <select
            className="field"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setResult(null);
              setError("");
            }}
          >
            {MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm text-slate-400 mb-3">
          รองรับคอลัมน์: <span className="text-slate-200">{current.columns}</span>
          <br />
          {current.note}
        </div>
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-10 cursor-pointer hover:border-sky-400 transition-colors">
          <div className="text-3xl">⬆️</div>
          <div className="text-sm text-slate-300">เลือกไฟล์ (.xlsx / .csv)</div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {busy && <div className="mt-3 text-sm text-sky-400">กำลังนำเข้า...</div>}
        {error && <div className="mt-3 text-sm text-rose-400">{error}</div>}
      </Card>

      {result && (
        <Card>
          <div className="font-medium mb-2">ผลการนำเข้า</div>
          <div className="grid grid-cols-4 gap-3 text-center text-sm">
            <div>
              <div className="text-2xl font-semibold text-emerald-300">{result.created}</div>
              <div className="text-slate-400">เพิ่มใหม่</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-amber-300">{result.dup}</div>
              <div className="text-slate-400">ซ้ำ (ข้าม)</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-300">{result.skipped}</div>
              <div className="text-slate-400">ข้าม</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{result.total}</div>
              <div className="text-slate-400">ทั้งหมด</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
