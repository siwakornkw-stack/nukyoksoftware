import Link from "next/link";
import { PageHeader } from "@/components/ui";

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

export default function Home() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="ภาพรวมระบบ"
        subtitle="เทวาวณิชกิจ — ระบบรวม 3 โมดูลในโปรแกรมเดียว"
      />
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
