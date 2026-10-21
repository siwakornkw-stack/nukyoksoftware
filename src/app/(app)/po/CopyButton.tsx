"use client";

import { useState } from "react";

// Copies a value (e.g. the PK number for Express's "อ้างถึงใบสั่งซื้อ").
export function CopyButton({ value, label = "คัดลอก" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers / non-HTTPS: fall back to a hidden textarea.
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <button type="button" onClick={copy} className="rounded-md px-2.5 py-1 text-xs font-medium bg-sky-500 hover:bg-sky-400 text-slate-900">
      {done ? "✓ คัดลอกแล้ว" : `📋 ${label}`}
    </button>
  );
}
