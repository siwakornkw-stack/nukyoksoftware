import { describe, expect, it } from "vitest";
// plain .mjs shared with the office-PC scripts
import { buildBanks, planPz, pzPrefix, r3Creditor } from "../scripts/express/pz.mjs";
import { matchBank, samePayee } from "@/lib/po/pz-match";
import { checkPayment } from "@/lib/po/pz";

const isprd = [{ BEG1NY: "2021-01-01", END1NY: "2027-01-31", LOCK1NY: "N", BEG2NY: "2027-02-01", END2NY: "2027-02-28", LOCK2NY: "Y" }];
const isrun = [
  { DOCTYP: "PS", PREFIX: "PZ", POSDES: "PZ-จ่ายชำระหนี้-น้ำมัน", JNLTYP: "03", ACCNUM01: "1111-16" },
  { DOCTYP: "RR", PREFIX: "R3", POSDES: "R3-ตั้งหนี้ (บัตรเครดิต)", ACCNUM01: "2111-02" },
  { DOCTYP: "ZP", PREFIX: "B2", POSDES: "ไทยพาณิชย์#8268", ACCNUM01: "1112-02" },
  { DOCTYP: "ZP", PREFIX: "BA", POSDES: "กสิกรไทย #0293", ACCNUM01: "1112-01" },
  { DOCTYP: "ZP", PREFIX: "BB", POSDES: "กสิกรไทย #4500", ACCNUM01: "1113-01" },
  { DOCTYP: "ZP", PREFIX: "P7", POSDES: "จ่ายล่วงหน้า-น้ำมัน", ACCNUM01: "1161-07" },
];
const banks = buildBanks({
  isrun,
  bkmas: [{ ACCNUM: "1112-01" }, { ACCNUM: "1112-02" }, { ACCNUM: "1113-01" }],
  glacc: [
    { ACCNUM: "1112-01", ACCNAM: "ออมทรัพย์-ธ.กสิกรไทย 033-1-21029-3" },
    { ACCNUM: "1112-02", ACCNAM: "ออมทรัพย์-ธ.ไทยพาณิชย์ 826-8" },
    { ACCNUM: "1113-01", ACCNAM: "กระแสรายวัน-ธ.กสิกรไทย 044-849-4500" },
  ],
});
const apmas = [{ SUPCOD: "0009", PRENAM: "นาย", SUPNAM: "สุพัฒน์พงศ์  เทวาวณิชกิจ" }];

const tables = (extra: Record<string, unknown[]> = {}) => ({
  aptrn: [
    { RECTYP: "3", DOCNUM: "R3691028-01", DOCDAT: "2026-10-28", SUPCOD: "0009", REFNUM: "PK0000002", NETAMT: 1004.67, REMAMT: 1004.67, DOCSTAT: "N" },
    { RECTYP: "3", DOCNUM: "R3690829-01", DOCDAT: "2026-08-29", SUPCOD: "0009", REFNUM: "", NETAMT: 39900, REMAMT: 0, DOCSTAT: "N" },
    { RECTYP: "9", DOCNUM: "PA691022-02", DOCDAT: "2026-10-22", SUPCOD: "0009", NETAMT: 131440, DOCSTAT: "M" },
  ],
  aprcpit: [{ RCPNUM: "PA691022-02", DOCNUM: "R3690829-01", PAYAMT: 39900 }],
  apmas,
  isrun,
  isprd,
  ...extra,
});
const pay = (o: Record<string, unknown> = {}) => ({ id: "p1", pkNo: "PK0000002", r3No: "R3691028-01", date: "2026-10-28", amount: 1004.67, payType: "B2", ref: "TRBS261028000001", ...o });

