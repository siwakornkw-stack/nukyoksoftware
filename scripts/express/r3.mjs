// Plans the R3 (ตั้งหนี้บัตรเครดิต) Express needs for an approved PK, exactly as
// the office keys it by hand (reference R30000001 in the TESTR3 copy and the
// daily R3YYMMDD-NN documents): creditor 0009, one R3 per bill date, one line
// per fuel line of the PK's H3 (cash purchase on the card), item 2120-03,
// described "<vehicle> /<H3 no>", no VAT; journal 04 Dr 2120-03 / Cr 2111-02;
// the creditor's balance and period purchases go up by the amount.
//
// Pure planning: reads already-parsed Express rows, writes nothing. The write
// itself is r3-write.ps1 (VFP OLE DB): a new R3, or lines added to the day's.

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

// The H3 an R3 line was taken from: the office ends the line "<vehicle> /<H3 no>"
// (266 of 327 R3 lines since Sep 2026), and so do we.
export function h3Ref(desc) {
  const m = /\/\s*(H3[\w-]+)\s*$/.exec(desc || "");
  return m ? m[1] : "";
}

// Where an approved PK's H3 goes: the R3 of the bill's date, the way the office
// keeps them since Sep 2026 (one R3 per day for creditor 0009). While that R3
// is unpaid the H3 is added to it: lines appended, its totals, the two journal
// lines (Dr 2120-03 / Cr 2111-02), the creditor balance and period purchases
// raised by the amount. With no such R3 a new R3<BEyymmdd>-NN is opened. An H3
// already on an R3 line is not added again; an unreferenced line of the same
// amount in the day's R3 may be this very bill keyed by hand, so that waits for
// a person (opts.force after they confirm it is not).
export function planR3({ pkNo, aptrn, stcrd, apmas, isprd, isrun }, opts = {}) {
  const o = { ...R3_DEFAULTS, force: false, ...opts };
  // Written per PK until 2026-10-28: the PK number in REFNUM.
  const own = aptrn.find((r) => r.RECTYP === "3" && r.DOCNUM.startsWith("R3") && r.REFNUM === pkNo && r.DOCSTAT !== "C");
  if (own) return { status: "exists", docNo: own.DOCNUM };

  const h3 = aptrn.filter((r) => r.PONUM === pkNo && r.DOCNUM.startsWith("H3") && r.DOCSTAT !== "C" && r.NETAMT > 0);
  if (!h3.length) return { status: "waiting", reason: "ยังไม่มี H3 ที่อ้างถึงใบนี้ใน Express" };

  const r3s = new Map(aptrn.filter((r) => r.RECTYP === "3" && r.DOCNUM.startsWith("R3") && r.DOCSTAT !== "C").map((r) => [r.DOCNUM, r]));
  const r3Lines = stcrd.filter((s) => r3s.has(s.DOCNUM));
  const onR3 = new Map(r3Lines.filter((s) => h3Ref(s.STKDES)).map((s) => [h3Ref(s.STKDES), s.DOCNUM]));
  const todo = h3.filter((h) => !onR3.has(h.DOCNUM)).sort((a, b) => a.DOCNUM.localeCompare(b.DOCNUM));
  if (!todo.length) return { status: "exists", docNo: onR3.get(h3[0].DOCNUM) };
  const dates = [...new Set(todo.map((h) => h.DOCDAT))];
  if (dates.length > 1) return { status: "error", reason: `H3 ของ ${pkNo} มีหลายวันที่ (${dates.join(", ")}) ต้องทำ R3 ใน Express เอง` };
  const date = dates[0];

  const lines = [];
  for (const h of todo) {
    const its = stcrd.filter((s) => s.DOCNUM === h.DOCNUM).sort((a, b) => Number(a.SEQNUM) - Number(b.SEQNUM));
    if (!its.length) return { status: "error", reason: `H3 ${h.DOCNUM} ไม่มีรายการสินค้า` };
    const amounts = allocate(h.NETAMT, its.map((s) => s.TRNVAL));
    its.forEach((s, i) => lines.push({ desc: `${s.STKCOD} /${h.DOCNUM}`.slice(0, 50), amount: amounts[i], from: h.DOCNUM }));
  }

  const total = round2(lines.reduce((a, l) => a + l.amount, 0));
  const sup = apmas.find((s) => s.SUPCOD === o.supCode);
  if (!sup) return { status: "error", reason: `ไม่พบผู้จำหน่าย ${o.supCode}` };
  const run = isrun.find((r) => r.DOCTYP === "RR" && r.PREFIX === "R3");
  const crAcc = run?.ACCNUM01;
  if (!crAcc) return { status: "error", reason: "ไม่พบบัญชีเครดิตของ R3 ใน ISRUN" };
  const col = balanceColumn(isprd, date, "RR");
  if (col.error) return { status: "error", reason: col.error };
  const common = { status: "ready", pkNo, date, supCode: o.supCode, unit: o.unit, item: o.item, drAcc: o.drAcc, crAcc, balColumn: col.column, user: o.user, total, lines, h3: todo.map((h) => h.DOCNUM) };

  // The day's R3: this creditor's, nothing of it paid, and not one written for a single PK.
  const day = [...r3s.values()]
    .filter((r) => r.DOCDAT === date && r.SUPCOD === o.supCode && !/^PK\d+$/.test(r.REFNUM) && !(r.PAYAMT > 0) && round2(r.REMAMT) === round2(r.NETAMT))
    .sort((a, b) => a.DOCNUM.localeCompare(b.DOCNUM))[0];
  if (day) {
    const twins = r3Lines.filter((s) => s.DOCNUM === day.DOCNUM && !h3Ref(s.STKDES) && lines.some((l) => round2(s.TRNVAL) === l.amount));
    if (twins.length && !o.force) {
      return {
        status: "error",
        duplicate: true,
        reason:
          `อาจซ้ำ: ${day.DOCNUM} มีบรรทัด ${twins.map((s) => `"${s.STKDES}" ${s.TRNVAL}`).join(", ")} ยอดเท่ากับบิลนี้ ` +
          `ถ้าเป็นบิลเดียวกัน ให้เติม " /${todo[0].DOCNUM}" ท้ายบรรทัดนั้นใน Express แล้วกดลองใหม่ ถ้าไม่ใช่ ให้กด "ยืนยันว่าไม่ซ้ำ"`,
      };
    }
    return { ...common, mode: "append", docNo: day.DOCNUM };
  }
  const { prefix, youref } = r3Naming(date);
  // GL description is ISRUN JNLEXP "APMAS->SUPNAM -':'-APTRN->YOUREF", cut to 50.
  return { ...common, mode: "new", prefix, youref, glDescr: `${sup.SUPNAM}:${youref}`.slice(0, 50) };
}
