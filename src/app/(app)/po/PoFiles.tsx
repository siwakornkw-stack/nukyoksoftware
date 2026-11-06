"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

// As PoFile in src/lib/po/files.ts (a server module).
interface PoFile {
  id: string;
  name: string;
  url: string;
  pdf: boolean;
  by: string;
  at: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

// One file per request: the proxy stops request bodies at 10 MB. Returns the
// first error ("" when all went up).
async function send(poNo: string, files: File[], each: (f: PoFile) => void) {
  for (const file of files) {
    const fd = new FormData();
    fd.append("poNo", poNo);
    fd.append("file", file);
    const res = await fetch("/api/po/files", { method: "POST", body: fd }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return `${file.name}: ${d.error || "อัปโหลดไม่สำเร็จ"}`;
    each(d.file);
  }
  return "";
}

function FileInput({ busy, onPick }: { busy: boolean; onPick: (files: File[]) => void }) {
  return (
    <input
      type="file"
      multiple
      accept={ACCEPT}
      disabled={busy}
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) onPick(files);
      }}
    />
  );
}

// The list's บิล column: how many are attached (opens the PO at its bills) and attach more.
export function AttachBill({ poNo, count }: { poNo: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(files: File[]) {
    setBusy(true);
    setErr(await send(poNo, files, () => {}));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2 whitespace-nowrap">
        {count > 0 && (
          <Link href={`/po/${encodeURIComponent(poNo)}#bills`} className="text-sky-400 hover:underline" title="ดูบิลที่แนบ">
            📎 {count}
          </Link>
        )}
        <label className={`cursor-pointer text-slate-400 hover:text-white ${busy ? "opacity-60" : ""}`}>
          {busy ? "กำลังอัปโหลด..." : count ? "+ แนบ" : "📎 แนบบิล"}
          <FileInput busy={busy} onPick={pick} />
        </label>
      </div>
      {err && <div className="mt-1 max-w-48 text-rose-400">{err}</div>}
    </div>
  );
}

// Bills / quotations attached to this PO, shown above the approval.
export function PoFiles({ poNo, initial, admin }: { poNo: string; initial: PoFile[]; admin: boolean }) {
  const [files, setFiles] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(list: File[]) {
    setBusy(true);
    setErr(await send(poNo, list, (f) => setFiles((cur) => [...cur, f])));
    setBusy(false);
  }

  async function remove(f: PoFile) {
    if (!confirm(`ลบไฟล์ ${f.name}?`)) return;
    const res = await fetch(`/api/po/files?id=${encodeURIComponent(f.id)}`, { method: "DELETE" }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setErr(d.error || "ลบไม่สำเร็จ");
    setErr("");
    setFiles((cur) => cur.filter((x) => x.id !== f.id));
  }

  return (
    <div id="bills" className="mb-4 scroll-mt-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="font-semibold">บิล / เอกสารแนบ</div>
          <label className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium ${busy ? "opacity-60" : ""}`}>
            {busy ? "กำลังอัปโหลด..." : "📎 แนบบิล"}
            <FileInput busy={busy} onPick={pick} />
          </label>
          <span className="text-xs text-slate-500">รูปถ่ายหรือ PDF ไม่เกิน 10 MB ต่อไฟล์ · เก็บบนเว็บนี้ ไม่แก้ไขข้อมูลใน Express</span>
        </div>
        {err && <div className="mb-3 text-sm text-rose-400">{err}</div>}
        {files.length ? (
          <div className="flex flex-wrap gap-3">
            {files.map((f) => (
              <div key={f.id} className="w-48 text-xs">
                <a href={f.url} target="_blank" rel="noreferrer" title="เปิดไฟล์เต็ม" className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                  {f.pdf ? (
                    <span className="text-4xl">📄</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- private /uploads file behind the session
                    <img src={f.url} alt={f.name} className="h-full w-full object-contain" />
                  )}
                </a>
                <div className="mt-1 truncate text-slate-300" title={f.name}>{f.name}</div>
                <div className="text-slate-500">
                  {f.by} · {thDateTime(f.at)}
                </div>
                {admin && (
                  <button type="button" onClick={() => remove(f)} className="text-rose-400 hover:text-rose-300">
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">ยังไม่มีบิลแนบ</div>
        )}
      </Card>
    </div>
  );
}
