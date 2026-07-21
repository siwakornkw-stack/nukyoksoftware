// Fraud detection rules (ported from โปรแกรมนำมัน/src/fraud.js). Tune to fit the fleet.
export const RULES = {
  minHoursBetween: 6, // refuels closer together than this are suspicious
  maxTotalBaht: 3000, // a single bill above this amount is suspicious
  maxLiters: 80, // more liters than a typical tank is suspicious
  mathToleranceBaht: 5, // liters x price may differ from total by this much
};

// The freshly-extracted bill being checked (numeric fields are plain numbers).
export interface BillCore {
  billDate?: string | null;
  billTime?: string | null;
  liters?: number | null;
  pricePerLiter?: number | null;
  total?: number | null;
  createdAt?: Date | string | null;
}

// A stored bill referenced for duplicate/interval checks. Only id/receipt/date
// are read, so numeric (Decimal) columns are intentionally not part of this type.
export interface RefBill {
  id?: number;
  receiptNo?: string | null;
  billDate?: string | null;
  billTime?: string | null;
  createdAt?: Date | string | null;
}

type Dated = { billDate?: string | null; billTime?: string | null; createdAt?: Date | string | null };

export function billDateTime(b: Dated): Date | null {
  if (b.billDate) {
    const dt = new Date(`${b.billDate}T${b.billTime || "00:00"}:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  if (b.createdAt) {
    const dt = b.createdAt instanceof Date ? b.createdAt : new Date(String(b.createdAt).replace(" ", "T"));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

export function checkFraud({
  bill,
  duplicateByHash,
  duplicateByReceipt,
  duplicateBill,
  lastBill,
}: {
  bill: BillCore;
  duplicateByHash?: RefBill | null;
  duplicateByReceipt?: RefBill | null;
  duplicateBill?: RefBill | null;
  lastBill?: RefBill | null;
}): string[] {
  const reasons: string[] = [];

  if (duplicateByHash) {
    reasons.push(`รูปบิลซ้ำกับบิล #${duplicateByHash.id} ที่เคยส่งแล้ว`);
  }
  if (duplicateByReceipt) {
    reasons.push(`เลขที่ใบเสร็จซ้ำกับบิล #${duplicateByReceipt.id} (${duplicateByReceipt.receiptNo})`);
  }
  if (duplicateBill) {
    reasons.push(`ข้อมูลบิลซ้ำกับบิล #${duplicateBill.id} (ปั๊ม/วันที่/ยอดเดียวกัน)`);
  }
  if (lastBill) {
    const prev = billDateTime(lastBill);
    const cur = billDateTime(bill) ?? new Date();
    if (prev) {
      const hours = Math.abs(cur.getTime() - prev.getTime()) / 3600000;
      if (hours < RULES.minHoursBetween) {
        reasons.push(
          `เติมห่างจากครั้งก่อนเพียง ${hours.toFixed(1)} ชั่วโมง (เกณฑ์ ${RULES.minHoursBetween} ชม.)`
        );
      }
    }
  }
  if (bill.total != null && bill.total > RULES.maxTotalBaht) {
    reasons.push(`ยอดเงิน ${bill.total} บาท เกินเพดาน ${RULES.maxTotalBaht} บาท`);
  }
  if (bill.liters != null && bill.liters > RULES.maxLiters) {
    reasons.push(`จำนวน ${bill.liters} ลิตร เกินเพดาน ${RULES.maxLiters} ลิตร`);
  }
  if (bill.liters != null && bill.pricePerLiter != null && bill.total != null) {
    const calc = bill.liters * bill.pricePerLiter;
    if (Math.abs(calc - bill.total) > RULES.mathToleranceBaht) {
      reasons.push(
        `ตัวเลขในบิลไม่ตรง: ${bill.liters} x ${bill.pricePerLiter} = ${calc.toFixed(2)} แต่บิลระบุ ${bill.total} บาท`
      );
    }
  }

  return reasons;
}
