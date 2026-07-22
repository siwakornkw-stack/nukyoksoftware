// Summary figures are whole baht and read better without ".00", but per-item
// amounts (fuel, repairs, premiums) carry satang and rounding those to the
// nearest baht made a row disagree with the receipt it was typed from. Show
// the satang only when there are any.
export function baht(n: number): string {
  const digits = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function num(n: number, digits = 0): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: digits });
}

export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + " ลบ.";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return num(n);
}

// ISO "YYYY-MM-DD" -> "DD/MM/พ.ศ."
export function thDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${Number(y) + 543}`;
}

// Date | string -> "DD/MM/พ.ศ. HH:MM"
export function thDateTime(v: Date | string | null | undefined): string {
  if (!v) return "-";
  const dt = v instanceof Date ? v : new Date(v);
  if (isNaN(dt.getTime())) return String(v);
  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const y = dt.getFullYear() + 543;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export const STATUS_STYLE: Record<string, string> = {
  รอวางบิล: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  วางบิลแล้ว: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  เปิดบิลแล้ว: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  ชำระแล้ว: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  ยกเลิก: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};
