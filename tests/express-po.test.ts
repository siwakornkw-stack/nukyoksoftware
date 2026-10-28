import { describe, expect, it } from "vitest";
// plain .mjs shared with the office-PC sync script
import { parseDbf } from "../scripts/express/dbf.mjs";
// plain .mjs shared with the office-PC sync script
import { buildPurchaseOrders } from "../scripts/express/po.mjs";
import { contentHash, effectiveApproval, firstR3, poSchema, r3State } from "@/lib/po/purchase-orders";

describe("effective approval", () => {
  it("treats a fully received PO as approved unless someone decided otherwise", () => {
    const po = { PoNo: "PO6900123" };
    expect(effectiveApproval({ ...po, ApprovalStatus: null, DocStat: "N" })).toBe("pending");
    expect(effectiveApproval({ ...po, ApprovalStatus: null, DocStat: "M" })).toBe("auto");
    expect(effectiveApproval({ ...po, ApprovalStatus: "rejected", DocStat: "M" })).toBe("rejected");
    expect(effectiveApproval({ ...po, ApprovalStatus: "approved", DocStat: "N" })).toBe("approved");
    expect(effectiveApproval({ ...po, ApprovalStatus: null, DocStat: "C" })).toBe("none");
    expect(effectiveApproval({ ...po, ApprovalStatus: null, DocStat: "N", MissingInExpress: true })).toBe("none");
  });

  it("leaves a received PK waiting for the admin (that approval writes its R3)", () => {
    expect(effectiveApproval({ PoNo: "PK0000002", ApprovalStatus: null, DocStat: "M" })).toBe("pending");
    expect(effectiveApproval({ PoNo: "PK0000002", ApprovalStatus: "approved", DocStat: "M" })).toBe("approved");
    expect(effectiveApproval({ PoNo: "PK0000002", ApprovalStatus: null, DocStat: "C" })).toBe("none");
  });
});

// Builds a tiny Visual FoxPro table: fields [name, type, len], rows of raw values.
function dbf(fields: [string, string, number][], rows: (string | number)[][], deleted: number[] = []) {
  const headerLen = 32 + fields.length * 32 + 1;
  const recLen = 1 + fields.reduce((s, f) => s + f[2], 0);
  const buf = Buffer.alloc(headerLen + rows.length * recLen + 1, 0x20);
  buf.fill(0, 0, headerLen);
  buf[0] = 0x30;
  buf.writeUInt32LE(rows.length, 4);
  buf.writeUInt16LE(headerLen, 8);
  buf.writeUInt16LE(recLen, 10);
  fields.forEach(([name, type, len], i) => {
    const p = 32 + i * 32;
    buf.write(name, p, "latin1");
    buf[p + 11] = type.charCodeAt(0);
    buf[p + 16] = len;
  });
  buf[headerLen - 1] = 0x0d;
  rows.forEach((r, i) => {
    const start = headerLen + i * recLen;
    buf[start] = deleted.includes(i) ? 0x2a : 0x20;
    let off = start + 1;
    fields.forEach(([, type, len], j) => {
      const v = r[j];
      if (type === "B") buf.writeDoubleLE(Number(v), off);
      else Buffer.from(new TextEncoder().encode(String(v))).copy(buf, off); // ASCII only in these fixtures
      off += len;
    });
  });
  return buf;
}

describe("Express DBF reader", () => {
  it("reads text, dates, numbers and doubles, skipping deleted rows", () => {
    const rows = parseDbf(
      dbf(
        [["PONUM", "C", 12], ["PODAT", "D", 8], ["PAYTRM", "N", 3], ["NETAMT", "B", 8]],
        [["PO6800001", "20250109", " 30", 49220], ["PO6800002", "        ", "  0", 1.5]],
        [1]
      )
    );
    expect(rows).toEqual([{ PONUM: "PO6800001", PODAT: "2025-01-09", PAYTRM: 30, NETAMT: 49220 }]);
  });
});

