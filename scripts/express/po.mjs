// Express purchase orders (ใบสั่งซื้อ) -> plain objects for /api/cron/express-po.
// Tables: POPR (header), POPRIT (lines), APMAS (suppliers), ISTAB (code
// tables: 20 = units, 50 = departments), ISINFO (company letterhead), APTRN
// (purchase documents: those with PONUM set were opened "อ้างถึงใบสั่งซื้อ"
// this PO, e.g. RR ซื้อเชื่อ, H3 ซื้อสดด้วยบัตร) and STCRD (the R3 lines that
// name the H3 they were taken from).
import { createHash } from "crypto";
import path from "path";
import { readDbf } from "./dbf.mjs";
import { h3Ref } from "./r3.mjs";

const round = (n, d = 2) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;

// Build every PO from already-parsed table rows (kept separate from file IO so
// tests can feed rows directly).
export function buildPurchaseOrders({ popr, poprit, apmas, istab, aptrn = /** @type {any[]} */ ([]), stcrd = /** @type {any[]} */ ([]) }) {
  const receiptsOf = new Map();
  const add = (po, r) => {
    if (!receiptsOf.has(po)) receiptsOf.set(po, []);
    receiptsOf.get(po).push(r);
  };
  const docs = new Map(aptrn.map((t) => [t.DOCNUM, t]));
  for (const t of aptrn) {
    // An R3 written for a single PK (until 2026-10-28) carries the PK number in
    // REFNUM ("เลขที่บิล") rather than PONUM.
    const po = t.PONUM || (t.DOCNUM.startsWith("R3") && /^PK\d+$/.test(t.REFNUM) ? t.REFNUM : "");
    if (po) add(po, { docNo: t.DOCNUM, date: t.DOCDAT, netAmt: round(t.NETAMT), docStat: t.DOCSTAT });
  }
  // The R3 of a day carries many bills, each line ending "/<H3>", and the H3
  // names its PO: listed with that PO's part of the R3.
  const parts = new Map();
  for (const s of stcrd) {
    if (!s.DOCNUM.startsWith("R3")) continue;
    const h3 = docs.get(h3Ref(s.STKDES)), r3 = docs.get(s.DOCNUM);
    if (!h3?.PONUM || !r3 || r3.REFNUM === h3.PONUM) continue;
    const k = `${h3.PONUM}\t${s.DOCNUM}`;
    parts.set(k, round((parts.get(k) ?? 0) + s.TRNVAL));
  }
  for (const [k, amount] of parts) {
    const [po, doc] = k.split("\t");
    const r3 = docs.get(doc);
    add(po, { docNo: doc, date: r3.DOCDAT, netAmt: amount, docStat: r3.DOCSTAT });
  }
  const units = new Map(), deps = new Map();
  for (const t of istab) {
    if (t.TABTYP === "20") units.set(t.TYPCOD, t.SHORTNAM || t.TYPDES);
    if (t.TABTYP === "50") deps.set(t.TYPCOD, t.TYPDES || t.SHORTNAM);
  }
  const sups = new Map(apmas.map((s) => [s.SUPCOD, s]));
  const linesOf = new Map();
  for (const l of poprit) {
    if (!linesOf.has(l.PONUM)) linesOf.set(l.PONUM, []);
    linesOf.get(l.PONUM).push({
      seq: Number(l.SEQNUM) || 0,
      code: l.STKCOD,
      name: l.STKDES,
      location: l.LOCCOD,
      qty: round(l.ORDQTY, 4),
      cancelQty: round(l.CANCELQTY, 4),
      cancelDate: l.CANCELDAT,
      remainQty: round(l.REMQTY, 4),
      unitCode: l.TQUCOD,
      unit: units.get(l.TQUCOD) || l.TQUCOD,
      price: round(l.UNITPR, 4),
      disc: l.DISC,
      discAmt: round(l.DISCAMT),
      amount: round(l.TRNVAL),
      receiveDate: l.RCVDAT,
      free: l.FREE === "Y",
    });
  }

  return popr.map((h) => {
    const s = sups.get(h.SUPCOD);
    const lines = (linesOf.get(h.PONUM) || []).sort((a, b) => a.seq - b.seq);
    return {
      poNo: h.PONUM,
      poDate: h.PODAT,
      vatType: h.FLGVAT, // 0 no VAT, 1 VAT included, 2 VAT added
      depCode: h.DEPCOD,
      depName: deps.get(h.DEPCOD) || "",
      supplier: {
        code: h.SUPCOD,
        name: s ? `${s.PRENAM} ${s.SUPNAM}`.trim() : h.SUPCOD,
        address: s ? [s.ADDR01, s.ADDR02, s.ADDR03].filter(Boolean).join("\n") : "",
        zip: s?.ZIPCOD || "",
        phone: s?.TELNUM || "",
        taxId: s?.TAXID || "",
        branch: s && s.ORGNUM ? String(s.ORGNUM) : "",
        remark: s?.REMARK || "",
      },
      yourRef: h.YOUREF,
      payTerm: Number(h.PAYTRM) || 0,
      receiveDate: h.RCVDAT,
      shipTo: h.SHIPTO,
      place: h.PLACE1,
      amount: round(h.AMOUNT),
      disc: h.DISC,
      discAmt: round(h.DISCAMT),
      total: round(h.TOTAL),
      vatRate: round(h.VATRAT),
      vatAmt: round(h.VATAMT),
      netAmt: round(h.NETAMT),
      docStat: h.DOCSTAT, // N open (awaiting goods), M complete, C cancelled
      completeDate: h.CMPLDAT,
      expressUser: h.USERID,
      expressChanged: h.CHGDAT,
      expressApprovedBy: h.AUTHID,
      expressApproved: h.APPROVE,
      lines,
      receipts: (receiptsOf.get(h.PONUM) || []).sort((a, b) => a.docNo.localeCompare(b.docNo)),
    };
  });
}

export function companyFromIsinfo(isinfo) {
  const c = isinfo[0];
  if (!c) return null;
  return {
    name: c.THINAM,
    address: [c.ADDR01, c.ADDR02].filter(Boolean).join("\n"),
    phone: c.TELNUM,
    taxId: c.TAXID,
  };
}

// Fingerprint of everything the sync sends for one PO: the sync script only
// sends POs whose fingerprint changed since the last run.
export function poHash(po) {
  return createHash("sha1").update(JSON.stringify(po)).digest("hex");
}

const table = (dir, name) => readDbf(path.join(dir, `${name}.DBF`));

export function readExpress(dir) {
  return {
    purchaseOrders: buildPurchaseOrders({
      popr: table(dir, "POPR"),
      poprit: table(dir, "POPRIT"),
      apmas: table(dir, "APMAS"),
      istab: table(dir, "ISTAB"),
      aptrn: table(dir, "APTRN"),
      stcrd: table(dir, "STCRD"),
    }),
    company: companyFromIsinfo(table(dir, "ISINFO")),
  };
}
