// Pure: safe for client and server (the bill import page checks as you type).

// Litres x pump price must come to the paid total give or take rounding (a
// typo would be booked in Express as a huge "discount"). "" when it does.
export function priceOff(r: { liters: number; price: number; amount: number }): string {
  if (!(r.price > 0) || !(r.liters > 0)) return "";
  const v = Math.round(r.liters * r.price * 100) / 100;
  return Math.abs(v - r.amount) > 1 ? `ลิตร × ราคาต่อลิตร = ${v.toLocaleString("th-TH")} ไม่ตรงกับยอดเงิน ${r.amount.toLocaleString("th-TH")} ตรวจตัวเลขอีกครั้ง` : "";
}
