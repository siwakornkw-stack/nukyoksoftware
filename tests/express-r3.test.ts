import { describe, expect, it } from "vitest";
// plain .mjs shared with the office-PC scripts
import { allocate, balanceColumn, planR3, r3Naming } from "../scripts/express/r3.mjs";
import { r3State } from "@/lib/po/purchase-orders";

const isprd = [{ BEG10: "2020-10-01", END10: "2020-10-31", LOCK10: "N", BEG1NY: "2021-01-01", END1NY: "2027-01-31", LOCK1NY: "N", BEG2NY: "2027-02-01", END2NY: "2027-02-28", LOCK2NY: "Y" }];

const tables = (extra: Record<string, unknown[]> = {}) => ({
  aptrn: [
    { RECTYP: "1", DOCNUM: "H30000005", DOCDAT: "2026-10-21", PONUM: "PK0000001", REFNUM: "", DOCSTAT: "N", NETAMT: 2574.4 },
    { RECTYP: "1", DOCNUM: "H30000004", DOCDAT: "2026-10-21", PONUM: "PK0000001", REFNUM: "", DOCSTAT: "N", NETAMT: 0 }, // abandoned blank H3
  ],
  stcrd: [{ DOCNUM: "H30000005", SEQNUM: "1", STKCOD: "81-0664", TRNVAL: 2574.4 }],
  apmas: [{ SUPCOD: "0009", SUPNAM: "สุพัฒน์พงศ์  เทวาวณิชกิจ" }],
  isprd,
  isrun: [{ DOCTYP: "RR", PREFIX: "R3", ACCNUM01: "2111-02" }],
  ...extra,
});

describe("R3 plan", () => {
  it("names the document by date like the office does", () => {
    expect(r3Naming("2026-10-21")).toEqual({ prefix: "R3691021-", youref: "ค่าน้ำมัน(บัตรเครดิต)21/10/69" });
  });

  it("finds the APBAL period column and refuses a locked or unknown period", () => {
    expect(balanceColumn(isprd, "2026-10-21")).toEqual({ column: "RR1NY" });
    expect(balanceColumn(isprd, "2020-10-05")).toEqual({ column: "RR10" });
    expect(balanceColumn(isprd, "2027-02-10").error).toMatch(/ปิดแล้ว/);
    expect(balanceColumn(isprd, "2040-01-01").error).toMatch(/นอกงวด/);
  });

  it("splits an amount to the satang, summing exactly", () => {
    const a = allocate(100, [1, 1, 1]);
    expect(a).toEqual([33.33, 33.33, 33.34]);
    expect(a.reduce((s: number, x: number) => s + x, 0)).toBeCloseTo(100, 10);
  });

  it("plans from the PK's H3 lines: 0009, 2120-03 by vehicle, Dr 2120-03 / Cr 2111-02", () => {
    const p = planR3({ pkNo: "PK0000001", ...tables() });
    expect(p).toMatchObject({
      status: "ready", date: "2026-10-21", prefix: "R3691021-", supCode: "0009", item: "2120-03",
      drAcc: "2120-03", crAcc: "2111-02", balColumn: "RR1NY", total: 2574.4,
      lines: [{ desc: "81-0664", amount: 2574.4 }], h3: ["H30000005"],
    });
    expect(p.glDescr).toBe("สุพัฒน์พงศ์  เทวาวณิชกิจ:ค่าน้ำมัน(บัตรเครดิต)21/1"); // cut to 50 like Express
  });

  it("waits for an H3, and never writes a second R3 for the same PK", () => {
    expect(planR3({ pkNo: "PK0000002", ...tables() }).status).toBe("waiting");
    const t = tables();
    t.aptrn.push({ RECTYP: "3", DOCNUM: "R3691021-01", DOCDAT: "2026-10-21", PONUM: "", REFNUM: "PK0000001", DOCSTAT: "N", NETAMT: 2574.4 });
    expect(planR3({ pkNo: "PK0000001", ...t })).toEqual({ status: "exists", docNo: "R3691021-01" });
  });
});

describe("R3 state on the web", () => {
  const pk = { PoNo: "PK0000001", ApprovalStatus: "approved", R3DocNo: null };
  it("follows the office PC's progress", () => {
    expect(r3State({ ...pk, R3Status: "queued" })).toEqual({ state: "queued" });
    expect(r3State({ ...pk, R3Status: null })).toEqual({ state: "queued" });
    expect(r3State({ ...pk, R3Status: "waiting" })).toEqual({ state: "waiting" });
    expect(r3State({ ...pk, R3Status: "error", R3Error: "boom" })).toEqual({ state: "error", error: "boom" });
    expect(r3State({ ...pk, R3DocNo: "R3691021-01", R3Status: "error" })).toEqual({ state: "opened", docNo: "R3691021-01" });
    expect(r3State({ ...pk, ApprovalStatus: null })).toBeNull();
  });
});
