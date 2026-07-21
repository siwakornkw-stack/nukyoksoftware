"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "เข้าสู่ระบบไม่สำเร็จ");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 grid place-items-center font-bold text-slate-900">
            ท
          </div>
          <div>
            <div className="font-semibold">เทวาวณิชกิจ</div>
            <div className="text-xs text-slate-400">เข้าสู่ระบบ</div>
          </div>
        </div>

        <label className="block text-sm mb-1 text-slate-300">ชื่อผู้ใช้</label>
        <input
          className="field mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <label className="block text-sm mb-1 text-slate-300">รหัสผ่าน</label>
        <input
          type="password"
          className="field mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="mb-3 text-sm text-rose-400">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-900 font-medium py-2 transition-colors"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
