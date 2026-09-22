"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

interface Item {
  key: string;
  label: string;
  detail: string;
  summary: string;
  newPlate: string;
  match: string | null;
  count: number;
  dup: number;
}
interface Preview {
  vehicles: { id: string; plate: string; model: string }[];
  items: Item[];
}
interface Result {
  created: number;
  dup: number;
  skipped: number;
  vehiclesCreated: number;
}

const defaultDecision = (i: Item) => (i.count === 0 ? "skip" : i.match ?? "new");

export function OfficeImport({
  kind,
  itemLabel,
  format,
  links,
}: {
  kind: "fuel" | "insurance";
  itemLabel: string;
  format: ReactNode;
  links: { href: string; label: string }[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function send(f: File, action: "preview" | "commit") {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("action", action);
    if (action === "commit") fd.append("decisions", JSON.stringify(decisions));
    setBusy(true);
    setError("");
    const res = await fetch(`/api/fleet/office-import/${kind}`, { method: "POST", body: fd });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "นำเข้าไม่สำเร็จ");
      return null;
    }
    return d;
  }

  async function pick(f: File) {
    setFile(f);
    setPreview(null);
    setResult(null);
    const p: Preview | null = await send(f, "preview");
    if (!p) return;
    setPreview(p);
    setDecisions(Object.fromEntries(p.items.map((i) => [i.key, defaultDecision(i)])));
  }

  async function commit() {
    if (!file) return;
    const r: Result | null = await send(file, "commit");
    if (!r) return;
    setResult(r);
    setPreview(null);
    router.refresh();
  }

  const plateOf = useMemo(() => new Map(preview?.vehicles.map((v) => [v.id, v.plate]) ?? []), [preview]);

  const stats = useMemo(() => {
    const s = { match: 0, create: 0, skip: 0, rows: 0, dup: 0 };
    for (const i of preview?.items ?? []) {
      const d = decisions[i.key];
      if (d === "skip") s.skip++;
      else {
        if (d === "new") s.create++;
        else s.match++;
        s.rows += i.count;
        if (d === i.match) s.dup += i.dup;
      }
    }
    return s;
  }, [preview, decisions]);

  const setAllUnmatched = (value: "new" | "skip") =>
    setDecisions((cur) => {
      const next = { ...cur };
      for (const i of preview?.items ?? []) if (!i.match && i.count > 0) next[i.key] = value;
      return next;
    });

  const shown = (preview?.items ?? []).filter((i) => !onlyUnmatched || !i.match);

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-sm text-slate-300 mb-3">{format}</div>
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-8 cursor-pointer hover:border-sky-400 transition-colors">
          <div className="text-3xl">⬆️</div>
          <div className="text-sm text-slate-300">{file ? file.name : "เลือกไฟล์ Excel (.xlsx)"}</div>
          <div className="text-xs text-slate-500">ระบบจะแสดงตัวอย่างให้ตรวจก่อน ยังไม่บันทึกจนกว่าจะกดยืนยัน</div>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
            <div>
              <div className="text-2xl font-semibold text-emerald-300">{result.created}</div>
              <div className="text-slate-400">รายการใหม่</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-amber-300">{result.dup}</div>
              <div className="text-slate-400">มีอยู่แล้ว (ข้าม)</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-300">{result.skipped}</div>
              <div className="text-slate-400">ไม่นำเข้า</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-sky-300">{result.vehiclesCreated}</div>
              <div className="text-slate-400">รถที่สร้างใหม่</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
                {l.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {preview && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-medium">ตรวจสอบก่อนนำเข้า</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {preview.items.length} {itemLabel} · จับคู่รถเดิม {stats.match} · สร้างรถใหม่ {stats.create} · ข้าม {stats.skip}
                {stats.dup > 0 && <span className="text-amber-300"> · ซ้ำกับที่มีอยู่ {stats.dup} รายการ (จะไม่บันทึกซ้ำ)</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => setAllUnmatched("new")} className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                ที่จับคู่ไม่ได้ → สร้างใหม่
              </button>
              <button type="button" onClick={() => setAllUnmatched("skip")} className="rounded-lg px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">
                ที่จับคู่ไม่ได้ → ข้าม
              </button>
              <label className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-slate-800/60 cursor-pointer">
                <input type="checkbox" checked={onlyUnmatched} onChange={(e) => setOnlyUnmatched(e.target.checked)} />
                เฉพาะที่จับคู่ไม่ได้
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">ในไฟล์</th>
                  <th className="py-2 pr-3">ข้อมูล</th>
                  <th className="py-2 w-72">บันทึกเข้ารถ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const d = decisions[i.key];
                  return (
                    <tr key={i.key} className={`border-b border-slate-800/50 align-top ${d === "skip" ? "opacity-50" : ""}`}>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{i.label}</div>
                        <div className="text-xs text-slate-500">{i.detail}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {i.summary}
                        {i.dup > 0 && d === i.match && (
                          <div className="text-xs text-amber-300 mt-0.5">
                            มีอยู่แล้ว {i.dup}/{i.count} รายการ
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <select
                          className="field"
                          value={d}
                          disabled={i.count === 0}
                          onChange={(e) => setDecisions((cur) => ({ ...cur, [i.key]: e.target.value }))}
                        >
                          {i.match && <option value={i.match}>✓ {plateOf.get(i.match)} (จับคู่อัตโนมัติ)</option>}
                          <option value="new">➕ สร้างรถใหม่: {i.newPlate}</option>
                          <option value="skip">ข้าม ไม่นำเข้า</option>
                          <optgroup label="เลือกรถที่มีอยู่">
                            {preview.vehicles
                              .filter((v) => v.id !== i.match)
                              .map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.plate}
                                  {v.model && v.model !== v.plate ? ` - ${v.model}` : ""}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={commit}
              disabled={busy || stats.rows === 0}
              className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium"
            >
              {busy ? "กำลังบันทึก..." : `ยืนยันนำเข้า ${stats.rows - stats.dup} รายการ`}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-lg px-4 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ยกเลิก
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
