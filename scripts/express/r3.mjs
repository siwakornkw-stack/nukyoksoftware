// Plans the R3 (ตั้งหนี้บัตรเครดิต) Express needs for an approved PK, exactly as
// the office keys it by hand (reference R30000001 in the TESTR3 copy and the
// daily R3YYMMDD-NN documents): creditor 0009, one line per fuel line of the
// PK's H3 (cash purchase on the card), item 2120-03 with the vehicle code as
// description, no VAT; journal 04 Dr 2120-03 / Cr 2111-02; the creditor's
// balance and period purchases go up by the total.
//
// Pure planning: reads already-parsed Express rows, writes nothing. The write
// itself is scripts/express/r3-write.prg run by r3-write.ps1 (VFP OLE DB).

const round2 = (n) => Math.round(n * 100) / 100;

export const R3_DEFAULTS = {
  supCode: "0009", // สุพัฒน์พงศ์ เทวาวณิชกิจ (บัตรเครดิต)
  item: "2120-03",
  unit: "คง",
  drAcc: "2120-03",
  user: "WEB",
};

// "2026-10-21" -> { prefix: "R3691021-", youref: "ค่าน้ำมัน(บัตรเครดิต)21/10/69" }
export function r3Naming(isoDate) {
  const [y, m, d] = isoDate.split("-");
  const be = String(Number(y) + 543).slice(-2);
  return { prefix: `R3${be}${m}${d}-`, youref: `ค่าน้ำมัน(บัตรเครดิต)${d}/${m}/${be}` };
}

// Express keeps period totals in APBAL columns named by ISPRD: period k of this
// year (BEGk..ENDk) or of next year (BEGkNY..ENDkNY). A locked period is refused.
export function balanceColumn(isprd, isoDate, kind = "RR") {
  const p = isprd[0];
  if (!p) return { error: "ไม่พบตารางงวดบัญชี (ISPRD)" };
  for (const suffix of ["", "NY"]) {
    for (let k = 1; k <= 12; k++) {
      const beg = p[`BEG${k}${suffix}`], end = p[`END${k}${suffix}`];
      if (beg && end && beg <= isoDate && isoDate <= end) {
        if (p[`LOCK${k}${suffix}`] === "Y") return { error: `งวดบัญชีของวันที่ ${isoDate} ถูกปิดแล้ว` };
        return { column: `${kind}${k}${suffix}` };
      }
    }
  }
  return { error: `วันที่ ${isoDate} อยู่นอกงวดบัญชีของบริษัทนี้` };
}

// Split `total` over lines in proportion to `weights`, to the satang, summing exactly.
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map((_, i) => (i === weights.length - 1 ? round2(total) : 0));
  const out = weights.map((w) => round2((total * w) / sum));
  out[out.length - 1] = round2(total - out.slice(0, -1).reduce((a, b) => a + b, 0));
  return out;
}

export function planR3({ pkNo, aptrn, stcrd, apmas, isprd, isrun }, opts = {}) {
  const o = { ...R3_DEFAULTS, ...opts };
  const existing = aptrn.find((r) => r.RECTYP === "3" && r.DOCNUM.startsWith("R3") && r.REFNUM === pkNo && r.DOCSTAT !== "C");
  if (existing) return { status: "exists", docNo: existing.DOCNUM };

  const h3 = aptrn.filter((r) => r.PONUM === pkNo && r.DOCNUM.startsWith("H3") && r.DOCSTAT !== "C" && r.NETAMT > 0);
  if (!h3.length) return { status: "waiting", reason: "ยังไม่มี H3 ที่อ้างถึงใบนี้ใน Express" };

  const lines = [];
  for (const h of h3.sort((a, b) => a.DOCNUM.localeCompare(b.DOCNUM))) {
    const its = stcrd.filter((s) => s.DOCNUM === h.DOCNUM).sort((a, b) => Number(a.SEQNUM) - Number(b.SEQNUM));
    if (!its.length) return { status: "error", reason: `H3 ${h.DOCNUM} ไม่มีรายการสินค้า` };
    const amounts = allocate(h.NETAMT, its.map((s) => s.TRNVAL));
    its.forEach((s, i) => lines.push({ desc: s.STKCOD, amount: amounts[i], from: h.DOCNUM }));
  }
  if (lines.length > 999) return { status: "error", reason: "รายการเกิน 999 บรรทัด" };

  const date = h3.map((h) => h.DOCDAT).sort().at(-1);
  const total = round2(lines.reduce((a, l) => a + l.amount, 0));
  const sup = apmas.find((s) => s.SUPCOD === o.supCode);
  if (!sup) return { status: "error", reason: `ไม่พบผู้จำหน่าย ${o.supCode}` };
  const run = isrun.find((r) => r.DOCTYP === "RR" && r.PREFIX === "R3");
  const crAcc = run?.ACCNUM01;
  if (!crAcc) return { status: "error", reason: "ไม่พบบัญชีเครดิตของ R3 ใน ISRUN" };
  const col = balanceColumn(isprd, date, "RR");
  if (col.error) return { status: "error", reason: col.error };

  const { prefix, youref } = r3Naming(date);
  return {
    status: "ready",
    pkNo,
    date,
    prefix,
    supCode: o.supCode,
    youref,
    // GL description is ISRUN JNLEXP "APMAS->SUPNAM -':'-APTRN->YOUREF", cut to 50.
    glDescr: `${sup.SUPNAM}:${youref}`.slice(0, 50),
    unit: o.unit,
    item: o.item,
    drAcc: o.drAcc,
    crAcc,
    balColumn: col.column,
    user: o.user,
    total,
    lines,
    h3: h3.map((h) => h.DOCNUM),
  };
}
