"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";

// Enrol / remove two-step login (authenticator app, e.g. Google Authenticator).
export function TwoFactor() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [required, setRequired] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/account/totp")
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.enabled);
        setRequired(!!d.required);
      });
  }, []);
  useEffect(load, [load]);

  async function post(body: object): Promise<Record<string, string> | null> {
    setMsg(null);
    const res = await fetch("/api/account/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: d.error || "ไม่สำเร็จ" });
      return null;
    }
    return d;
  }

  async function start() {
    const d = await post({ action: "setup" });
    if (d) setSetup({ secret: d.secret, qr: d.qr });
  }
  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ action: "enable", code })) {
      setSetup(null);
      setCode("");
      setMsg({ ok: true, text: "เปิดใช้การยืนยันตัวตน 2 ขั้นแล้ว ครั้งต่อไปที่เข้าสู่ระบบจะถามรหัสจากแอป" });
      // Reload so the admin gate in the layout lets the other pages through.
      window.location.reload();
    }
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ action: "disable", password })) {
      setPassword("");
      setMsg({ ok: true, text: "ปิดการยืนยันตัวตน 2 ขั้นแล้ว" });
      load();
    }
  }

  return (
    <Card className="mt-4">
      <div className="font-medium mb-1">ยืนยันตัวตน 2 ขั้น</div>
      {required && enabled === false && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          บัญชีผู้ดูแลระบบต้องเปิดใช้ก่อนจึงจะใช้หน้าอื่นได้
        </div>
      )}
      {enabled === null ? null : enabled ? (
        <form onSubmit={disable} className="grid gap-2">
          <div className="text-sm text-emerald-300">เปิดใช้อยู่ เข้าสู่ระบบต้องใช้รหัสจากแอปทุกครั้ง</div>
          <input type="password" className="field" placeholder="รหัสผ่านปัจจุบัน (เพื่อปิดใช้)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="rounded-lg px-3 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">ปิดการยืนยัน 2 ขั้น</button>
        </form>
      ) : setup ? (
        <form onSubmit={confirmCode} className="grid gap-2 text-sm">
          <div>1. เปิดแอป Google Authenticator (หรือแอป authenticator อื่น) แล้วสแกน QR นี้</div>
          <div className="w-fit rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.qr }} />
          <div className="text-slate-400">
            สแกนไม่ได้? ใส่รหัสนี้ในแอปแทน: <code className="break-all text-slate-200">{setup.secret}</code>
          </div>
          <div>2. กรอกรหัส 6 หลักที่แอปแสดง</div>
          <input className="field tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          <button className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">ยืนยันและเปิดใช้</button>
        </form>
      ) : (
        <div className="grid gap-2 text-sm">
          <div className="text-slate-400">นอกจากรหัสผ่าน จะต้องใช้รหัส 6 หลักจากแอปในโทรศัพท์ทุกครั้งที่เข้าสู่ระบบ</div>
          <button onClick={start} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
            เริ่มตั้งค่า
          </button>
        </div>
      )}
      {msg && <div className={`mt-2 text-sm ${msg.ok ? "text-emerald-300" : "text-rose-400"}`}>{msg.text}</div>}
    </Card>
  );
}
