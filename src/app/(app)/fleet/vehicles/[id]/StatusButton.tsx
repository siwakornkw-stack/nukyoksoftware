"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The API soft-deletes (Status -> "inactive") so child records keep their FK.
// Turning it back on is a plain PATCH, which is why this is one toggle rather
// than a delete button that leaves the vehicle unreachable.
export function StatusButton({ vehicleId, active }: { vehicleId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    if (active && !confirm("ปิดการใช้งานรถคันนี้? ประวัติและเอกสารยังอยู่ครบ")) return;
    setBusy(true);
    setErr("");
    const res = active
      ? await fetch(`/api/fleet/vehicles/${vehicleId}`, { method: "DELETE" })
      : await fetch(`/api/fleet/vehicles/${vehicleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "ทำรายการไม่สำเร็จ");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-rose-400">{err}</span>}
      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${
          active
            ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
            : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
        }`}
      >
        {busy ? "กำลังบันทึก..." : active ? "ปิดการใช้งาน" : "เปิดใช้งาน"}
      </button>
    </div>
  );
}
