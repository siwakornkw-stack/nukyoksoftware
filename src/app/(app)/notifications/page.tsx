"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

interface Notification {
  NotificationId: string;
  Title: string;
  Message: string;
  IsRead: boolean;
  CreatedTime: string;
}

// Tell the sidebar bell to refetch its count.
const changed = () => window.dispatchEvent(new Event("notifications-changed"));

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(true);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications ?? []);
        setUnread(d.unread ?? 0);
      });
  }, []);

  useEffect(load, [load]);

  async function post(body: object) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
    changed();
  }

  const shown = onlyUnread ? items.filter((n) => !n.IsRead) : items;

  return (
    <div className="max-w-3xl">
      <PageHeader title="การแจ้งเตือน" subtitle={`ยังไม่อ่าน ${unread} รายการ`} />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setOnlyUnread(true)}
          className={`rounded-lg px-3 py-1.5 text-sm ${onlyUnread ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}
        >
          ยังไม่อ่าน
        </button>
        <button
          onClick={() => setOnlyUnread(false)}
          className={`rounded-lg px-3 py-1.5 text-sm ${!onlyUnread ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}
        >
          ทั้งหมด
        </button>
        {unread > 0 && (
          <button
            onClick={() => post({ action: "readAll" })}
            className="ml-auto rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium"
          >
            อ่านทั้งหมดแล้ว
          </button>
        )}
      </div>

      <Card>
        {shown.map((n) => (
          <div key={n.NotificationId} className="flex items-start justify-between gap-3 border-b border-slate-800/50 py-2.5 last:border-0">
            <div className="min-w-0">
              <div className="text-sm">
                {!n.IsRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-sky-400 align-middle" />}
                {n.Message}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{thDateTime(n.CreatedTime)}</div>
            </div>
            {!n.IsRead && (
              <button
                onClick={() => post({ action: "read", id: n.NotificationId })}
                className="shrink-0 rounded-md px-2 py-1 text-xs bg-slate-800/60 hover:bg-slate-700/60"
              >
                อ่านแล้ว
              </button>
            )}
          </div>
        ))}
        {!shown.length && <div className="py-8 text-center text-sm text-slate-500">ไม่มีการแจ้งเตือน</div>}
      </Card>
    </div>
  );
}
