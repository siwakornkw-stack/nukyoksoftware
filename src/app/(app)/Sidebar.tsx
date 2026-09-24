"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const groups: { title: string | null; items: { href: string; label: string; icon: string; adminOnly?: boolean }[] }[] = [
  {
    title: null,
    items: [
      { href: "/", label: "ภาพรวม", icon: "🏠" },
      { href: "/notifications", label: "การแจ้งเตือน", icon: "🔔" },
      { href: "/help", label: "วิธีใช้งาน", icon: "📖" },
    ],
  },
  {
    title: "กองรถ & การเงิน",
    items: [
      { href: "/fleet", label: "แดชบอร์ด", icon: "📊" },
      { href: "/fleet/vehicles", label: "ทะเบียนรถ", icon: "🚚" },
      { href: "/fleet/drivers", label: "คนขับ & งานวิ่ง", icon: "🧑‍✈️" },
      { href: "/fleet/installments", label: "ค่างวด / ลูกหนี้", icon: "💳" },
      { href: "/fleet/import", label: "นำเข้าข้อมูล", icon: "⬆️" },
      { href: "/fleet/reports", label: "รายงาน", icon: "📈" },
      { href: "/fleet/reports/vehicles", label: "กำไร/ต้นทุนรายคัน", icon: "⚖️" },
      { href: "/fleet/master", label: "ข้อมูลหลัก", icon: "🗂️" },
    ],
  },
  {
    title: "น้ำมัน",
    items: [
      { href: "/fleet/fuel", label: "รายงานน้ำมัน", icon: "📈" },
      { href: "/fleet/fuel/records", label: "รายละเอียดน้ำมัน", icon: "🛢️" },
      { href: "/fleet/fuel/import", label: "นำเข้าค่าน้ำมัน", icon: "⬆️" },
    ],
  },
  {
    title: "พ.ร.บ. & ประกัน",
    items: [
      { href: "/fleet/insurance", label: "รายงาน พ.ร.บ./ประกัน", icon: "🛡️" },
      { href: "/fleet/insurance/records", label: "รายละเอียด", icon: "📄" },
      { href: "/fleet/insurance/import", label: "นำเข้าตารางประกัน", icon: "⬆️" },
    ],
  },
  {
    title: "บิลน้ำมัน",
    items: [
      { href: "/fuel", label: "ตรวจบิลน้ำมัน", icon: "⛽" },
      { href: "/fuel/reconcile", label: "เทียบกับบัญชีออฟฟิศ", icon: "🔍" },
    ],
  },
  {
    title: "สินทรัพย์",
    items: [{ href: "/assets", label: "ยืม-คืนสินทรัพย์", icon: "📦" }],
  },
  {
    title: "หนี้ / วางบิล",
    items: [
      { href: "/debt", label: "แดชบอร์ดหนี้", icon: "🧾" },
      { href: "/debt/records", label: "รายการหนี้", icon: "📋" },
      { href: "/debt/upload", label: "อัปโหลด Excel", icon: "⬆️" },
    ],
  },
  {
    title: "ตั้งค่า",
    items: [
      { href: "/account", label: "บัญชีของฉัน", icon: "🔑" },
      { href: "/settings/users", label: "ผู้ใช้งาน", icon: "👥", adminOnly: true },
      { href: "/settings/audit", label: "ประวัติการแก้ไข", icon: "🕘", adminOnly: true },
    ],
  },
];

const ALL_HREFS = groups.flatMap((g) => g.items.map((i) => i.href));

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// Only the most specific match lights up. Plain prefix matching would mark the
// /fleet dashboard active on every /fleet/* page as well.
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (matches(pathname, href) && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 grid place-items-center font-bold text-slate-900">
        ท
      </div>
      <div className="leading-tight">
        <div className="font-semibold text-sm">เทวาวณิชกิจ</div>
        <div className="text-[11px] text-slate-400">ระบบบริหารจัดการ</div>
      </div>
    </div>
  );
}

function NavLinks({ pathname, onNavigate, unread, role }: { pathname: string; onNavigate?: () => void; unread: number; role?: string }) {
  const current = activeHref(pathname);
  return (
    <nav className="flex flex-col gap-4 overflow-y-auto">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.title && (
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {g.title}
            </div>
          )}
          {g.items.filter((n) => !n.adminOnly || role === "admin").map((n) => {
            const active = n.href === current;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-slate-800/80 text-white"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <span className="text-base">{n.icon}</span>
                {n.label}
                {n.href === "/notifications" && unread > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserBlock({ userName, role }: { userName: string; role?: string }) {
  return (
    <div className="px-2">
      <div className="text-sm font-medium truncate">{userName}</div>
      <div className="text-[11px] text-slate-500 mb-2">{role || "member"}</div>
      <a
        href="/api/auth/logout"
        className="block text-center rounded-lg px-3 py-1.5 text-xs bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
      >
        ออกจากระบบ
      </a>
    </div>
  );
}

export function Sidebar({ userName, role }: { userName: string; role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  const [unread, setUnread] = useState(0);

  // Layouts persist across client navigation, so refetch the count on every
  // page change and whenever the notifications page marks something read.
  useEffect(() => {
    const refresh = () =>
      fetch("/api/notifications?count=1")
        .then((r) => (r.ok ? r.json() : { unread: 0 }))
        .then((d) => setUnread(d.unread ?? 0))
        .catch(() => {});
    refresh();
    window.addEventListener("notifications-changed", refresh);
    return () => window.removeEventListener("notifications-changed", refresh);
  }, [pathname]);

  // Below md the aside is hidden, so without this drawer a phone has no way to
  // reach any module or to log out. Reset it during render (not in an effect)
  // so back/forward navigation never leaves it hanging over the new page.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  return (
    <>
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-1 p-4 border-r border-slate-800/60">
        <div className="mb-5 px-2">
          <Brand />
        </div>
        <NavLinks pathname={pathname} unread={unread} role={role} />
        <div className="mt-auto pt-4 border-t border-slate-800/60">
          <UserBlock userName={userName} role={role} />
        </div>
      </aside>

      <header className="md:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-950/95 px-4 py-2 backdrop-blur">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="rounded-lg px-3 py-2 text-lg bg-slate-800/60 hover:bg-slate-700/60"
        >
          ☰
        </button>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full bg-slate-950/70"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-1 border-r border-slate-800/60 bg-slate-950 p-4">
            <div className="mb-5 flex items-start justify-between px-2">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิดเมนู"
                className="rounded-lg px-2 py-1 text-sm bg-slate-800/60 hover:bg-slate-700/60"
              >
                ✕
              </button>
            </div>
            <NavLinks pathname={pathname} unread={unread} role={role} onNavigate={() => setOpen(false)} />
            <div className="mt-auto pt-4 border-t border-slate-800/60">
              <UserBlock userName={userName} role={role} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
