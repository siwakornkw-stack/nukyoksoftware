import { describe, expect, it } from "vitest";
import { bangkokToday, daysLeft, installmentDueDates, shouldRemind } from "@/lib/fleet/schedule";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe("bangkokToday", () => {
  it("uses the Bangkok calendar day, not the UTC one", () => {
    // 23:30 UTC on the 23rd is already 06:30 on the 24th in Bangkok.
    expect(iso(bangkokToday(new Date("2026-09-23T23:30:00Z")))).toBe("2026-09-24");
    expect(iso(bangkokToday(new Date("2026-09-23T16:59:00Z")))).toBe("2026-09-23");
  });
});

describe("shouldRemind (30/7/3 days out, then daily once expired)", () => {
  const today = d("2026-09-24");
  const at = (n: number) => new Date(today.getTime() + n * 86400000);

  it("fires exactly 30, 7 and 3 days before", () => {
    for (const n of [30, 7, 3]) expect(shouldRemind(at(n), today)).toBe(true);
  });
  it("stays quiet on the other days before expiry", () => {
    for (const n of [31, 29, 8, 6, 4, 2, 1]) expect(shouldRemind(at(n), today)).toBe(false);
  });
  it("fires every day from the expiry day on, without an end", () => {
    for (const n of [0, -1, -30, -400]) expect(shouldRemind(at(n), today)).toBe(true);
  });
  it("counts whole days", () => {
    expect(daysLeft(d("2026-10-24"), today)).toBe(30);
  });
});

describe("installmentDueDates", () => {
  it("keeps the anchor day and clamps it to short months", () => {
    expect(installmentDueDates(d("2026-01-31"), 4).map(iso)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("uses Feb 29 in a leap year", () => {
    expect(installmentDueDates(d("2028-01-30"), 2).map(iso)).toEqual(["2028-01-30", "2028-02-29"]);
  });
  it("rolls over into the next year", () => {
    expect(installmentDueDates(d("2026-11-15"), 3).map(iso)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });
  it("makes one date per period", () => {
    expect(installmentDueDates(d("2026-01-01"), 48)).toHaveLength(48);
  });
});
