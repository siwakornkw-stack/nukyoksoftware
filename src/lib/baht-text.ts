// 1234.5 -> "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์" (as written on Thai invoices).
const DIGIT = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function under1m(n: number): string {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const place = s.length - i - 1;
    if (!d) continue;
    if (place === 0 && d === 1 && s.length > 1) out += "เอ็ด";
    else if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else out += DIGIT[d] + PLACE[place];
  }
  return out;
}

function words(n: number): string {
  if (n >= 1_000_000) return words(Math.floor(n / 1_000_000)) + "ล้าน" + under1m(n % 1_000_000);
  return under1m(n);
}

export function bahtText(amount: number): string {
  const satang = Math.round(Math.abs(amount) * 100);
  const b = Math.floor(satang / 100);
  const s = satang % 100;
  if (!b && !s) return "ศูนย์บาทถ้วน";
  return (b ? words(b) + "บาท" : "") + (s ? words(s) + "สตางค์" : "ถ้วน");
}
