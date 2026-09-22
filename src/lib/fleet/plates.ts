// Matching free-text vehicle labels from office spreadsheets ("81-0664(กิ้ม)",
// "บน 5490 วีโก้", "SK 140") to Vehicle rows. Pure: safe for client and server.

export const plateKey = (s: string) => s.toLowerCase().replace(/[\s\-._/()]/g, "");

// Fuel sheet names carry the driver in brackets: "SK140(ก๊อต)", "SY35(....)".
export function splitSheetName(name: string): { label: string; hint: string } {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return { label: name.trim(), hint: "" };
  return { label: m[1].trim(), hint: m[2].replace(/\.+/g, "").replace(/^-$/, "").trim() };
}

// Thai plates: "3ฒฮ 4025", "บน5490", "ก-8139" (letters) or "81-0664" (truck digits,
// always hyphenated so "SANY 140" is not read as 14-0).
const THAI_PLATE = /(?:^|\s)(\d?[ก-ฮ]{1,3})\s*-?\s*(\d{1,4})(?!\d)|(?:^|\s)(\d{2})\s*-\s*(\d{1,4})(?!\d)/;

export function guessPlate(label: string): { prefix: string; suffix: string; rest: string } {
  const s = label.trim().replace(/\s+/g, " ");
  const m = s.match(THAI_PLATE);
  if (!m) return { prefix: "", suffix: s, rest: "" };
  const prefix = m[1] ?? m[3];
  const suffix = m[2] ?? m[4];
  const rest = (s.slice(0, m.index) + " " + s.slice((m.index ?? 0) + m[0].length)).trim();
  return { prefix, suffix, rest };
}

export interface PlateVehicle {
  VehicleId: string;
  LicensePlatePrefix: string;
  LicensePlateSuffix: string;
  Model: string;
}

export const plateText = (v: { LicensePlatePrefix: string; LicensePlateSuffix: string }) =>
  `${v.LicensePlatePrefix} ${v.LicensePlateSuffix}`.trim();

// Keys that map to more than one vehicle are dropped: a wrong match silently
// books fuel or insurance on the wrong vehicle, a miss only asks the user.
function uniqueMap(entries: [string, string][]) {
  const map = new Map<string, string | null>();
  for (const [k, id] of entries) {
    if (!k) continue;
    map.set(k, map.has(k) && map.get(k) !== id ? null : id);
  }
  return map;
}

export function plateMatcher(vehicles: PlateVehicle[]) {
  const full = uniqueMap(vehicles.map((v) => [plateKey(v.LicensePlatePrefix + v.LicensePlateSuffix), v.VehicleId]));
  const model = uniqueMap(vehicles.map((v) => [plateKey(v.Model), v.VehicleId]));
  const suffix = uniqueMap(
    vehicles.filter((v) => v.LicensePlateSuffix.length >= 3).map((v) => [plateKey(v.LicensePlateSuffix), v.VehicleId])
  );

  return (...labels: string[]): string | null => {
    for (const label of labels.filter(Boolean)) {
      const g = guessPlate(label);
      for (const k of [plateKey(label), plateKey(g.prefix + g.suffix)]) {
        const id = full.get(k) ?? model.get(k);
        if (id) return id;
      }
      if (g.prefix) {
        const id = suffix.get(plateKey(g.suffix));
        if (id) return id;
      }
    }
    return null;
  };
}
