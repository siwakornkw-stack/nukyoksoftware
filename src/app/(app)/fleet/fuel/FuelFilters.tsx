import Link from "next/link";
import { Card } from "@/components/ui";
import { addMonths } from "@/lib/fleet/fuel-report";

export function FuelFilters({
  action,
  from,
  to,
  vehicle,
  receiver,
  q,
  latestMonth,
  earliestMonth,
  vehicles,
  receivers,
}: {
  action: string;
  from: string;
  to: string;
  vehicle?: string;
  receiver?: string;
  q?: string;
  latestMonth: string;
  earliestMonth: string;
  vehicles: { id: string; plate: string; model: string }[];
  receivers: string[];
}) {
  const keep = new URLSearchParams();
  if (vehicle) keep.set("vehicle", vehicle);
  if (receiver) keep.set("receiver", receiver);
  const preset = (label: string, f: string, t: string) => {
    const p = new URLSearchParams(keep);
    p.set("from", f);
    p.set("to", t);
    const active = f === from && t === to;
    return (
      <Link
        key={label}
        href={`${action}?${p}`}
        className={`rounded-lg px-2.5 py-1 text-xs border ${
          active ? "bg-sky-500/20 border-sky-500/40 text-sky-200" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <Card className="mb-4">
      <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">ตั้งแต่เดือน</span>
          <input type="month" name="from" defaultValue={from} className="field" />
        </label>
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">ถึงเดือน</span>
          <input type="month" name="to" defaultValue={to} className="field" />
        </label>
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">รถ / เครื่องจักร</span>
          <select name="vehicle" defaultValue={vehicle ?? ""} className="field">
            <option value="">ทั้งหมด</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
                {v.model && v.model !== v.plate ? ` - ${v.model}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-400 mb-1">ผู้รับน้ำมัน</span>
          <select name="receiver" defaultValue={receiver ?? ""} className="field">
            <option value="">ทั้งหมด</option>
            {receivers.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {q !== undefined ? (
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">ค้นหา</span>
            <input name="q" defaultValue={q} placeholder="เลขใบกำกับ / รายการ" className="field" />
          </label>
        ) : (
          <div className="hidden lg:block" />
        )}
        <button className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">แสดง</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {preset("เดือนล่าสุด", latestMonth, latestMonth)}
        {preset("3 เดือน", addMonths(latestMonth, -2), latestMonth)}
        {preset("6 เดือน", addMonths(latestMonth, -5), latestMonth)}
        {preset("12 เดือน", addMonths(latestMonth, -11), latestMonth)}
        {preset("ทั้งหมด", earliestMonth, latestMonth)}
      </div>
    </Card>
  );
}
