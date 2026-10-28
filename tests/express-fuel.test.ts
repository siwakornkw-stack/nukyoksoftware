import { describe, expect, it } from "vitest";
// plain .mjs shared with the office-PC scripts
import { h3Prefix, lineAmounts, planFuel } from "../scripts/express/fuel.mjs";
import { buildFuelMasters } from "../scripts/express/fuel-masters.mjs";
import { checkExpressPick, expressInvoice, guessSupplier, suggestItem, type FuelMasters } from "@/lib/fleet/express-fuel";

const isprd = [{ BEG1NY: "2021-01-01", END1NY: "2027-01-31", LOCK1NY: "N", BEG2NY: "2027-02-01", END2NY: "2027-02-28", LOCK2NY: "Y" }];

const tables = (extra: Record<string, unknown[]> = {}) => ({
  popr: [{ PONUM: "PK0000001", SUPCOD: "บ015", PODAT: "2026-10-27", YOUREF: "26102700000001", DOCSTAT: "N" }],
  poprit: [],
  stmas: [
    { STKCOD: "70-1826", STKDES: "ค่าน้ำมันรถ 70-1826", STKTYP: "5", PQUCOD: "ลต" },
    { STKCOD: "140 SY", STKDES: "น้ำมัน SY140", STKTYP: "0", PQUCOD: "ลต" },
  ],
  apmas: [{ SUPCOD: "บ015", SUPNAM: "บางจากกรีนเนท", PRENAM: "บริษัท", TAXID: "0105556000001", ORGNUM: "00012" }],
  aptrn: [
    { DOCNUM: "H3691013-01", SUPCOD: "บ015", REFNUM: "26101300000009", PONUM: "PP0002773", DOCSTAT: "N" },
    { DOCNUM: "H3691014-01", SUPCOD: "บ015", REFNUM: "26101400000001", PONUM: "PP0002780", DOCSTAT: "C" },
  ],
  isprd,
  isrun: [
    { DOCTYP: "HP", PREFIX: "H3", ACCNUM01: "5110-04", ACCNUM02: "1164-01", ACCNUM04: "2120-03" },
    { DOCTYP: "PO", PREFIX: "PK" },
  ],
  ...extra,
});

const order = (o: Record<string, unknown> = {}) => ({
  id: "o1",
  withH3: true,
  supplier: "บ015",
  item: "70-1826",
  dep: "03",
  date: "2026-10-28",
  invoice: "26102811012580",
  liters: 30.5,
  price: 32.94,
  amount: 1004.67,
  ...o,
});

describe("fuel PK + H3 plan", () => {
  it("numbers the H3 by date like staff do", () => {
    expect(h3Prefix("2026-10-28")).toBe("H3691028-");
    expect(h3Prefix("2027-01-05")).toBe("H3700105-");
  });

  it("books the rounding difference as a discount, never a negative one", () => {
    expect(lineAmounts(30.5, 32.94, 1004.67)).toEqual({ price: 32.94, disc: 0, total: 1004.67, vat: 65.73, net: 938.94, xunit: 30.78 });
    expect(lineAmounts(40.21, 32.94, 1324.5).disc).toBe(0.02);
    // litres x pump price below the paid total: the price goes up to the next satang
    expect(lineAmounts(30, 32.94, 989)).toMatchObject({ price: 32.97, disc: 0.1 });
    // no pump price on the bill
    expect(lineAmounts(20, 0, 700).price).toBe(35);
  });

  it("plans a new PK + H3", () => {
    const p = planFuel(order(), tables());
    expect(p).toMatchObject({
      status: "ready",
      orderId: "o1",
      pkNo: "",
      withH3: true,
      h3Prefix: "H3691028-",
      supplier: { code: "บ015", name: "บางจากกรีนเนท", prenam: "บริษัท", taxId: "0105556000001", branch: 12 },
      item: { code: "70-1826", unit: "ลต" },
      dep: "03",
      qty: 30.5,
      total: 1004.67,
      vat: 65.73,
      accounts: { expense: "5110-04", vat: "1164-01", pay: "2120-03" },
      hpColumn: "HP1NY",
      glDescr: "บางจากกรีนเนท:",
    });
  });

  it("writes nothing when the tax invoice already has an H3 from that supplier", () => {
    expect(planFuel(order({ invoice: "26101300000009" }), tables())).toEqual({ status: "exists", pkNo: "PP0002773", h3No: "H3691013-01" });
    // a cancelled H3 does not count, nor one from another supplier
    expect(planFuel(order({ invoice: "26101400000001" }), tables()).status).toBe("ready");
    const other = tables({ apmas: [...tables().apmas, { SUPCOD: "ป001", SUPNAM: "ปตท", PRENAM: "", TAXID: "", ORGNUM: "" }] });
    expect(planFuel(order({ supplier: "ป001", invoice: "26101300000009" }), other).status).toBe("ready");
  });

  it("adds only the H3 to a PK already opened for the bill", () => {
    const p = planFuel(order({ date: "2026-10-27", invoice: "26102700000001" }), tables());
    expect(p).toMatchObject({ status: "ready", pkNo: "PK0000001", withH3: true });
  });

  it("writes only the PK for a stock item and reports a PK already there", () => {
    const p = planFuel(order({ item: "140 SY" }), tables());
    expect(p).toMatchObject({ status: "ready", withH3: false, accounts: null, hpColumn: "" });
    expect(planFuel(order({ item: "140 SY", date: "2026-10-27", invoice: "26102700000001" }), tables())).toEqual({ status: "exists", pkNo: "PK0000001", h3No: "" });
    expect(planFuel(order({ withH3: false, date: "2026-10-27", invoice: "26102700000001" }), tables()).status).toBe("exists");
  });

  it("refuses what Express would not accept", () => {
    expect(planFuel(order({ supplier: "X" }), tables()).reason).toMatch(/ผู้จำหน่าย/);
    expect(planFuel(order({ item: "X" }), tables()).reason).toMatch(/รหัสรถ/);
    expect(planFuel(order({ liters: 0 }), tables()).reason).toMatch(/ลิตร/);
    expect(planFuel(order({ invoice: "" }), tables()).reason).toMatch(/ใบกำกับ/);
    expect(planFuel(order({ date: "2027-02-10" }), tables()).reason).toMatch(/ปิดแล้ว/);
    expect(planFuel(order(), tables({ isrun: [{ DOCTYP: "PO", PREFIX: "PK" }] })).reason).toMatch(/ISRUN/);
    expect(planFuel(order(), tables({ isrun: tables().isrun.slice(0, 1) })).reason).toMatch(/เลขรันของ PK/);
  });
});

