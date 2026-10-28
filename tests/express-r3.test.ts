import { describe, expect, it } from "vitest";
// plain .mjs shared with the office-PC scripts
import { allocate, balanceColumn, h3Ref, planR3, r3Naming } from "../scripts/express/r3.mjs";
import { r3State } from "@/lib/po/purchase-orders";

const isprd = [{ BEG10: "2020-10-01", END10: "2020-10-31", LOCK10: "N", BEG1NY: "2021-01-01", END1NY: "2027-01-31", LOCK1NY: "N", BEG2NY: "2027-02-01", END2NY: "2027-02-28", LOCK2NY: "Y" }];

type Row = Record<string, unknown>;
const tables = (extra: Record<string, Row[]> = {}) => ({
  aptrn: <Row[]>[
    { RECTYP: "1", DOCNUM: "H30000005", DOCDAT: "2026-10-21", PONUM: "PK0000001", REFNUM: "", DOCSTAT: "N", NETAMT: 2574.4 },
    { RECTYP: "1", DOCNUM: "H30000004", DOCDAT: "2026-10-21", PONUM: "PK0000001", REFNUM: "", DOCSTAT: "N", NETAMT: 0 }, // abandoned blank H3
  ],
  stcrd: <Row[]>[{ DOCNUM: "H30000005", SEQNUM: "1", STKCOD: "81-0664", TRNVAL: 2574.4 }],
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

  it("opens the day's R3 when there is none: 0009, 2120-03 '<vehicle> /<H3>', Dr 2120-03 / Cr 2111-02", () => {
    const p = planR3({ pkNo: "PK0000001", ...tables() });
    expect(p).toMatchObject({
      status: "ready", mode: "new", date: "2026-10-21", prefix: "R3691021-", supCode: "0009", item: "2120-03",
      drAcc: "2120-03", crAcc: "2111-02", balColumn: "RR1NY", total: 2574.4,
      lines: [{ desc: "81-0664 /H30000005", amount: 2574.4 }], h3: ["H30000005"],
    });
    expect((p as { glDescr?: string }).glDescr).toBe("สุพัฒน์พงศ์  เทวาวณิชกิจ:ค่าน้ำมัน(บัตรเครดิต)21/1"); // cut to 50 like Express
  });

  it("waits for an H3, and never puts an H3 on an R3 twice", () => {
    expect(planR3({ pkNo: "PK0000002", ...tables() }).status).toBe("waiting");
    // written per PK before 2026-10-28 (the PK in REFNUM)
    const t = tables();
    t.aptrn.push({ RECTYP: "3", DOCNUM: "R3691021-01", DOCDAT: "2026-10-21", PONUM: "", REFNUM: "PK0000001", DOCSTAT: "N", NETAMT: 2574.4 });
    expect(planR3({ pkNo: "PK0000001", ...t })).toEqual({ status: "exists", docNo: "R3691021-01" });
    // a line of the day's R3 already names the H3 (staff write it "vehicle /H3...")
    const u = tables({
      stcrd: [...tables().stcrd, { DOCNUM: "R3691021-01", SEQNUM: "3", STKCOD: "2120-03", STKDES: "81-0664 / H30000005", TRNVAL: 2574.4 }],
    });
    u.aptrn.push({ RECTYP: "3", DOCNUM: "R3691021-01", DOCDAT: "2026-10-21", SUPCOD: "0009", REFNUM: "", DOCSTAT: "N", NETAMT: 9000, REMAMT: 9000, PAYAMT: 0 });
    expect(planR3({ pkNo: "PK0000001", ...u })).toEqual({ status: "exists", docNo: "R3691021-01" });
    expect(h3Ref("SY55 /H3690829-03")).toBe("H3690829-03");
    expect(h3Ref("ก-1725 H3691004-07")).toBe(""); // no slash: not a reference
  });

  // The day's R3 as the office keys it: one per date, lines from the card statement.
  const day = (o: Record<string, unknown> = {}) => ({ RECTYP: "3", DOCNUM: "R3691021-01", DOCDAT: "2026-10-21", SUPCOD: "0009", REFNUM: "", DOCSTAT: "N", NETAMT: 6400, REMAMT: 6400, PAYAMT: 0, ...o });
  const dayLines = [
    { DOCNUM: "R3691021-01", SEQNUM: "1", STKCOD: "2120-03", STKDES: "SY55 /H3691021-02", TRNVAL: 3600 },
    { DOCNUM: "R3691021-01", SEQNUM: "2", STKCOD: "2120-03", STKDES: "81-2801", TRNVAL: 2800 },
  ];

  it("adds the H3 to the day's unpaid R3", () => {
    const t = tables({ stcrd: [...tables().stcrd, ...dayLines] });
    t.aptrn.push(day());
    expect(planR3({ pkNo: "PK0000001", ...t })).toMatchObject({ status: "ready", mode: "append", docNo: "R3691021-01", total: 2574.4, lines: [{ desc: "81-0664 /H30000005" }] });
  });

  it("opens another R3 when the day's one is (partly) paid or belongs to one PK", () => {
    for (const r of [day({ PAYAMT: 6400, REMAMT: 0 }), day({ PAYAMT: 1000, REMAMT: 5400 }), day({ REFNUM: "PK0000009" })]) {
      const t = tables({ stcrd: [...tables().stcrd, ...dayLines] });
      t.aptrn.push(r);
      expect(planR3({ pkNo: "PK0000001", ...t })).toMatchObject({ status: "ready", mode: "new", prefix: "R3691021-" });
    }
  });

  it("holds an H3 whose amount matches an unreferenced line of the day's R3, until an admin confirms", () => {
    const twin = { DOCNUM: "R3691021-01", SEQNUM: "3", STKCOD: "2120-03", STKDES: "81-0664", TRNVAL: 2574.4 };
    const t = tables({ stcrd: [...tables().stcrd, ...dayLines, twin] });
    t.aptrn.push(day({ NETAMT: 8974.4, REMAMT: 8974.4 }));
    const p = planR3({ pkNo: "PK0000001", ...t });
    expect(p).toMatchObject({ status: "error", duplicate: true });
    expect((p as { reason?: string }).reason).toMatch(/^อาจซ้ำ: R3691021-01 มีบรรทัด "81-0664" 2574.4/);
    expect(planR3({ pkNo: "PK0000001", ...t }, { force: true })).toMatchObject({ status: "ready", mode: "append", docNo: "R3691021-01" });
  });

  it("leaves a PK whose H3s span several dates to a person", () => {
    const t = tables();
    t.aptrn.push({ RECTYP: "1", DOCNUM: "H30000006", DOCDAT: "2026-10-22", PONUM: "PK0000001", REFNUM: "", DOCSTAT: "N", NETAMT: 100 });
    t.stcrd.push({ DOCNUM: "H30000006", SEQNUM: "1", STKCOD: "81-0664", TRNVAL: 100 });
    expect((planR3({ pkNo: "PK0000001", ...t }) as { reason?: string }).reason).toMatch(/หลายวันที่/);
  });
});

describe("R3 state on the web", () => {
  const pk = { PoNo: "PK0000001", ApprovalStatus: "approved", R3DocNo: null };
  it("follows the office PC's progress", () => {
    expect(r3State({ ...pk, R3Status: "queued" })).toEqual({ state: "queued" });
    expect(r3State({ ...pk, R3Status: null })).toEqual({ state: "queued" });
    expect(r3State({ ...pk, R3Status: "waiting" })).toEqual({ state: "waiting" });
    expect(r3State({ ...pk, R3Status: "force" })).toEqual({ state: "queued" });
    expect(r3State({ ...pk, R3Status: "error", R3Error: "boom" })).toEqual({ state: "error", error: "boom" });
    expect(r3State({ ...pk, R3DocNo: "R3691021-01", R3Status: "error" })).toEqual({ state: "opened", docNo: "R3691021-01" });
    expect(r3State({ ...pk, ApprovalStatus: null })).toBeNull();
  });
});
