import { describe, expect, it } from "vitest";
import { efficiencyDrops, findAnomalies, type FuelRecord } from "@/lib/fleet/fuel-report";
import { checkFraud } from "@/lib/fuel/fraud";

let seq = 0;
// One fill: `liters` bought, odometer moving from start to end.
const fill = (vehicleId: string, date: string, liters: number, odoStart: number, odoEnd: number): FuelRecord => ({
  id: String(++seq),
  vehicleId,
  plate: vehicleId,
  model: "",
  date,
  item: "ดีเซล",
  invoice: `INV${seq}`,
  liters,
  amount: liters * 30,
  odoStart,
  odoEnd,
  distance: null,
  receiver: "",
  billUrl: "",
});

// A month in which the vehicle drives `km` on `liters` (km/L = km / liters).
const month = (vehicleId: string, ym: string, km: number, liters: number, odo: number) => [
  fill(vehicleId, `${ym}-05`, liters / 2, odo, odo + km / 2),
  fill(vehicleId, `${ym}-20`, liters / 2, odo + km / 2, odo + km),
];

describe("efficiencyDrops", () => {
  const baseline = ["2026-01", "2026-02", "2026-03", "2026-04"].flatMap((m, i) => month("V1", m, 500, 100, i * 1000));

  it("flags a month well below the vehicle's usual km/L", () => {
    const rows = [...baseline, ...month("V1", "2026-05", 350, 100, 5000)]; // 3.5 vs usual 5
    const out = efficiencyDrops(rows, ["2026-05"]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("kmlDrop");
  });
  it("ignores a small dip", () => {
    const rows = [...baseline, ...month("V1", "2026-05", 450, 100, 5000)]; // 4.5 = 90%
    expect(efficiencyDrops(rows, ["2026-05"])).toHaveLength(0);
  });
  it("needs at least 3 baseline months before judging", () => {
    const rows = [...baseline.slice(0, 4), ...month("V1", "2026-05", 100, 100, 5000)]; // only 2 months of baseline
    expect(efficiencyDrops(rows, ["2026-05"])).toHaveLength(0);
  });
});

describe("findAnomalies", () => {
  it("catches an odometer going backwards", () => {
    const rows = [fill("V1", "2026-05-01", 50, 1000, 1200), fill("V1", "2026-05-10", 50, 900, 1100)];
    expect(findAnomalies(rows).map((a) => a.kind)).toContain("odoBack");
  });
  it("catches the same invoice used twice", () => {
    const a = fill("V1", "2026-05-01", 50, 1000, 1200);
    const b = { ...fill("V2", "2026-05-02", 50, 1000, 1200), invoice: a.invoice };
    expect(findAnomalies([a, b]).filter((x) => x.kind === "dupInvoice")).toHaveLength(2);
  });
});

describe("checkFraud", () => {
  const ok = { billDate: "2026-05-05", billTime: "10:00", liters: 40, pricePerLiter: 30, total: 1200 };

  it("passes a normal bill", () => {
    expect(checkFraud({ bill: ok })).toEqual([]);
  });
  it("flags a refuel too soon after the last one", () => {
    const r = checkFraud({ bill: ok, lastBill: { billDate: "2026-05-05", billTime: "08:00" } });
    expect(r.join()).toMatch(/ชั่วโมง/);
  });
  it("flags liters x price that does not add up", () => {
    expect(checkFraud({ bill: { ...ok, total: 1500 } }).join()).toMatch(/ไม่ตรง/);
  });
  it("flags amounts over the ceilings", () => {
    expect(checkFraud({ bill: { ...ok, liters: 120, total: 3600 } }).length).toBeGreaterThanOrEqual(2);
  });
  it("flags a duplicate image or receipt", () => {
    expect(checkFraud({ bill: ok, duplicateByHash: { id: 7 } })[0]).toMatch(/#7/);
  });
});
