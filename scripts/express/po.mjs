// Express purchase orders (ใบสั่งซื้อ) -> plain objects for /api/cron/express-po.
// Tables: POPR (header), POPRIT (lines), APMAS (suppliers), ISTAB (code
// tables: 20 = units, 50 = departments), ISINFO (company letterhead).
import { createHash } from "crypto";
import path from "path";
import { readDbf } from "./dbf.mjs";

const round = (n, d = 2) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;

// Build every PO from already-parsed table rows (kept separate from file IO so
// tests can feed rows directly).
export function buildPurchaseOrders({ popr, poprit, apmas, istab }) {
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
    }),
    company: companyFromIsinfo(table(dir, "ISINFO")),
  };
}