describe("fuel master data from Express", () => {
  const m = buildFuelMasters({
    popr: [
      { PONUM: "PP0000001", SUPCOD: "บ015", PODAT: "2026-07-01", DOCSTAT: "M", DEPCOD: "" },
      { PONUM: "PP0000002", SUPCOD: "บ015", PODAT: "2026-08-01", DOCSTAT: "M", DEPCOD: "" },
      { PONUM: "PK0000001", SUPCOD: "ป001", PODAT: "2026-10-27", DOCSTAT: "N", DEPCOD: "" },
      { PONUM: "PP0000003", SUPCOD: "ซ001", PODAT: "2026-09-01", DOCSTAT: "C", DEPCOD: "" }, // cancelled
      { PONUM: "PP0000000", SUPCOD: "ซ002", PODAT: "2024-12-31", DOCSTAT: "M", DEPCOD: "" }, // too old
      { PONUM: "PO0000001", SUPCOD: "ซ003", PODAT: "2026-09-01", DOCSTAT: "N", DEPCOD: "" }, // not a fuel book
    ],
    poprit: [
      { PONUM: "PP0000001", STKCOD: "70-1826", STKDES: "ค่าน้ำมัน", DEPCOD: "01" },
      { PONUM: "PP0000001", STKCOD: "ห้ามใช้-6253 (ฏท)", STKDES: "ห้ามใช้ ค่าน้ำมันรถ", DEPCOD: "01" }, // retired item
      { PONUM: "PP0000002", STKCOD: "70-1826", STKDES: "ค่าน้ำมัน", DEPCOD: "03" },
      { PONUM: "PK0000001", STKCOD: "140 SY", STKDES: "น้ำมัน SY140", DEPCOD: "05" },
      { PONUM: "PP0000003", STKCOD: "X-1", STKDES: "", DEPCOD: "01" },
      { PONUM: "PO0000001", STKCOD: "X-2", STKDES: "", DEPCOD: "01" },
    ],
    stmas: [
      { STKCOD: "70-1826", STKDES: "ค่าน้ำมันรถ 70-1826", STKTYP: "5", PQUCOD: "ลต" },
      { STKCOD: "140 SY", STKDES: "น้ำมัน SY140", STKTYP: "0", PQUCOD: "ลต" },
    ],
    apmas: [{ SUPCOD: "บ015", PRENAM: "บริษัท", SUPNAM: "บางจากกรีนเนท", TAXID: "0105556000001", ORGNUM: "00012" }],
    istab: [{ TABTYP: "50", TYPCOD: "03", TYPDES: "ขนส่ง" }],
    aptrn: [
      { DOCNUM: "H3690701-01", DOCDAT: "2026-07-01", FLGVAT: "1", DOCSTAT: "N" },
      { DOCNUM: "H3690801-01", DOCDAT: "2026-08-01", FLGVAT: "0", DOCSTAT: "N" },
    ],
    stcrd: [
      { DOCNUM: "H3690701-01", STKCOD: "70-1826" },
      { DOCNUM: "H3690801-01", STKCOD: "70-1826" },
    ],
  });

  it("lists the fuel suppliers, most used first", () => {
    expect(m.suppliers).toEqual([
      { code: "บ015", name: "บริษัท บางจากกรีนเนท", taxId: "0105556000001", branch: "00012", uses: 2, last: "2026-08-01" },
      { code: "ป001", name: "ป001", taxId: "", branch: "", uses: 1, last: "2026-10-27" },
    ]);
  });

  it("gives each vehicle item its latest department, stock type and VAT claim", () => {
    expect(m.items).toEqual([
      { code: "70-1826", desc: "ค่าน้ำมันรถ 70-1826", depCode: "03", depName: "ขนส่ง", unit: "ลต", stock: false, vatClaim: false, uses: 2, last: "2026-08-01" },
      { code: "140 SY", desc: "น้ำมัน SY140", depCode: "05", depName: "", unit: "ลต", stock: true, vatClaim: true, uses: 1, last: "2026-10-27" },
    ]);
  });
});

