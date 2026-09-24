import { describe, expect, it } from "vitest";
import { normalizeDate, toISO } from "@/lib/fleet/dates";

const n = (v: unknown) => toISO(normalizeDate(v));
// Excel (1900 system) serial for a UTC date.
const serial = (y: number, m: number, day: number) => Date.UTC(y, m - 1, day) / 86400000 + 25569;

describe("normalizeDate", () => {
  it("reads ISO dates in CE and Buddhist Era", () => {
    expect(n("2026-05-05")).toBe("2026-05-05");
    expect(n("2569-05-05")).toBe("2026-05-05");
  });
  it("reads DD/MM/YYYY with a BE year", () => {
    expect(n("5/5/2569")).toBe("2026-05-05");
    expect(n("05-05-2026")).toBe("2026-05-05");
  });
  it("reads 2-digit years: above 43 is BE 25xx, else CE 20xx", () => {
    expect(n("5/5/69")).toBe("2026-05-05");
    expect(n("5/5/26")).toBe("2026-05-05");
  });
  it("reads Excel serials, including '5/5/2569' typed into Excel", () => {
    expect(n(serial(2026, 5, 5))).toBe("2026-05-05");
    expect(n(serial(2569, 5, 5))).toBe("2026-05-05");
  });
  it("returns null for blanks and garbage", () => {
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate("not a date")).toBeNull();
  });
  it("builds UTC midnight so toISOString round-trips", () => {
    expect(normalizeDate("5/5/2569")!.toISOString()).toBe("2026-05-05T00:00:00.000Z");
  });
});
