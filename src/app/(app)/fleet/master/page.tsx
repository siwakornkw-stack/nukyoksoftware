"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { MASTER_TYPES, getMasterType } from "@/lib/fleet/master-types";

interface Row {
  Name: string;
  MobileNo?: string | null;
  LicenseNo?: string | null;
  LineUserId?: string | null;
  [k: string]: unknown;
}

const EXTRA_LABELS: Record<string, string> = {
  MobileNo: "เบอร์โทร",
  LicenseNo: "เลขใบขับขี่",
  LineUserId: "LINE User ID",
};

export default function MasterPage() {
  const [active, setActive] = useState(MASTER_TYPES[0].key);
  const def = getMasterType(active)!;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    fetch(`/api/fleet/master/${active}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, [active]);

  useEffect(load, [load]);

  useEffect(() => {
    setForm({});
    setErr("");
  }, [active]);

  async function add() {
    setSaving(true);
    setErr("");
    const body: Record<string, string> = { Name: form.Name ?? "" };
    for (const f of def.extraFields) body[f] = form[f] ?? "";
    const res = await fetch(`/api/fleet/master/${active}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setErr(d.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setForm({});
    load();
  }

  async function remove(id: string) {
    setErr("");
    const res = await fetch(`/api/fleet/master/${active}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "ลบไม่สำเร็จ");
      return;
    }
    load();
  }

  const idOf = (r: Row) => String(r[def.idField]);

  return (
    <div className="max-w-5xl">
      <PageHeader title="ข้อมูลหลัก" subtitle="จัดการรายการอ้างอิงของระบบยานพาหนะ" />

      <div className="flex flex-wrap gap-2 mb-4">
        {MASTER_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active === t.key ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="font-medium mb-2">เพิ่ม{def.label}</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-slate-400 mb-1">ชื่อ</span>
            <input
              className="field"
              value={form.Name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))}
            />
          </label>
          {def.extraFields.map((f) => (
            <label key={f} className="text-sm">
              <span className="block text-slate-400 mb-1">{EXTRA_LABELS[f] ?? f}</span>
              <input
                className="field"
                value={form[f] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
              />
            </label>
          ))}
          <button
            onClick={add}
            disabled={saving || !(form.Name ?? "").trim()}
            className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50"
          >
            เพิ่ม
          </button>
          {err && <span className="text-sm text-rose-400">{err}</span>}
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">ชื่อ</th>
                  {def.extraFields.map((f) => (
                    <th key={f} className="py-2 pr-3">
                      {EXTRA_LABELS[f] ?? f}
                    </th>
                  ))}
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={idOf(r)} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3">{r.Name}</td>
                    {def.extraFields.map((f) => (
                      <td key={f} className="py-2 pr-3 text-slate-400">
                        {(r[f] as string) || "-"}
                      </td>
                    ))}
                    <td className="py-2 text-right">
                      <button
                        onClick={() => remove(idOf(r))}
                        className="rounded-md px-2 py-1 text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={2 + def.extraFields.length} className="py-8 text-center text-slate-500">
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
