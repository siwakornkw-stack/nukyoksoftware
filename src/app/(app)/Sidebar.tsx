"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const groups: { title: string | null; items: { href: string; label: string; icon: string }[] }[] = [
  {
    title: null,
    items: [
      { href: "/", label: "ภาพรวม", icon: "🏠" },
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

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
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
          {g.items.map((n) => {
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
        <NavLinks pathname={pathname} />
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
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-auto pt-4 border-t border-slate-800/60">
              <UserBlock userName={userName} role={role} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
