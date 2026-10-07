// Date normalization for imports: Excel serials, DD/MM(/YYYY), and Thai
// Buddhist-Era years. Mirrors the logic verified in nukyok's verify_*.cjs.
// Builds UTC-midnight Dates so round-tripping through toISOString() is stable
// regardless of the server timezone.
//
// A year outside 1900-2200 (after the BE conversion) is a typo, such as 92569
// from typing 2569 into a date field that still held digits. It used to reach
// Prisma and fail the save with a bare 500; callers already treat null as an
// invalid date.
const sane = (d: Date | null) => {
  if (!d || isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 1900 && y <= 2200 ? d : null;
};

export function normalizeDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return sane(v);

  if (typeof v === "number") {
    // Excel serial (1900 date system) -> UTC midnight of that day
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    // Office sheets type "5/5/2569" and Excel stores it as a serial in year 2569.
    const y = d.getUTCFullYear();
    if (y >= 2400) return sane(new Date(Date.UTC(y - 543, d.getUTCMonth(), d.getUTCDate())));
    return sane(d);
  }

  const s = String(v).trim();

  // ISO YYYY-MM-DD (year may be Buddhist era, e.g. 2568)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    let year = Number(m[1]);
    if (year >= 2400) year -= 543; // Buddhist era -> Gregorian
    if (year < 1900) return null; // Date.UTC would turn 0026 into 1926
    return sane(new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]))));
  }

  // DD/MM/YYYY or DD-MM-YYYY (year: 4-digit CE/BE, or 2-digit)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let year = Number(m[3]);
    if (year >= 2400) year -= 543; // 4-digit Buddhist era
    else if (year < 100) year += year > 43 ? 1957 : 2000; // 2-digit: >43 = BE 25xx, else CE 20xx
    return sane(new Date(Date.UTC(year, mm - 1, dd)));
  }

  return sane(new Date(s));
}

export function toISO(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
