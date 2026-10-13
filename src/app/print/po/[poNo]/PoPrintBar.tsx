"use client";

import { useRouter } from "next/navigation";

// Screen-only toolbar for the PO preview.
export function PoPrintBar({ note }: { note?: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500">
        พิมพ์ / บันทึก PDF
      </button>
      <button type="button" onClick={() => router.back()} className="rounded-lg bg-white px-4 py-2 text-sm hover:bg-slate-50">
        กลับ
      </button>
      {note && <span className="text-sm text-slate-600">{note}</span>}
    </div>
  );
}