describe("PZ plan (paying a PK's R3 from a transfer slip)", () => {
  it("numbers the PZ by the transfer date like staff do", () => {
    expect(pzPrefix("2026-10-28")).toBe("PZ691028-");
  });

  it("lists the bank accounts payments go out of, and the R3 creditor", () => {
    expect(banks).toEqual([
      { code: "B2", name: "ไทยพาณิชย์#8268", account: "1112-02", accountName: "ออมทรัพย์-ธ.ไทยพาณิชย์ 826-8" },
      { code: "BA", name: "กสิกรไทย #0293", account: "1112-01", accountName: "ออมทรัพย์-ธ.กสิกรไทย 033-1-21029-3" },
      { code: "BB", name: "กสิกรไทย #4500", account: "1113-01", accountName: "กระแสรายวัน-ธ.กสิกรไทย 044-849-4500" },
    ]);
    expect(r3Creditor(apmas)).toEqual({ code: "0009", name: "นาย สุพัฒน์พงศ์  เทวาวณิชกิจ" });
  });

  it("plans the PZ: Dr the R3's account, Cr the bank, PK in REFNUM", () => {
    expect(planPz(pay(), tables())).toEqual({
      status: "ready",
      paymentId: "p1",
      pkNo: "PK0000002",
      r3No: "R3691028-01",
      date: "2026-10-28",
      prefix: "PZ691028-",
      supCode: "0009",
      amount: 1004.67,
      payType: "B2",
      refnum: "PK0000002",
      youref: "โอน TRBS261028000001",
      glDescr: "ชำระหนี้ให้   นาย สุพัฒน์พงศ์  เทวาวณิชกิจ",
      jnlTyp: "03",
      drAcc: "2111-02",
      crAcc: "1112-02",
      balColumn: "PS1NY",
      user: "WEB",
    });
    expect(planPz(pay({ ref: "" }), tables()).youref).toBe("เบิกคืนน้ำมัน PK0000002");
  });

  it("does not pay an R3 twice", () => {
    const paid = tables({
      aptrn: [...tables().aptrn, { RECTYP: "9", DOCNUM: "PZ691028-01", DOCDAT: "2026-10-28", SUPCOD: "0009", DOCSTAT: "M" }],
      aprcpit: [...tables().aprcpit, { RCPNUM: "PZ691028-01", DOCNUM: "R3691028-01", PAYAMT: 1004.67 }],
    });
    expect(planPz(pay(), paid)).toEqual({ status: "exists", pzNo: "PZ691028-01" });
    // paid by staff with a PA: refused, not paid again
    expect(planPz(pay({ r3No: "R3690829-01", amount: 39900, date: "2026-10-28" }), tables()).reason).toMatch(/จ่ายแล้ว.*PA691022-02/);
  });

  it("refuses what does not match Express", () => {
    expect(planPz(pay({ r3No: "R3000000-01" }), tables()).reason).toMatch(/ไม่พบ/);
    expect(planPz(pay({ amount: 1000 }), tables()).reason).toMatch(/ไม่เท่ากับยอดค้าง/);
    expect(planPz(pay({ date: "2026-10-27" }), tables()).reason).toMatch(/ก่อนวันที่/);
    expect(planPz(pay({ payType: "ZZ" }), tables()).reason).toMatch(/ประเภทการจ่าย/);
    expect(planPz(pay({ date: "2027-02-10" }), tables()).reason).toMatch(/ปิดแล้ว/);
    expect(planPz(pay(), tables({ isrun: isrun.filter((r) => r.PREFIX !== "PZ") })).reason).toMatch(/เล่ม PZ/);
  });
});

describe("transfer slips on the web", () => {
  it("finds the paying bank account from the digits the slip shows", () => {
    expect(matchBank("xxx-x-x1029-x", banks)).toBe("BA"); // K-BIZ
    expect(matchBank("XXX-XXX826-8", banks)).toBe("B2"); // SCB payment advice
    expect(matchBank("044-849-4500", banks)).toBe("BB");
    expect(matchBank("x-2338", banks)).toBe("");
    expect(matchBank("xx-1", banks)).toBe(""); // too few digits to tell
  });

  it("compares the payee with the creditor, ignoring titles and spacing", () => {
    expect(samePayee("นาย สุพัฒน์พงศ์ เทวาวณิชกิจ", "นาย สุพัฒน์พงศ์  เทวาวณิชกิจ")).toBe(true);
    expect(samePayee("สุพัฒน์พงศ์ เทวาวณิชกิจ", "นาย สุพัฒน์พงศ์  เทวาวณิชกิจ")).toBe(true);
    expect(samePayee("หจก. พี พี เค บายพาส", "นาย สุพัฒน์พงศ์  เทวาวณิชกิจ")).toBe(false);
    expect(samePayee("", "นาย สุพัฒน์พงศ์")).toBe(false);
  });

  it("checks a payment against the PK and its R3 before queuing", () => {
    const po = {
      PoNo: "PK0000002",
      ApprovalStatus: "approved",
      MissingInExpress: false,
      R3DocNo: "R3691028-01",
      Data: { receipts: [{ docNo: "H3691028-01", date: "2026-10-28", netAmt: 1004.67, docStat: "N" }, { docNo: "R3691028-01", date: "2026-10-28", netAmt: 1004.67, docStat: "N" }] },
    };
    const masters = { banks, pzWriter: true };
    const p = { poNo: "PK0000002", slipUrl: "/uploads/po-slips/2026-10/0b4a3f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b.jpg", amount: 1004.67, date: "2026-10-28", payType: "B2", ref: "" };
    expect(checkPayment(p, po, masters, "2026-10-28")).toEqual({ r3: { docNo: "R3691028-01", date: "2026-10-28", amount: 1004.67 } });
    expect(checkPayment(p, po, { banks, pzWriter: false }, "2026-10-28")).toEqual({ error: "การเปิด PZ จากสลิปยังไม่เปิดใช้" });
    expect(checkPayment(p, { ...po, ApprovalStatus: null }, masters, "2026-10-28")).toEqual({ error: "ต้องอนุมัติ PK ก่อน" });
    expect(checkPayment(p, { ...po, R3DocNo: null }, masters, "2026-10-28")).toHaveProperty("error");
    expect(checkPayment({ ...p, amount: 1004 }, po, masters, "2026-10-28")).toHaveProperty("error");
    expect(checkPayment({ ...p, date: "2026-10-29" }, po, masters, "2026-10-28")).toEqual({ error: "วันที่โอนเป็นวันในอนาคต" });
    expect(checkPayment({ ...p, date: "2026-10-27" }, po, masters, "2026-10-28")).toHaveProperty("error");
    expect(checkPayment({ ...p, payType: "" }, po, masters, "2026-10-28")).toEqual({ error: "เลือกบัญชีธนาคารที่โอนออก" });
    expect(checkPayment({ ...p, slipUrl: "/uploads/fuel-bills/x.jpg" }, po, masters, "2026-10-28")).toEqual({ error: "อัปโหลดสลิปก่อน" });
  });
});
