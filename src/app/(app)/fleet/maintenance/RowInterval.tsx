"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin: this vehicle's own oil-change interval (engine hours for machinery).
// Empty = use the default.
export function RowInterval({ vehicleId, value, custom }: { vehicleId: string; value: number; custom: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(custom ? String(value) : "");
  const [err, setErr] = useState(false);

  async function save() {
    if ((custom ? String(value) : "") === v) return;
    const res = await fetch("/api/fleet/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, interval: v.trim() === "" ? null : Number(v) }),
    });
    setErr(!res.ok);
    if (res.ok) router.refresh();
  }

  return (
    <input
      type="number"
      min={50}
      className={`field w-24 py-0.5 text-right ${err ? "border-rose-500" : ""}`}
      placeholder={value.toLocaleString()}
      title="ว่าง = ใช้ค่าเริ่มต้น"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
