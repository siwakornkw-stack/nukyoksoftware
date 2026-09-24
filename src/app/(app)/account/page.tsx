"use client";

import { useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { MIN_PASSWORD } from "@/lib/users";
import { TwoFactor } from "./TwoFactor";

export default function AccountPage() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setMsg({ ok: false, text: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: form.current, next: form.next }),
    }).finally(() => setBusy(false));
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setForm({ current: "", next: "", confirm: "" });
      setMsg({ ok: true, text: "เปลี่ยนรหัสผ่านแล้ว" });
    } else {
      setMsg({ ok: false, text: d.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
    }
  }

  return (
    <div className="max-w-md">
      <PageHeader title="บัญชีของฉัน" subtitle="รหัสผ่านและการยืนยันตัวตน 2 ขั้น" />
      <Card>
        <form onSubmit={submit} className="grid gap-2">
          <input type="password" className="field" placeholder="รหัสผ่านปัจจุบัน" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required />
          <input type="password" className="field" placeholder={`รหัสผ่านใหม่ (อย่างน้อย ${MIN_PASSWORD} ตัว)`} autoComplete="new-password" minLength={MIN_PASSWORD} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required />
          <input type="password" className="field" placeholder="ยืนยันรหัสผ่านใหม่" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          <button disabled={busy} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50">
            เปลี่ยนรหัสผ่าน
          </button>
          {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-rose-400"}`}>{msg.text}</div>}
        </form>
      </Card>
      <TwoFactor />
    </div>
  );
}
