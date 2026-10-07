import Link from "next/link";

// The Excel import and the bill-photo import are separate pages so nobody
// drops a photo on the Excel form or the other way round.
const TABS = [
  { href: "/fleet/fuel/import", label: "📄 ไฟล์ Excel ประจำเดือน" },
  { href: "/fleet/fuel/import/bills", label: "🧾 รูปบิลน้ำมัน" },
];

export function ImportTabs({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            t.href === active ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
