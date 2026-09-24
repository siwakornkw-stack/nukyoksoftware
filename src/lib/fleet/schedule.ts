// Pure date rules for reminders and installment schedules (no DB), so they can
// be unit-tested.

const DAY_MS = 86400000;

// UTC midnight of the current Bangkok calendar day, matching how EndDate/DueDate
// are stored (see normalizeDate).
export function bangkokToday(now = new Date()): Date {
  return new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now)}T00:00:00.000Z`);
}

export const daysLeft = (d: Date, today: Date) => Math.round((d.getTime() - today.getTime()) / DAY_MS);

const REMIND_DAYS = new Set([30, 7, 3]);

// Fire at exactly 30/7/3 days out, then every day once it's actually expired.
export const shouldRemind = (d: Date, today: Date) => {
  const n = daysLeft(d, today);
  return REMIND_DAYS.has(n) || n <= 0;
};

// Monthly due dates anchored on start's day of month. The day is clamped to the
// target month's length so a 29-31 anchor does not roll into the next month.
export function installmentDueDates(start: Date, periods: number): Date[] {
  const anchorDay = start.getUTCDate();
  const y = start.getUTCFullYear();
  return Array.from({ length: periods }, (_, idx) => {
    const mo = start.getUTCMonth() + idx;
    const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mo, Math.min(anchorDay, lastDay)));
  });
}