describe("fuel bills -> Express choices", () => {
  const item = (code: string, desc: string, extra: Partial<FuelMasters["items"][number]> = {}) => ({
    code,
    desc,
    depCode: "03",
    depName: "",
    unit: "ลต",
    stock: false,
    vatClaim: true,
    uses: 1,
    last: "",
    ...extra,
  });
  const masters: FuelMasters = {
    at: "",
    writer: true,
    suppliers: [{ code: "บ015", name: "บางจากกรีนเนท", taxId: "", branch: "", uses: 9, last: "" }],
    items: [item("70-1826", "ค่าน้ำมันรถ 70-1826"), item("3297 (ก)", "ค่าน้ำมันรถกระบะ ก-3297 วีโก้"), item("SY200", "ค่าน้ำมัน SY200H")],
  };

  it("drops the leading Thai letters of the tax invoice, as staff key it", () => {
    expect(expressInvoice("ต26102811012580")).toBe("26102811012580");
    expect(expressInvoice(" IV 6810 0001 ")).toBe("IV68100001");
    expect(expressInvoice("ABC1234567890123")).toBeNull(); // 16 characters
    expect(expressInvoice("")).toBeNull();
  });

  it("guesses the supplier from the station", () => {
    expect(guessSupplier("ปั๊ม ABC", { "ปั๊ม abc": "ป001" }, masters)).toBe("ป001");
    expect(guessSupplier("บางจาก สาขาถลาง", {}, masters)).toBe("บ015");
    expect(guessSupplier("บางจาก สาขาถลาง", {}, null)).toBe("");
    expect(guessSupplier("", {}, masters)).toBe("");
  });

  it("suggests a vehicle's item only on a single clear match", () => {
    const v = (LicensePlatePrefix: string, LicensePlateSuffix: string, Model = "") => ({ LicensePlatePrefix, LicensePlateSuffix, Model });
    expect(suggestItem(v("70", "1826"), masters.items)).toBe("70-1826");
    expect(suggestItem(v("ก", "3297"), masters.items)).toBe("3297 (ก)");
    expect(suggestItem(v("", "", "SY200H"), masters.items)).toBe("SY200");
    expect(suggestItem(v("", "", "SY200H"), [...masters.items, item("SY200-2", "น้ำมัน SY200H คันที่ 2")])).toBe("");
    expect(suggestItem(v("บน", "5490"), masters.items)).toBe("");
  });

  it("checks a bill's picks before it is queued", () => {
    const bill = { invoice: "ต26102811012580", liters: 20, price: 0, amount: 700 };
    const pick = { supplier: "บ015", item: "70-1826" };
    expect(checkExpressPick(pick, bill, masters)).toEqual({
      order: { supplier: "บ015", item: masters.items[0], dep: "03", invoice: "26102811012580", price: 35 },
    });
    // the department always comes from the item; a sent one is ignored
    expect(checkExpressPick({ ...pick, dep: "07" } as typeof pick, { ...bill, price: 34.99 }, masters)).toMatchObject({ order: { dep: "03", price: 34.99 } });
    expect(checkExpressPick(pick, bill, null)).toHaveProperty("error");
    expect(checkExpressPick(pick, bill, { ...masters, writer: false })).toEqual({ error: "การสั่งเปิดใน Express ยังไม่เปิดใช้" });
    expect(checkExpressPick({ ...pick, supplier: "X" }, bill, masters)).toEqual({ error: "เลือกปั๊ม (ผู้จำหน่ายใน Express)" });
    expect(checkExpressPick({ ...pick, item: "X" }, bill, masters)).toEqual({ error: "เลือกรหัสรถใน Express" });
    expect(checkExpressPick(pick, { ...bill, invoice: "" }, masters)).toHaveProperty("error");
    expect(checkExpressPick(pick, { ...bill, liters: 0 }, masters)).toEqual({ error: "ต้องกรอกจำนวนลิตร" });
    const noDep = { ...masters, items: [item("70-1826", "x", { depCode: "" })] };
    expect(checkExpressPick(pick, bill, noDep)).toEqual({ error: "รหัสรถนี้ไม่มีแผนกใน Express" });
  });
});
