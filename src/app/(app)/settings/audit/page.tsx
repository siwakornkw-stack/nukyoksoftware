"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

type Json = Record<string, unknown> | null;
interface Log {
  AuditLogId: string;
  Entity: string;
  EntityId: string;
  Action: string;
  Before: Json;
  After: Json;
  Username: string | null;
  CreatedAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  pay: "บันทึกชำระ",
  status: "เปลี่ยนสถานะ",
  upload: "อัปโหลด",
  "set-current": "ตั้งเป็นเวอร์ชันปัจจุบัน",
  "generate-installments": "สร้างตารางค่างวด",
  deactivate: "เลิกใช้",
};
// Bookkeeping columns that change on every edit and say nothing to a reader.
const NOISE = new Set(["UpdatedAt", "UpdatedByUsername", "UpdatedTime", "CreatedAt", "CreatedByUsername"]);

const show = (v: unknown) => (v == null || v === "" ? "-" : typeof v === "object" ? JSON.stringify(v) : String(v));

function changes(before: Json, after: Json): [string, unknown, unknown][] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((k) => !NOISE.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    .map((k) => [k, before?.[k], after?.[k]]);
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [entity, setEntity] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/audit${entity ? `?entity=${encodeURIComponent(entity)}` : ""}`).then(async (r) => {
      if (r.status === 403) return setForbidden(true);
      const d = await r.json();
      setLogs(d.logs ?? []);
      setEntities(d.entities ?? []);
    });
  }, [entity]);

  useEffect(load, [load]);

  if (forbidden) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="ประวัติการแก้ไข" />
        <Card>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="ประวัติการแก้ไข" subtitle="ใครแก้อะไร เมื่อไร (ข้อมูลเงินและบัญชีผู้ใช้) · 300 รายการล่าสุด" />
      <div className="mb-4">
        <select className="field" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">ทุกประเภท</option>
          {entities.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">เวลา</th>
                <th className="py-2 pr-3">ผู้ใช้</th>
                <th className="py-2 pr-3">ข้อมูล</th>
                <th className="py-2 pr-3">การกระทำ</th>
                <th className="py-2">การเปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const diff = changes(l.Before, l.After);
                return (
                  <tr key={l.AuditLogId} className="border-b border-slate-800/50 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{thDateTime(l.CreatedAt)}</td>
                    <td className="py-2 pr-3">{l.Username ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {l.Entity}
                      <div className="text-xs text-slate-500 break-all">{l.EntityId}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{ACTION_LABEL[l.Action] ?? l.Action}</td>
                    <td className="py-2 text-xs">
                      {l.Action === "delete" || l.Action === "create" ? (
                        <span className="text-slate-400 break-all">{show(l.Action === "delete" ? l.Before : l.After)}</span>
                      ) : (
                        diff.map(([k, a, b]) => (
                          <div key={k}>
                            <span className="text-slate-400">{k}:</span> <span className="text-rose-300 line-through">{show(a)}</span>{" "}
                            → <span className="text-emerald-300">{show(b)}</span>
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
              {!logs.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">ยังไม่มีประวัติ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
