import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { baht, num, thDateTime } from "@/lib/format";
import { getToday } from "@/lib/today";
import { getSession, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const modules = [
  {
    href: "/fleet",
    icon: "🚚",
    title: "กองรถ & การเงิน",
    desc: "ทะเบียนรถ, คนขับ, ค่างวด/ลูกหนี้, ภาษี-พรบ.-ประกัน, รายงานการเงิน และแจ้งเตือน LINE",
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/20",
  },
  {
    href: "/fuel",
    icon: "⛽",
    title: "ตรวจบิลน้ำมัน",
    desc: "รับบิลผ่าน LINE, อ่านบิลด้วย AI (Gemini), ตรวจจับบิลผิดปกติ และสรุปรายเดือน",
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
  },
  {
    href: "/debt",
    icon: "🧾",
    title: "หนี้ / วางบิล",
    desc: "อัปโหลด Excel ใบวางบิล/ใบแจ้งหนี้, แดชบอร์ดยอดค้าง/เกินกำหนด และรายงานอายุหนี้",
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/20",
  },
];

function Tile({ href, label, value, sub, alert }: { href: string; label: string; value: string; sub?: string; alert: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 transition-colors ${alert ? "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15" : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/40"}`}
    >
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${alert ? "text-rose-200" : "text-slate-200"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Link>
  );
}

// Home: what needs attention today (same numbers as the 08:00 LINE summary).
export default async function Home() {
  const [t, session] = await Promise.all([getToday(), getSession()]);
  const admin = !!session && isAdmin(session);
  const renewals = t.renewals.expired + t.renewals.due30;

  return (
    <div className="max-w-5xl">
      <PageHeader title="ภาพรวมระบบ" subtitle="สิ่งที่ต้องจัดการวันนี้" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Tile href="/fleet/insurance" label="ภาษี / พ.ร.บ. / ประกัน" value={`${num(renewals)} รายการ`} sub={`หมดอายุ ${t.renewals.expired} · ใกล้หมด 30 วัน ${t.renewals.due30}`} alert={t.renewals.expired > 0} />
        <Tile href="/fleet/installments?filter=overdue" label="ค่างวดเกินกำหนด" value={`${num(t.installments.overdue)} งวด`} sub={baht(t.installments.overdueAmount)} alert={t.installments.overdue > 0} />
        <Tile href="/debt/records" label="หนี้ลูกค้าเกินกำหนด" value={`${num(t.debt.overdue)} รายการ`} sub={baht(t.debt.overdueAmount)} alert={t.debt.overdue > 0} />
        <Tile href="/fuel" label="บิลน้ำมันน่าสงสัย (7 วัน)" value={`${num(t.fuelSuspect7d)} ใบ`} alert={t.fuelSuspect7d > 0} />
        <Tile href="/fleet/maintenance" label="น้ำมันเครื่องเกินระยะ" value={`${num(t.oilOverdue)} คัน`} alert={t.oilOverdue > 0} />
        <Tile href="/assets" label="สินทรัพย์เลยกำหนดคืน" value={`${num(t.loansOverdue)} ชิ้น`} alert={t.loansOverdue > 0} />
        {admin && (
          <Tile
            href="/notifications"
            label="Backup ฐานข้อมูล"
            value={!t.backup ? "ไม่มีรายงาน" : t.backup.stale ? "มีปัญหา" : "ปกติ"}
            sub={t.backup ? `${thDateTime(t.backup.at)}${t.backup.offsite ? " · Google Drive" : ""}` : undefined}
            alert={!t.backup || t.backup.stale}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`rounded-2xl border bg-gradient-to-br p-5 transition-transform hover:-translate-y-0.5 ${m.accent}`}
          >
            <div className="text-3xl">{m.icon}</div>
            <div className="mt-3 font-semibold">{m.title}</div>
            <div className="mt-1 text-sm text-slate-400">{m.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
