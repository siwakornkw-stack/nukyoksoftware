import { NextResponse } from "next/server";
import { opsAlert, saveBackupStatus } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";

// Reports from outside the web process (Bearer CRON_SECRET):
//   {"kind":"backup","ok":true|false,"message":"...","size":123,"offsite":true}
//     from deploy/backup-db.sh: stored as the last backup; a failure alerts.
//   {"kind":"cron","path":"/api/cron/reminders","status":500}
//     from worker/cron.mjs when a scheduled call fails.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 500) : "");

  if (b.kind === "backup") {
    const ok = b.ok === true;
    const message = str(b.message);
    await saveBackupStatus({
      at: new Date().toISOString(),
      ok,
      message,
      size: typeof b.size === "number" ? b.size : undefined,
      offsite: typeof b.offsite === "boolean" ? b.offsite : undefined,
    });
    if (!ok) await opsAlert("backup", "Backup ฐานข้อมูลล้มเหลว", message || "ดู ~/backups/backup.log บนเซิร์ฟเวอร์");
    return NextResponse.json({ ok: true });
  }

  if (b.kind === "cron") {
    const path = str(b.path);
    await opsAlert(`cron|${path}`, "งานตั้งเวลาทำงานไม่สำเร็จ", `${path} ตอบ ${str(String(b.status ?? "error"))}`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
