import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { baht, num, thDateTime } from "@/lib/format";
import { getToday } from "@/lib/today";
import { getSession, isAdmin } from "@/lib/auth";
import { groups } from "./nav";

export const dynamic = "force-dynamic";

// Literal class strings so Tailwind picks them up.
const accents: Record<string, { card: string; badge: string; hover: string }> = {
  "กองรถ & การเงิน": { card: "from-sky-500/15 border-sky-500/20", badge: "from-sky-400 to-sky-600", hover: "hover:border-sky-400/40 hover:bg-sky-500/10" },
  "น้ำมัน": { card: "from-orange-500/15 border-orange-500/20", badge: "from-orange-400 to-orange-600", hover: "hover:border-orange-400/40 hover:bg-orange-500/10" },
  "พ.ร.บ. & ประกัน": { card: "from-emerald-500/15 border-emerald-500/20", badge: "from-emerald-400 to-emerald-600", hover: "hover:border-emerald-400/40 hover:bg-emerald-500/10" },
  "บิลน้ำมัน": { card: "from-amber-500/15 border-amber-500/20", badge: "from-amber-400 to-amber-600", hover: "hover:border-amber-400/40 hover:bg-amber-500/10" },
  "สินทรัพย์": { card: "from-teal-500/15 border-teal-500/20", badge: "from-teal-400 to-teal-600", hover: "hover:border-teal-400/40 hover:bg-teal-500/10" },
  "หนี้ / วางบิล": { card: "from-violet-500/15 border-violet-500/20", badge: "from-violet-400 to-violet-600", hover: "hover:border-violet-400/40 hover:bg-violet-500/10" },
  "ตั้งค่า": { card: "from-slate-500/15 border-slate-500/20", badge: "from-slate-400 to-slate-600", hover: "hover:border-slate-400/40 hover:bg-slate-500/10" },
};

function Tile({ href, icon, label, value, sub, alert }: { href: string; icon: string; label: string; value: string; sub?: string; alert: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
        alert
          ? "border-rose-500/30 bg-gradient-to-br from-rose-500/15 to-rose-500/5 hover:border-rose-400/50"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`grid h-9 w-9 place-items-center rounded-xl text-lg ${alert ? "bg-rose-500/20" : "bg-slate-800/80"}`}>{icon}</div>
        <span
          className={`mt-1 h-2 w-2 rounded-full ${alert ? "bg-rose-400 animate-pulse" : "bg-emerald-400/70"}`}
        />
      </div>
      <div className="mt-3 text-xs text-slate-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tracking-tight ${alert ? "text-rose-100" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-slate-500">{sub}</div>}
    </Link>
  );
}

// Home: what needs attention today (same numbers as the 08:00 LINE summary),
// then every sidebar category as a menu.
export default async function Home() {
  const [t, session] = await Promise.all([getToday(), getSession()]);
  const admin = !!session && isAdmin(session);
  const renewals = t.renewals.expired + t.renewals.due30;
  const categories = groups
    .filter((g) => g.title)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || admin) }));

  return (
    <div className="max-w-6xl">
      <PageHeader title="ภาพรวมระบบ" subtitle="สิ่งที่ต้องจัดการวันนี้" />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile href="/fleet/insurance" icon="🛡️" label="ภาษี / พ.ร.บ. / ประกัน" value={`${num(renewals)} รายการ`} sub={`หมดอายุ ${t.renewals.expired} · ใกล้หมด 30 วัน ${t.renewals.due30}`} alert={t.renewals.expired > 0} />
        <Tile href="/fleet/installments?filter=overdue" icon="💳" label="ค่างวดเกินกำหนด" value={`${num(t.installments.overdue)} งวด`} sub={baht(t.installments.overdueAmount)} alert={t.installments.overdue > 0} />
        <Tile href="/debt/records" icon="🧾" label="หนี้ลูกค้าเกินกำหนด" value={`${num(t.debt.overdue)} รายการ`} sub={baht(t.debt.overdueAmount)} alert={t.debt.overdue > 0} />
        <Tile href="/fuel" icon="⛽" label="บิลน้ำมันน่าสงสัย (7 วัน)" value={`${num(t.fuelSuspect7d)} ใบ`} alert={t.fuelSuspect7d > 0} />
        <Tile href="/fleet/maintenance" icon="🔧" label="น้ำมันเครื่องเกินระยะ" value={`${num(t.oilOverdue)} คัน`} alert={t.oilOverdue > 0} />
        <Tile href="/assets" icon="📦" label="สินทรัพย์เลยกำหนดคืน" value={`${num(t.loansOverdue)} ชิ้น`} alert={t.loansOverdue > 0} />
        {admin && (
          <Tile
            href="/notifications"
            icon="💾"
            label="Backup ฐานข้อมูล"
            value={!t.backup ? "ไม่มีรายงาน" : t.backup.stale ? "มีปัญหา" : "ปกติ"}
            sub={t.backup ? `${thDateTime(t.backup.at)}${t.backup.offsite ? " · Google Drive" : ""}` : undefined}
            alert={!t.backup || t.backup.stale}
          />
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-300">เมนูตามหมวด</h2>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((g) => {
          const a = accents[g.title!] ?? accents["ตั้งค่า"];
          return (
            <section key={g.title} className={`rounded-2xl border bg-gradient-to-br to-transparent p-4 ${a.card}`}>
              <div className="mb-3 flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-xl shadow-lg ${a.badge}`}>{g.icon}</div>
                <div>
                  <div className="font-semibold">{g.title}</div>
                  <div className="text-xs text-slate-500">{g.items.length} เมนู</div>
                </div>
              </div>
              <div className="grid gap-1.5">
                {g.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={`flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-300 transition-colors hover:text-white ${a.hover}`}
                  >
                    <span className="text-base">{i.icon}</span>
                    <span className="flex-1">{i.label}</span>
                    <span className="text-slate-600">›</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
