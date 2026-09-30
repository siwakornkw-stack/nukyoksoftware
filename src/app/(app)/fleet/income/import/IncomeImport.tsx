"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { baht, thDate } from "@/lib/format";

interface Sheet {
  file: string;
  sheet: string;
  kind: "tax" | "cash";
  rows: number;
  sum: number;
  cancelled: number;
  dup: number;
  newRows: number;
  newSum: number;
  from: string;
  to: string;
}
interface Result {
  created: number;
  dup: number;
  sum: number;
}

const KIND = { tax: "ในระบบ (ก่อน VAT)", cash: "บิลนอก" };

export function IncomeImport() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function send(fs: File[], action: "preview" | "commit") {
    const fd = new FormData();
    for (const f of fs) fd.append("file", f);
    fd.append("action", action);
    setBusy(true);
    setError("");
    const res = await fetch("/api/fleet/income-import", { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "นำเข้าไม่สำเร็จ");
      return null;
    }
    return d;
  }

  async function pick(fs: File[]) {
    setFiles(fs);
    setSheets(null);
    setResult(null);
    const d = await send(fs, "preview");
    if (d) setSheets(d.sheets);
  }

  async function commit() {
    const r: Result | null = await send(files, "commit");
    if (!r) return;
    setResult(r);
    setSheets(null);
    router.refresh();
  }

  const newRows = sheets?.reduce((a, s) => a + s.newRows, 0) ?? 0;
  const newSum = sheets?.reduce((a, s) => a + s.newSum, 0) ?? 0;
  const dup = sheets?.reduce((a, s) => a + s.dup, 0) ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-400 mb-3">
          <li>ทุกแผ่นงานที่มีหัวตาราง &quot;ลำดับที่&quot; และ &quot;เลขที่เอกสาร&quot; (ในระบบ, บิลนอก และแผ่นที่ชื่อมีคำว่ายกเลิก)</li>
          <li>ในระบบ: ใช้ยอดขายรวมก่อนภาษี · บิลนอก: ใช้ยอดในคอลัมน์มูลค่า / ยอดรวมสุทธิ · แถวที่สถานะ &quot;ยกเลิก&quot; จะถูกข้าม</li>
          <li>ไฟล์ไม่มีทะเบียนรถ: บันทึกเป็นรายรับของบริษัท เข้ายอดรวมในหน้ารายงาน ไม่เข้ากำไรขาดทุนรายคัน</li>
          <li>นำเข้าซ้ำได้ เอกสารในระบบที่เลขที่ซ้ำ และบิลนอกที่เลขที่ + วันที่ซ้ำ จะไม่ถูกบันทึกซ้ำ</li>
        </ul>
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-8 cursor-pointer hover:border-sky-400 transition-colors">
          <div className="text-3xl">⬆️</div>
          <div className="text-sm text-slate-300">{files.length ? files.map((f) => f.name).join(", ") : "เลือกไฟล์ Excel (.xlsx) ได้หลายไฟล์"}</div>
          <div className="text-xs text-slate-500">ระบบจะแสดงตัวอย่างให้ตรวจก่อน ยังไม่บันทึกจนกว่าจะกดยืนยัน</div>
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) pick(fs);
              e.target.value = "";
            }}
          />
        </label>
        {busy && <div className="mt-3 text-sm text-sky-400">กำลังประมวลผล...</div>}
        {error && <div className="mt-3 text-sm text-rose-400">{error}</div>}
      </Card>

      {result && (
        <Card>
          <div className="font-medium mb-3">นำเข้าเรียบร้อย</div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <div className="text-2xl font-semibold text-emerald-300">{result.created}</div>
              <div className="text-slate-400">รายการใหม่</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-emerald-300">{baht(result.sum)}</div>
              <div className="text-slate-400">ยอดที่บันทึก</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-amber-300">{result.dup}</div>
              <div className="text-slate-400">มีอยู่แล้ว (ข้าม)</div>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/fleet/reports" className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              ดูรายงานการเงิน
            </Link>
          </div>
        </Card>
      )}

      {sheets && (
        <Card>
          <div className="font-medium">ตรวจสอบก่อนนำเข้า</div>
          <div className="text-xs text-slate-400 mt-0.5 mb-3">
            {sheets.length} แผ่นงาน · ใหม่ {newRows} รายการ {baht(newSum)}
            {dup > 0 && <span className="text-amber-300"> · ซ้ำ {dup} รายการ (จะไม่บันทึกซ้ำ)</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">ไฟล์ / แผ่นงาน</th>
                  <th className="py-2 pr-3">ช่วงวันที่</th>
                  <th className="py-2 pr-3 text-right">รายการ</th>
                  <th className="py-2 pr-3 text-right">ยอดในไฟล์</th>
                  <th className="py-2 pr-3 text-right">ใหม่</th>
                  <th className="py-2 text-right">ยอดใหม่</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((s) => (
                  <tr key={`${s.file}|${s.sheet}`} className="border-b border-slate-800/50 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{s.file}</div>
                      <div className="text-xs text-slate-500">
                        {s.sheet} · {KIND[s.kind]}
                        {s.cancelled > 0 && ` · ข้ามยกเลิก ${s.cancelled}`}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{s.from ? `${thDate(s.from)} - ${thDate(s.to)}` : "-"}</td>
                    <td className="py-2 pr-3 text-right">{s.rows}</td>
                    <td className="py-2 pr-3 text-right">{baht(s.sum)}</td>
                    <td className="py-2 pr-3 text-right">
                      {s.newRows}
                      {s.dup > 0 && <div className="text-xs text-amber-300">ซ้ำ {s.dup}</div>}
                    </td>
                    <td className="py-2 text-right text-emerald-300">{baht(s.newSum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={commit}
              disabled={busy || newRows === 0}
              className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium"
            >
              {busy ? "กำลังบันทึก..." : `ยืนยันนำเข้า ${newRows} รายการ`}
            </button>
            <button type="button" onClick={() => setSheets(null)} className="rounded-lg px-4 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ยกเลิก
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
