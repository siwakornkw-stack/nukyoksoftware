"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin: one vehicle's monthly budget. Empty = no budget.
export function RowBudget({ vehicleId, value }: { vehicleId: string; value: number | null }) {
  const router = useRouter();
  const initial = value == null ? "" : String(value);
  const [v, setV] = useState(initial);
  const [err, setErr] = useState(false);

  async function save() {
    if (v.trim() === initial) return;
    const res = await fetch("/api/fleet/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, budget: v.trim() === "" ? null : Number(v) }),
    });
    setErr(!res.ok);
    if (res.ok) router.refresh();
  }

  return (
    <input
      type="number"
      min={1}
      className={`field w-28 py-0.5 text-right ${err ? "border-rose-500" : ""}`}
      placeholder="ไม่ตั้งงบ"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
