"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups: { title: string | null; items: { href: string; label: string; icon: string }[] }[] = [
  { title: null, items: [{ href: "/", label: "ภาพรวม", icon: "🏠" }] },
  {
    title: "กองรถ & การเงิน",
    items: [
      { href: "/fleet", label: "แดชบอร์ด", icon: "📊" },
      { href: "/fleet/vehicles", label: "ทะเบียนรถ", icon: "🚚" },
      { href: "/fleet/drivers", label: "คนขับ & งานวิ่ง", icon: "🧑‍✈️" },
      { href: "/fleet/installments", label: "ค่างวด / ลูกหนี้", icon: "💳" },
      { href: "/fleet/import", label: "นำเข้าข้อมูล", icon: "⬆️" },
      { href: "/fleet/reports", label: "รายงาน", icon: "📈" },
      { href: "/fleet/master", label: "ข้อมูลหลัก", icon: "🗂️" },
    ],
  },
  {
    title: "บิลน้ำมัน",
    items: [{ href: "/fuel", label: "ตรวจบิลน้ำมัน", icon: "⛽" }],
  },
  {
    title: "หนี้ / วางบิล",
    items: [
      { href: "/debt", label: "แดชบอร์ดหนี้", icon: "🧾" },
      { href: "/debt/records", label: "รายการหนี้", icon: "📋" },
      { href: "/debt/upload", label: "อัปโหลด Excel", icon: "⬆️" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ userName, role }: { userName: string; role?: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col gap-1 p-4 border-r border-slate-800/60">
      <div className="mb-5 px-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 grid place-items-center font-bold text-slate-900">
            ท
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">เทวาวณิชกิจ</div>
            <div className="text-[11px] text-slate-400">ระบบบริหารจัดการ</div>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-4 overflow-y-auto">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {g.title && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {g.title}
              </div>
            )}
            {g.items.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-slate-800/80 text-white"
                      : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  <span className="text-base">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-800/60 px-2">
        <div className="text-sm font-medium truncate">{userName}</div>
        <div className="text-[11px] text-slate-500 mb-2">{role || "member"}</div>
        <a
          href="/api/auth/logout"
          className="block text-center rounded-lg px-3 py-1.5 text-xs bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
        >
          ออกจากระบบ
        </a>
      </div>
    </aside>
  );
}
