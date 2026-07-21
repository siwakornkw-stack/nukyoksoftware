"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { baht, num, thDateTime } from "@/lib/format";
import type { VersionMeta } from "@/lib/debt/types";

export default function UploadPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(false);

  const loadVersions = useCallback(() => {
    fetch("/api/debt/versions")
      .then((r) => r.json())
      .then((d) => {
        setVersions(d.versions ?? []);
        setCurrentId(d.currentVersionId ?? null);
      });
  }, []);

  useEffect(loadVersions, [loadVersions]);

  async function upload(file: File) {
    setBusy(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/debt/upload", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setMsg(`อัปโหลดสำเร็จ: ${d.meta.rowCount} รายการ`);
      loadVersions();
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "อัปโหลดไม่สำเร็จ");
    }
  }

  async function switchVersion(id: string) {
    await fetch("/api/debt/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCurrentId(id);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="อัปโหลดข้อมูล" subtitle="ไฟล์ Excel รายงานใบวางบิล (BillingNoteReport)" />

      <Card className="mb-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors ${
            drag ? "border-sky-400 bg-sky-500/5" : "border-slate-700"
          }`}
        >
          <div className="text-3xl">⬆️</div>
          <div className="text-sm text-slate-300">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก (.xlsx)</div>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
        {busy && <div className="mt-3 text-sm text-sky-400">กำลังอัปโหลด...</div>}
        {msg && <div className="mt-3 text-sm text-slate-300">{msg}</div>}
      </Card>

      <Card>
        <div className="font-medium mb-3">ประวัติการอัปโหลด</div>
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate">{v.fileName}</div>
                <div className="text-xs text-slate-500">
                  {thDateTime(v.uploadedAt)} · {num(v.rowCount)} รายการ · {baht(v.totalAmount)}
                </div>
              </div>
              {v.id === currentId ? (
                <span className="text-xs text-emerald-400 shrink-0">● ใช้งานอยู่</span>
              ) : (
                <button
                  onClick={() => switchVersion(v.id)}
                  className="text-xs rounded-md px-2 py-1 bg-slate-800/60 hover:bg-slate-700/60 shrink-0"
                >
                  ใช้ชุดนี้
                </button>
              )}
            </div>
          ))}
          {!versions.length && <div className="text-sm text-slate-500">ยังไม่มีประวัติ</div>}
        </div>
      </Card>
    </div>
  );
}
