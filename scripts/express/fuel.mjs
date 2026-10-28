// Plans the PK (ใบสั่งซื้อ-น้ำมัน(ใหม่)) and the H3 (ซื้อสดด้วยบัตร) Express needs
// for one fuel bill saved on the web, the way staff key them (every PP since
// July 2026 is one bill, one line, VAT included; it is received by an H3 with
// the tax invoice in "เลขที่บิล"). The PK is written when the bill is saved, the
// H3 once an admin approved the PK (stage "pk" / "h3"):
//   PK  POPR + POPRIT, number from ISRUN (PK0000001…), STMAS TOTREO += litres
//   H3  APTRN (number H3<BEyymmdd>-NN like staff use), STCRD line linked to the
//       PK line, journal 03 Dr 5110-04 (dep) / Dr 1164-01 VAT (dep) / Cr 2120-03,
//       ISVAT input-VAT row, APRCPCQ payment, PK closed (M, REMQTY 0),
//       STMAS TOTREO -= litres, supplier LASRCV and APBAL HP<period> += total.
// Pure planning from parsed Express rows; the write is fuel-write.ps1.
import { balanceColumn } from "./r3.mjs";

const r2 = (n) => Math.round(n * 100) / 100;

// "2026-10-28" -> "H3691028-"
export function h3Prefix(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `H3${String(Number(y) + 543).slice(-2)}${m}${d}-`;
}

// Line maths as staff key it: litres x pump price, the rounding difference down
// to the paid total booked as a discount (never negative: 0 of 72 October lines).
export function lineAmounts(liters, price, total) {
  let p = price > 0 ? price : r2(total / liters);
  if (r2(liters * p) < total) p = Math.ceil((total / liters) * 100) / 100;
  const disc = r2(liters * p - total);
  const vat = r2((total * 7) / 107);
  const net = r2(total - vat);
  return { price: p, disc, total: r2(total), vat, net, xunit: r2(net / liters) };
}

// order: { id, stage, pkNo, withH3, supplier, item, dep, date, invoice, liters, price, amount }
// stage "pk" (when the bill is saved): the PK only. stage "h3" (once an admin
// approved that PK, order.pkNo): its H3. An order without a stage is both at once.
export function planFuel(order, tables, user = "WEB") {
  if (order.stage === "pk") return planStage({ ...order, withH3: false }, tables, user, "");
  if (order.stage === "h3") {
    const pk = tables.popr.find((p) => p.PONUM === order.pkNo && p.DOCSTAT !== "C");
    if (!pk) return { status: "error", reason: `ไม่พบ ${order.pkNo} ใน Express` };
    const item = tables.stmas.find((s) => s.STKCOD === order.item);
    if (item && item.STKTYP !== "5") return { status: "error", reason: `${order.item} เป็นสินค้าคงคลัง H3 ต้องคีย์ใน Express เอง` };
    return planStage({ ...order, withH3: true }, tables, user, pk.PONUM);
  }
  return planStage(order, tables, user, "");
}

function planStage(order, { popr, poprit, stmas, apmas, aptrn, isprd, isrun }, user, knownPk) {
  const sup = apmas.find((s) => s.SUPCOD === order.supplier);
  if (!sup) return { status: "error", reason: `ไม่พบผู้จำหน่าย ${order.supplier} ใน Express` };
  const item = stmas.find((s) => s.STKCOD === order.item);
  if (!item) return { status: "error", reason: `ไม่พบรหัสรถ ${order.item} ใน Express` };
  if (!(order.liters > 0) || !(order.amount > 0)) return { status: "error", reason: "ลิตรหรือยอดเงินเป็นศูนย์" };
  if (!order.invoice) return { status: "error", reason: "ไม่มีเลขที่ใบกำกับภาษี" };
  if (order.price > 0 && Math.abs(order.liters * order.price - order.amount) > 1) {
    return { status: "error", reason: `ลิตร × ราคาต่อลิตร (${r2(order.liters * order.price)}) ไม่ตรงกับยอดเงิน (${order.amount})` };
  }

  // Already in Express? An H3 for this tax invoice (staff may have keyed it,
  // perhaps under another branch's supplier code: then the amount must match)
  // means nothing is written at all.
  const h3 = aptrn.find(
    (r) => r.DOCNUM.startsWith("H3") && r.REFNUM === order.invoice && r.DOCSTAT !== "C" && (r.SUPCOD === order.supplier || r2(r.NETAMT) === r2(order.amount))
  );
  if (h3) return { status: "exists", pkNo: h3.PONUM || knownPk, h3No: h3.DOCNUM };
  const pk = knownPk
    ? { PONUM: knownPk }
    : popr.find((p) => p.PONUM.startsWith("PK") && p.SUPCOD === order.supplier && p.PODAT === order.date && p.YOUREF === order.invoice && p.DOCSTAT !== "C");
  const withH3 = order.withH3 && item.STKTYP === "5";
  if (pk && !withH3) return { status: "exists", pkNo: pk.PONUM, h3No: "" };

  const a = lineAmounts(order.liters, order.price, order.amount);
  const run = isrun.find((r) => r.DOCTYP === "HP" && r.PREFIX === "H3");
  if (withH3 && (!run?.ACCNUM01 || !run?.ACCNUM02 || !run?.ACCNUM04)) return { status: "error", reason: "ไม่พบบัญชีของ H3 ใน ISRUN" };
  const hp = withH3 ? balanceColumn(isprd, order.date, "HP") : { column: "" };
  if (hp.error) return { status: "error", reason: hp.error };
  if (!pk && !isrun.some((r) => r.DOCTYP === "PO" && r.PREFIX === "PK")) return { status: "error", reason: "ไม่พบเลขรันของ PK ใน ISRUN" };

  return {
    status: "ready",
    orderId: order.id,
    date: order.date,
    invoice: order.invoice,
    user,
    pkNo: pk?.PONUM || "", // existing PK: only the H3 is written
    withH3,
    h3Prefix: h3Prefix(order.date),
    supplier: { code: sup.SUPCOD, name: sup.SUPNAM, prenam: sup.PRENAM, taxId: sup.TAXID, branch: Number(sup.ORGNUM) || 0 },
    item: { code: item.STKCOD, desc: item.STKDES, unit: item.PQUCOD || "ลต" },
    dep: order.dep,
    qty: order.liters,
    ...a,
    accounts: withH3 ? { expense: run.ACCNUM01, vat: run.ACCNUM02, pay: run.ACCNUM04 } : null,
    hpColumn: hp.column,
    glDescr: `${sup.SUPNAM}:`.slice(0, 50), // ISRUN H3 JNLEXP "APMAS->SUPNAM -':'-APTRN->YOUREF", YOUREF empty
  };
}
