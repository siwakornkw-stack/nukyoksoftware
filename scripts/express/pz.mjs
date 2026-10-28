// Plans the PZ (PZ-จ่ายชำระหนี้-น้ำมัน) that pays one PK's R3 from the transfer
// slip uploaded on the web (one slip per bill, the owner's choice 2026-10-28).
// It is keyed the way staff key the PA payments of R3s (PA691022-02: same rows,
// the PZ book instead of PA):
//   APTRN    RECTYP 9, number PZ<BEyymmdd>-NN, REFNUM = the PK, paid by transfer
//            (CHQPAY = RCVAMT = CHQPAS = amount, CMPLAPP Y)
//   APRCPIT  the R3 it pays;  APRCPCQ  the bank's payment type ("B2" + PZ no)
//   journal 03 Dr the account the R3 credited (ISRUN R3, 2111-02; the PZ book's
//            own 1111-16 is for the old RO fuel credit) / Cr the bank's account
//   the R3   PAYAMT, REMAMT 0, CMPLAPP Y, CMPLDAT (nothing else changes on it)
//   APMAS.BALANCE -= amount, APBAL PS<k>[NY] += amount
// Pure planning from parsed Express rows; the write is pz-write.ps1.
import { balanceColumn, R3_DEFAULTS } from "./r3.mjs";

const r2 = (n) => Math.round(n * 100) / 100;

// "2026-10-28" -> "PZ691028-"
export function pzPrefix(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `PZ${String(Number(y) + 543).slice(-2)}${m}${d}-`;
}

// The bank accounts payments go out of: ISRUN payment types (ZP) whose account
// is a bank account in BKMAS, named from GLACC ("ออมทรัพย์-ธ.ไทยพาณิชย์ 826-8").
export function buildBanks({ isrun, bkmas, glacc }) {
  const accounts = new Set(bkmas.map((b) => b.ACCNUM).filter(Boolean));
  return isrun
    .filter((r) => r.DOCTYP === "ZP" && accounts.has(r.ACCNUM01))
    .map((r) => ({ code: r.PREFIX, name: r.POSDES, account: r.ACCNUM01, accountName: glacc.find((a) => a.ACCNUM === r.ACCNUM01)?.ACCNAM || "" }));
}

// The creditor the R3s are owed to, as the web shows it next to the slip's payee.
export function r3Creditor(apmas, code = R3_DEFAULTS.supCode) {
  const s = apmas.find((x) => x.SUPCOD === code);
  return s ? { code, name: `${s.PRENAM} ${s.SUPNAM}`.trim() } : null;
}

// pay: { id, pkNo, r3No, date, amount, payType, ref } (GET /api/cron/express-pz)
export function planPz(pay, { aptrn, aprcpit, apmas, isrun, isprd }, opts = {}) {
  const o = { supCode: R3_DEFAULTS.supCode, user: R3_DEFAULTS.user, ...opts };
  const r3 = aptrn.find((r) => r.RECTYP === "3" && r.DOCNUM === pay.r3No && r.DOCSTAT !== "C");
  if (!r3) return { status: "error", reason: `ไม่พบ ${pay.r3No} ใน Express` };
  if (r3.SUPCOD !== o.supCode) return { status: "error", reason: `${pay.r3No} ไม่ใช่หนี้ของเจ้าหนี้ ${o.supCode}` };

  // Already paid by a PZ (an earlier run whose answer was lost, or staff): done.
  const payments = new Set(aptrn.filter((r) => r.RECTYP === "9" && r.DOCSTAT !== "C").map((r) => r.DOCNUM));
  const paidBy = aprcpit.filter((i) => i.DOCNUM === pay.r3No && payments.has(i.RCPNUM));
  const pz = paidBy.find((i) => i.RCPNUM.startsWith("PZ"));
  if (pz) return { status: "exists", pzNo: pz.RCPNUM };
  if (!(r3.REMAMT > 0)) return { status: "error", reason: `${pay.r3No} จ่ายแล้วใน Express (${paidBy.map((i) => i.RCPNUM).join(", ") || "ไม่มียอดค้าง"})` };
  if (r2(pay.amount) !== r2(r3.REMAMT)) return { status: "error", reason: `ยอดในสลิป ${r2(pay.amount)} ไม่เท่ากับยอดค้างของ ${pay.r3No} (${r2(r3.REMAMT)})` };
  if (pay.date < r3.DOCDAT) return { status: "error", reason: `วันที่โอน ${pay.date} อยู่ก่อนวันที่ของ ${pay.r3No} (${r3.DOCDAT})` };

  const sup = apmas.find((s) => s.SUPCOD === o.supCode);
  if (!sup) return { status: "error", reason: `ไม่พบเจ้าหนี้ ${o.supCode}` };
  const book = isrun.find((r) => r.DOCTYP === "PS" && r.PREFIX === "PZ");
  if (!book) return { status: "error", reason: "ไม่พบเล่ม PZ-จ่ายชำระหนี้-น้ำมัน ใน ISRUN" };
  const bank = isrun.find((r) => r.DOCTYP === "ZP" && r.PREFIX === pay.payType);
  if (!bank?.ACCNUM01) return { status: "error", reason: `ไม่พบประเภทการจ่าย ${pay.payType} ใน Express` };
  const drAcc = isrun.find((r) => r.DOCTYP === "RR" && r.PREFIX === "R3")?.ACCNUM01;
  if (!drAcc) return { status: "error", reason: "ไม่พบบัญชีเจ้าหนี้ของ R3 ใน ISRUN" };
  const col = balanceColumn(isprd, pay.date, "PS");
  if (col.error) return { status: "error", reason: col.error };

  return {
    status: "ready",
    paymentId: pay.id,
    pkNo: pay.pkNo,
    r3No: pay.r3No,
    date: pay.date,
    prefix: pzPrefix(pay.date),
    supCode: o.supCode,
    amount: r2(pay.amount),
    payType: pay.payType,
    refnum: pay.pkNo, // like the R3: the PK in "เลขที่บิล"
    youref: (pay.ref ? `โอน ${pay.ref}` : `เบิกคืนน้ำมัน ${pay.pkNo}`).slice(0, 30),
    // ISRUN PZ JNLEXP "'ชำระหนี้ให้   ' + (APMAS->PRENAM - ' ' - APMAS->SUPNAM)", as Express writes it
    glDescr: `ชำระหนี้ให้   ${sup.PRENAM} ${sup.SUPNAM}`.slice(0, 50),
    jnlTyp: book.JNLTYP || "03",
    drAcc,
    crAcc: bank.ACCNUM01,
    balColumn: col.column,
    user: o.user,
  };
}
