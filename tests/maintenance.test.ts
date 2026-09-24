import { describe, expect, it } from "vitest";
import { oilDue, tireDue } from "@/lib/fleet/maintenance";

const now = new Date("2026-09-24T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

describe("oilDue", () => {
  it("counts km since the last oil change against the interval", () => {
    const r = oilDue([{ at: daysAgo(60), km: 50000 }, { at: daysAgo(0), km: 56000 }], 50000, 10000, now);
    expect(r.sinceKm).toBe(6000);
    expect(r.remainingKm).toBe(4000);
    expect(r.status).toBe("ok");
    // 6000 km over 60 days = 100 km/day -> 40 more days.
    expect(r.kmPerDay).toBeCloseTo(100);
    expect(r.dueDate!.toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("is due soon within 1000 km and overdue past the interval", () => {
    expect(oilDue([{ at: now, km: 59500 }], 50000, 10000, now).status).toBe("soon");
    expect(oilDue([{ at: now, km: 61000 }], 50000, 10000, now).status).toBe("overdue");
  });

  it("scales 'soon' to the interval for hour-metered machinery", () => {
    // 250-hour interval: soon only in the last 25 hours, not the last 1,000.
    expect(oilDue([{ at: now, km: 1180 }], 1000, 250, now).status).toBe("ok"); // 70 h left
    expect(oilDue([{ at: now, km: 1230 }], 1000, 250, now).status).toBe("soon"); // 20 h left
    expect(oilDue([{ at: now, km: 1260 }], 1000, 250, now).status).toBe("overdue");
  });

  it("is unknown without an oil-change odometer or any reading", () => {
    expect(oilDue([{ at: now, km: 1000 }], null, 10000, now).status).toBe("unknown");
    expect(oilDue([], 50000, 10000, now).status).toBe("unknown");
    expect(oilDue([{ at: now, km: 0 }], 50000, 10000, now).status).toBe("unknown");
  });

  it("gives no date estimate without enough recent readings", () => {
    const r = oilDue([{ at: daysAgo(200), km: 50000 }, { at: daysAgo(0), km: 52000 }], 50000, 10000, now);
    expect(r.remainingKm).toBe(8000);
    expect(r.dueDate).toBeNull();
  });
});

describe("tireDue", () => {
  const monthsAgo = (m: number) => daysAgo(Math.round(m * 30.44));

  it("is due by age or by distance, whichever comes first", () => {
    expect(tireDue(monthsAgo(6), 10000, 20000, 24, 50000, now).status).toBe("ok");
    expect(tireDue(monthsAgo(23.5), 10000, 20000, 24, 50000, now).status).toBe("soon");
    expect(tireDue(monthsAgo(25), 10000, 20000, 24, 50000, now)).toMatchObject({ status: "overdue", reason: "อายุ 25 เดือน" });
    expect(tireDue(monthsAgo(6), 10000, 56000, 24, 50000, now)).toMatchObject({ status: "soon", sinceKm: 46000 });
    expect(tireDue(monthsAgo(6), 10000, 61000, 24, 50000, now)).toMatchObject({ status: "overdue", reason: "ใช้งาน 51,000 กม." });
  });

  it("falls back to age alone without an odometer at the change", () => {
    expect(tireDue(monthsAgo(6), null, 99999, 24, 50000, now)).toMatchObject({ status: "ok", sinceKm: null });
    expect(tireDue(monthsAgo(6), 0, 99999, 24, 50000, now).sinceKm).toBeNull();
  });
});
