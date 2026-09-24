import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getLineAdminId } from "@/lib/fuel/settings";
import { alertAdmin } from "@/lib/fuel/line";

// Something broke that nobody would otherwise see (backup, cron, server error):
// push it to the LINE admins and leave an in-app notification for admin users.
// The same key alerts at most once per THROTTLE_MS (in memory, single process).
const THROTTLE_MS = 30 * 60 * 1000;
const lastSent = new Map<string, number>();

export async function opsAlert(key: string, title: string, text: string): Promise<boolean> {
  const now = Date.now();
  if ((lastSent.get(key) ?? 0) > now - THROTTLE_MS) return false;
  lastSent.set(key, now);

  const message = `⚠️ ${title}\n${text}`.slice(0, 4500);
  try {
    if (process.env.LINE_CHANNEL_ACCESS_TOKEN) await alertAdmin(await getLineAdminId(), message);
  } catch (e) {
    console.error("ops alert LINE push failed:", (e as Error)?.message);
  }
  try {
    const admins = await prisma.customer.findMany({
      where: { TenantId: DEFAULT_TENANT_ID, Role: "admin", Status: "active" },
      select: { CustomerId: true },
    });
    for (const a of admins) {
      await prisma.notification.upsert({
        where: { CustomerId_Key: { CustomerId: a.CustomerId, Key: `ops|${key}` } },
        create: { CustomerId: a.CustomerId, Key: `ops|${key}`, Title: "ระบบ", Message: `${title}: ${text}`.slice(0, 1000) },
        update: { Message: `${title}: ${text}`.slice(0, 1000), IsRead: false, CreatedTime: new Date() },
      });
    }
  } catch (e) {
    console.error("ops alert notification failed:", (e as Error)?.message);
  }
  return true;
}

// ---- last backup result (written by deploy/backup-db.sh via /api/cron/ops) ----

export interface BackupStatus {
  at: string; // ISO time the script reported
  ok: boolean;
  message: string;
  size?: number;
  offsite?: boolean;
}

const BACKUP_KEY = "last_backup";

export async function saveBackupStatus(s: BackupStatus) {
  const value = JSON.stringify(s);
  await prisma.appSetting.upsert({ where: { key: BACKUP_KEY }, update: { value }, create: { key: BACKUP_KEY, value } });
}

export async function lastBackupStatus(): Promise<BackupStatus | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: BACKUP_KEY } });
  try {
    return row?.value ? (JSON.parse(row.value) as BackupStatus) : null;
  } catch {
    return null;
  }
}

// Nightly backup runs 02:30 Bangkok; a successful one older than this is overdue.
export const BACKUP_MAX_AGE_MS = 26 * 3600 * 1000;
