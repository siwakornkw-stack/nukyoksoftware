"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";
import { MIN_PASSWORD, ROLE_LABEL, ROLES } from "@/lib/users";

interface User {
  CustomerId: string;
  Username: string;
  Name: string | null;
  Role: string;
  Status: string;
  LatestLogin: string | null;
}

const EMPTY = { username: "", name: "", password: "", role: "staff" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    fetch("/api/users").then(async (r) => {
      if (r.status === 403) return setForbidden(true);
      const d = await r.json();
      setUsers(d.users ?? []);
    });
  }, []);

  useEffect(load, [load]);

  async function send(url: string, method: string, body: object): Promise<boolean> {
    setErr("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
    load();
    return res.ok;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await send("/api/users", "POST", form)) setForm(EMPTY);
  }

  function resetPassword(u: User) {
    const pw = prompt(`รหัสผ่านใหม่ของ ${u.Username} (อย่างน้อย ${MIN_PASSWORD} ตัว)`);
    if (pw) send(`/api/users/${u.CustomerId}`, "PATCH", { password: pw });
  }

  if (forbidden) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="ผู้ใช้งาน" />
        <Card>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="ผู้ใช้งาน" subtitle={`${users.length} บัญชี`} />

      <Card className="mb-4">
        <div className="font-medium mb-3">เพิ่มผู้ใช้</div>
        <form onSubmit={create} className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <input className="field" placeholder="ชื่อผู้ใช้ *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <input className="field" placeholder="ชื่อที่แสดง" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="password" className="field" placeholder={`รหัสผ่าน * (${MIN_PASSWORD}+)`} autoComplete="new-password" minLength={MIN_PASSWORD} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <button className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">เพิ่ม</button>
        </form>
        {err && <div className="mt-2 text-sm text-rose-400">{err}</div>}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">ชื่อผู้ใช้</th>
                <th className="py-2 pr-3">ชื่อ</th>
                <th className="py-2 pr-3">สิทธิ์</th>
                <th className="py-2 pr-3">เข้าระบบล่าสุด</th>
                <th className="py-2 pr-3">สถานะ</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.CustomerId} className={`border-b border-slate-800/50 ${u.Status !== "active" ? "opacity-50" : ""}`}>
                  <td className="py-2 pr-3">{u.Username}</td>
                  <td className="py-2 pr-3 text-slate-400">{u.Name || "-"}</td>
                  <td className="py-2 pr-3">
                    <select className="field py-1" value={u.Role} onChange={(e) => send(`/api/users/${u.CustomerId}`, "PATCH", { role: e.target.value })}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{u.LatestLogin ? thDateTime(u.LatestLogin) : "-"}</td>
                  <td className="py-2 pr-3">{u.Status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</td>
                  <td className="py-2 whitespace-nowrap">
                    <button onClick={() => resetPassword(u)} className="rounded-md px-2 py-1 text-xs bg-slate-800/60 hover:bg-slate-700/60 mr-1">
                      ตั้งรหัสใหม่
                    </button>
                    <button
                      onClick={() => send(`/api/users/${u.CustomerId}`, "PATCH", { status: u.Status === "active" ? "inactive" : "active" })}
                      className="rounded-md px-2 py-1 text-xs bg-slate-800/60 hover:bg-slate-700/60"
                    >
                      {u.Status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
