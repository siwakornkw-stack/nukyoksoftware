// Cron worker for the VPS. Replaces Vercel Cron: it simply hits the app's own
// /api/cron/* endpoints on a schedule (Bearer CRON_SECRET). The endpoints do the
// real work so logic lives in one place (the Next app).
//
// Alternative without this process: use the system crontab (see DEPLOY.md).
import cron from "node-cron";

const BASE = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const SECRET = process.env.CRON_SECRET || "";
const TZ = "Asia/Bangkok";

async function hit(pathname) {
  const at = new Date().toISOString();
  try {
    const res = await fetch(`${BASE}${pathname}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    console.log(at, pathname, "->", res.status);
  } catch (e) {
    console.error(at, pathname, "ERR", e?.message || e);
  }
}

// Daily 01:00 Bangkok: expiry / overdue LINE reminders (fleet).
cron.schedule("0 1 * * *", () => hit("/api/cron/reminders"), { timezone: TZ });

// Monthly, 1st at 01:00 Bangkok: fuel monthly report to LINE admins.
cron.schedule("0 1 1 * *", () => hit("/api/cron/fuel-monthly"), { timezone: TZ });

console.log(`[cron] worker started; base=${BASE} tz=${TZ}`);
