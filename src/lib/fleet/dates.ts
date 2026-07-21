// Date normalization for imports: Excel serials, DD/MM(/YYYY), and Thai
// Buddhist-Era years. Mirrors the logic verified in nukyok's verify_*.cjs.
// Builds UTC-midnight Dates so round-tripping through toISOString() is stable
// regardless of the server timezone.
export function normalizeDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  if (typeof v === "number") {
    // Excel serial (1900 date system) -> UTC midnight of that day
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(v).trim();

  // ISO YYYY-MM-DD (year may be Buddhist era, e.g. 2568)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    let year = Number(m[1]);
    if (year >= 2400) year -= 543; // Buddhist era -> Gregorian
    return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3])));
  }

  // DD/MM/YYYY or DD-MM-YYYY (year: 4-digit CE/BE, or 2-digit)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let year = Number(m[3]);
    if (year >= 2400) year -= 543; // 4-digit Buddhist era
    else if (year < 100) year += year > 43 ? 1957 : 2000; // 2-digit: >43 = BE 25xx, else CE 20xx
    const d = new Date(Date.UTC(year, mm - 1, dd));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function toISO(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