describe("purchase orders", () => {
  const tables = {
    popr: [{ PONUM: "PO1", PODAT: "2025-01-09", FLGVAT: "2", DEPCOD: "A001", SUPCOD: "S1", YOUREF: "", PAYTRM: 0, RCVDAT: "2025-01-09", SHIPTO: "", PLACE1: "", AMOUNT: 46000, DISC: "", DISCAMT: 0, TOTAL: 46000, VATRAT: 7, VATAMT: 3220, NETAMT: 49220, DOCSTAT: "N", CMPLDAT: null, USERID: "MILK", CHGDAT: null, AUTHID: "", APPROVE: null }],
    poprit: [
      { PONUM: "PO1", SEQNUM: "2", STKCOD: "B", STKDES: "second", LOCCOD: "-", ORDQTY: 1, CANCELQTY: 0, CANCELDAT: null, REMQTY: 1, TQUCOD: "U1", UNITPR: 1000, DISC: "", DISCAMT: 0, TRNVAL: 1000, RCVDAT: null, FREE: "" },
      { PONUM: "PO1", SEQNUM: "1", STKCOD: "A", STKDES: "first", LOCCOD: "-", ORDQTY: 1, CANCELQTY: 0, CANCELDAT: null, REMQTY: 1, TQUCOD: "U1", UNITPR: 45000, DISC: "", DISCAMT: 0, TRNVAL: 45000, RCVDAT: null, FREE: "" },
    ],
    apmas: [{ SUPCOD: "S1", PRENAM: "บริษัท", SUPNAM: "มหาคอนเทนเนอร์ จำกัด", ADDR01: "90/38", ADDR02: "", ADDR03: "", ZIPCOD: "10130", TELNUM: "034", TAXID: "011", ORGNUM: 542, REMARK: "bank" }],
    istab: [
      { TABTYP: "20", TYPCOD: "U1", SHORTNAM: "ตู้", TYPDES: "ตู้" },
      { TABTYP: "50", TYPCOD: "A001", SHORTNAM: "ทรัพย์สิน", TYPDES: "ทรัพย์สิน" },
    ],
  };

  it("joins lines (in sequence), supplier, unit and department names", () => {
    const [po] = buildPurchaseOrders(tables);
    expect(poSchema.safeParse(po).success).toBe(true);
    expect(po.supplier.name).toBe("บริษัท มหาคอนเทนเนอร์ จำกัด");
    expect(po.supplier.branch).toBe("542");
    expect(po.depName).toBe("ทรัพย์สิน");
    expect(po.lines.map((l: { code: string }) => l.code)).toEqual(["A", "B"]);
    expect(po.lines[0].unit).toBe("ตู้");
  });

  it("links Express purchase documents that reference the PO, and finds its R3", () => {
    const aptrn = [
      { PONUM: "PO1", DOCNUM: "R3691013-02", DOCDAT: "2026-10-13", NETAMT: 100, DOCSTAT: "C" },
      { PONUM: "PO1", DOCNUM: "R3691013-01", DOCDAT: "2026-10-13", NETAMT: 25520, DOCSTAT: "N" },
      { PONUM: "", DOCNUM: "R3691012-01", DOCDAT: "2026-10-12", NETAMT: 1, DOCSTAT: "N" },
    ];
    const [po] = buildPurchaseOrders({ ...tables, aptrn });
    const parsed = poSchema.parse(po);
    expect(parsed.receipts.map((r) => r.docNo)).toEqual(["R3691013-01", "R3691013-02"]);
    expect(firstR3(parsed)).toBe("R3691013-01"); // the cancelled one never counts
    expect(firstR3(poSchema.parse({ ...po, receipts: undefined }))).toBeNull(); // data synced before receipts existed
  });

  it("finds a PO's part of the day's R3 through the H3 named at the end of its lines", () => {
    const aptrn = [
      { PONUM: "PO1", DOCNUM: "H3691013-04", DOCDAT: "2026-10-13", NETAMT: 1004.67, DOCSTAT: "N", REFNUM: "" },
      { PONUM: "", DOCNUM: "R3691013-01", DOCDAT: "2026-10-13", NETAMT: 29524.67, DOCSTAT: "N", REFNUM: "" },
    ];
    const stcrd = [
      { DOCNUM: "R3691013-01", STKDES: "81-2458", TRNVAL: 3000 },
      { DOCNUM: "R3691013-01", STKDES: "81-1477 /H3691013-04", TRNVAL: 1004.67 },
      { DOCNUM: "H3691013-04", STKDES: "ค่าน้ำมัน", TRNVAL: 1004.67 },
    ];
    const [po] = buildPurchaseOrders({ ...tables, aptrn, stcrd });
    const parsed = poSchema.parse(po);
    expect(parsed.receipts).toEqual([
      { docNo: "H3691013-04", date: "2026-10-13", netAmt: 1004.67, docStat: "N" },
      { docNo: "R3691013-01", date: "2026-10-13", netAmt: 1004.67, docStat: "N" }, // its own line, not the whole R3
    ]);
    expect(firstR3(parsed)).toBe("R3691013-01");
  });

  it("asks for an R3 only on approved PK orders", () => {
    expect(r3State({ PoNo: "PK0000001", ApprovalStatus: "approved", R3DocNo: null })).toEqual({ state: "queued" });
    expect(r3State({ PoNo: "PK0000001", ApprovalStatus: null, R3DocNo: null })).toBeNull();
    expect(r3State({ PoNo: "PK0000001", ApprovalStatus: "approved", R3DocNo: "R3691013-01" })).toEqual({ state: "opened", docNo: "R3691013-01" });
    expect(r3State({ PoNo: "PO0000001", ApprovalStatus: "approved", R3DocNo: null })).toBeNull();
  });

  it("cuts over-long text instead of blanking it", () => {
    const [po] = buildPurchaseOrders(tables);
    const parsed = poSchema.parse({ ...po, yourRef: "x".repeat(250) });
    expect(parsed.yourRef).toBe("x".repeat(200));
  });

  it("keeps an approval when goods arrive but not when prices change", () => {
    const [po] = buildPurchaseOrders(tables);
    const before = contentHash(poSchema.parse(po));
    const received = { ...po, docStat: "M", completeDate: "2025-02-01", lines: po.lines.map((l: object) => ({ ...l, remainQty: 0 })) };
    expect(contentHash(poSchema.parse(received))).toBe(before);
    const repriced = { ...po, lines: po.lines.map((l: object, i: number) => (i ? l : { ...l, price: 44000 })) };
    expect(contentHash(poSchema.parse(repriced))).not.toBe(before);
  });
});
