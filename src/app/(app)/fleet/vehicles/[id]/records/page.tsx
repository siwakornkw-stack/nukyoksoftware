"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { baht, thDate } from "@/lib/format";
import { RECORD_TYPES, getRecordType, type FieldSpec } from "@/lib/fleet/record-types";
import { getMasterType } from "@/lib/fleet/master-types";

type Row = Record<string, unknown>;
interface Opt {
  id: string;
  name: string;
}

function fmtCell(f: FieldSpec, v: unknown, options: Record<string, Opt[]>): string {
  if (v == null || v === "") return "-";
  if (f.type === "select") {
    const list = f.master ? options[f.master] ?? [] : [];
    return list.find((o) => o.id === String(v))?.name ?? "-";
  }
  if (f.type === "money") return baht(Number(v));
  if (f.type === "number") return String(v);
  if (f.type === "date") return thDate(new Date(String(v)).toISOString());
  return String(v);
}

export default function VehicleRecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState(RECORD_TYPES[0].key);
  const def = useMemo(() => getRecordType(tab)!, [tab]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [options, setOptions] = useState<Record<string, Opt[]>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadErr("");
    fetch(`/api/fleet/records/${tab}?vehicleId=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        // A 401/404 also answers with JSON, so without this check an expired
        // session reads as "no records yet" and the page quietly lies.
        if (!r.ok) {
          setRows([]);
          setLoadErr(
            r.status === 401
              ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
              : d.error || "โหลดรายการไม่สำเร็จ"
          );
          return;
        }
        setRows(Array.isArray(d.rows) ? d.rows : []);
      })
      .catch(() => setLoadErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => setLoading(false));
  }, [tab, id]);

  useEffect(load, [load]);

  // Dropdown fields read their choices from master data. Fetch each list the
  // active tab asks for, once per master type.
  useEffect(() => {
    for (const f of def.fields) {
      if (f.type !== "select" || !f.master) continue;
      const masterKey = f.master;
      const masterDef = getMasterType(masterKey);
      if (!masterDef) continue;
      fetch(`/api/fleet/master/${masterKey}`)
        .then((r) => (r.ok ? r.json() : { rows: [] }))
        .then((d) =>
          setOptions((prev) => ({
            ...prev,
            [masterKey]: (d.rows ?? []).map((row: Record<string, unknown>) => ({
              id: String(row[masterDef.idField]),
              name: String(row.Name ?? ""),
            })),
          }))
        )
        .catch(() => {});
    }
  }, [def]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    fd.set("vehicleId", id);
    const res = await fetch(`/api/fleet/records/${tab}`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      formRef.current?.reset();
      load();
    } else {
      setMsg(d.error || "บันทึกไม่สำเร็จ");
    }
  }

  async function remove(rowId: string) {
    if (!confirm("ลบรายการนี้?")) return;
    const res = await fetch(`/api/fleet/records/${tab}/${rowId}`, { method: "DELETE" });
    if (res.ok) load();
    else setMsg("ลบไม่สำเร็จ");
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="ประวัติรถ / เอกสาร"
        subtitle="ภาษี, พ.ร.บ., ประกัน, ยาง, อุบัติเหตุ, ซ่อม, น้ำมัน, เปลี่ยนถ่าย, รายรับ"
        action={
          <Link
            href={`/fleet/vehicles/${id}`}
            className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60"
          >
            กลับหน้ารถ
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {RECORD_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.key ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="font-medium mb-3">เพิ่ม{def.label}</div>
        <form ref={formRef} onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {def.fields.map((f) => (
            <label key={f.name} className="text-sm">
              <span className="block text-slate-400 mb-1">
                {f.label}
                {f.optional && <span className="text-slate-600"> (ไม่บังคับ)</span>}
              </span>
              {f.type === "select" ? (
                <select name={f.name} required={!f.optional} className="field w-full" defaultValue="">
                  <option value="">-</option>
                  {(f.master ? options[f.master] ?? [] : []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : f.type === "file" ? (
                <input type="file" name={f.name} className="field w-full text-slate-300" />
              ) : (
                <input
                  type={f.type === "date" ? "date" : f.type === "number" || f.type === "money" ? "number" : "text"}
                  step={f.type === "money" ? "0.01" : undefined}
                  name={f.name}
                  required={!f.optional}
                  className="field w-full"
                />
              )}
            </label>
          ))}
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            {msg && <span className="text-sm text-rose-300">{msg}</span>}
          </div>
        </form>
      </Card>

      <Card>
        <div className="font-medium mb-3">รายการ{def.label}</div>
        {loadErr && <div className="mb-3 text-sm text-rose-400">{loadErr}</div>}
        {loading ? (
          <div className="py-8 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  {def.fields.map((f) => (
                    <th key={f.name} className="py-2 pr-3 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowId = String(r[def.idField]);
                  return (
                    <tr key={rowId} className="border-b border-slate-800/50">
                      {def.fields.map((f) => (
                        <td key={f.name} className="py-2 pr-3 whitespace-nowrap">
                          {f.type === "file" ? (
                            r[f.name] ? (
                              <a
                                href={String(r[f.name])}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-300 hover:underline"
                              >
                                เปิดไฟล์
                              </a>
                            ) : (
                              "-"
                            )
                          ) : (
                            fmtCell(f, r[f.name], options)
                          )}
                        </td>
                      ))}
                      <td className="py-2 text-right">
                        <button
                          onClick={() => remove(rowId)}
                          className="rounded-md px-2 py-1 text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && !loadErr && (
                  <tr>
                    <td colSpan={def.fields.length + 1} className="py-8 text-center text-slate-500">
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
