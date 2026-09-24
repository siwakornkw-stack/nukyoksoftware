"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyProfile } from "@/lib/company";

// Screen-only toolbar: print, back, and (admin) the letterhead used on every bill.
export function PrintBar({ admin, company }: { admin: boolean; company: CompanyProfile }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [c, setC] = useState(company);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/settings/company", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
    setEdit(false);
    router.refresh();
  }

  const input = "rounded border border-slate-300 px-2 py-1 text-sm";
  return (
    <div className="mx-auto mb-4 w-[210mm] max-w-full print:hidden">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500">
          พิมพ์ / บันทึก PDF
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg bg-white px-4 py-2 text-sm hover:bg-slate-50">
          กลับ
        </button>
        {admin && (
          <button type="button" onClick={() => setEdit(!edit)} className="rounded-lg bg-white px-4 py-2 text-sm hover:bg-slate-50">
            แก้หัวกระดาษ
          </button>
        )}
      </div>
      {edit && (
        <form onSubmit={save} className="mt-3 grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-2">
          <input className={input} placeholder="ชื่อบริษัท *" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required />
          <input className={input} placeholder="เลขประจำตัวผู้เสียภาษี" value={c.taxId} onChange={(e) => setC({ ...c, taxId: e.target.value })} />
          <textarea className={`${input} sm:col-span-2`} rows={2} placeholder="ที่อยู่" value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} />
          <input className={input} placeholder="โทร" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
          <button className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white">บันทึก</button>
          {err && <div className="text-sm text-rose-600 sm:col-span-2">{err}</div>}
        </form>
      )}
    </div>
  );
}
