import { describe, expect, it } from "vitest";
import { guessPlate, plateKey, plateMatcher, splitSheetName } from "@/lib/fleet/plates";

const v = (VehicleId: string, LicensePlatePrefix: string, LicensePlateSuffix: string, Model = "") => ({
  VehicleId,
  LicensePlatePrefix,
  LicensePlateSuffix,
  Model,
});

describe("plate parsing", () => {
  it("normalizes spacing and punctuation", () => {
    expect(plateKey("81-0664 (กิ้ม)")).toBe(plateKey("810664กิ้ม"));
  });
  it("splits a Thai plate out of a label", () => {
    expect(guessPlate("บน 5490 วีโก้")).toEqual({ prefix: "บน", suffix: "5490", rest: "วีโก้" });
    expect(guessPlate("81-0664")).toMatchObject({ prefix: "81", suffix: "0664" });
  });
  it("does not read a machine model as a truck plate", () => {
    expect(guessPlate("SANY 140").prefix).toBe("");
  });
  it("separates the driver hint from a sheet name", () => {
    expect(splitSheetName("SK140(ก๊อต)")).toEqual({ label: "SK140", hint: "ก๊อต" });
  });
});

describe("plateMatcher", () => {
  const vehicles = [v("A", "81", "2458"), v("B", "บน", "5490"), v("C", "", "SK140", "SK140"), v("D", "82", "1111"), v("E", "83", "1111")];

  it("matches full plates whatever the spacing", () => {
    const match = plateMatcher(vehicles);
    expect(match("81-2458")).toBe("A");
    expect(match("81 2458")).toBe("A");
    expect(match("บน5490")).toBe("B");
  });
  it("matches by model name", () => {
    expect(plateMatcher(vehicles)("SK140")).toBe("C");
  });
  it("drops a suffix shared by two vehicles instead of guessing", () => {
    expect(plateMatcher(vehicles)("กข 1111")).toBeNull();
  });
  it("prefers a learned alias", () => {
    const match = plateMatcher(vehicles, new Map([[plateKey("ZZ 0000"), "D"]]));
    expect(match("ZZ 0000")).toBe("D");
  });
  it("returns null when nothing fits", () => {
    expect(plateMatcher(vehicles)("กก 9999")).toBeNull();
  });
});
