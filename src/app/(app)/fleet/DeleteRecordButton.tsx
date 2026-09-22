"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// type = record-types key ("gasoline", "insurance", "compulsory", "tax")
export function DeleteRecordButton({ type, id, what }: { type: string; id: string; what: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`ลบ${what}นี้?`)) return;
    setBusy(true);
    const res = await fetch(`/api/fleet/records/${type}/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("ลบไม่สำเร็จ");
  }

  return (
    <button type="button" onClick={remove} disabled={busy} className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50">
      {busy ? "..." : "ลบ"}
    </button>
  );
}
