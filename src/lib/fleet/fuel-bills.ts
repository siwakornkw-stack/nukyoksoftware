// Fuel bills from photos: Gemini reads each receipt (same reader as the LINE
// fuel bot), the user checks and corrects every row, then they are saved as
// GasolineCost. ImportKey uses the Excel import's key, so the month's office
// file later skips these bills instead of booking them twice.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { baht, thDate } from "@/lib/format";
import { normalizeDate } from "./dates";
import { plateText } from "./plates";
import { extractBill } from "@/lib/fuel/extract";
import sharp from "sharp";
import { fuelKey, loadMatcher, rememberAlias } from "./office-import";

const T = DEFAULT_TENANT_ID;

export interface BillRow {
  no: number; // "บิลที่ n" as numbered on screen, for error messages
  vehicleId: string;
  plate: string; // as printed on the bill; teaches an alias when the user picks another vehicle
  date: string; // YYYY-MM-DD
  invoice: string;
  item: string;
  liters: number;
  amount: number;
  odoStart: number;
  odoEnd: number;
  receiver: string;
}

// The same bill already stored: same import key, or same invoice number and
// amount. The number alone is not enough: a short receipt number ("4372910")
// can repeat at another station, and that bill would be skipped as a duplicate.
function sameBill(vehicleId: string | null, r: { date: string; invoice: string; amount: number }) {
  const or: Prisma.GasolineCostWhereInput[] = [];
  if (vehicleId) or.push({ ImportKey: fuelKey(vehicleId, r) });
  if (r.invoice) or.push({ TaxInvoiceNumber: r.invoice, Amount: r.amount });
  return or;
}

// "มีอยู่แล้ว: 81-2993 03/10/2569 ฿3,000"
async function existing(vehicleId: string | null, r: { date: string; invoice: string; amount: number }) {
  const or = sameBill(vehicleId, r);
  if (!or.length) return null;
  const g = await prisma.gasolineCost.findFirst({
    where: { OR: or, Vehicle: { TenantId: T } },
    include: { Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true } } },
  });
  return g ? `มีอยู่แล้ว: ${plateText(g.Vehicle)} ${thDate(g.DateTime.toISOString())} ${baht(Number(g.Amount))}` : null;
}

export async function vehicleList() {
  const { vehicles } = await loadMatcher();
  return vehicles.map((v) => ({ id: v.VehicleId, plate: plateText(v), model: v.Model }));
}

export async function readBill(image: Buffer) {
  // Not compressImage (1280 px, q72, sized for stored evidence): the reader got the
  // year, the VAT-inclusive total and the invoice letters wrong at that size.
  const buf = await sharp(image).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const b = await extractBill(buf, "image/jpeg");
  const d = b.bill_date ? normalizeDate(b.bill_date) : null;
  const date = d ? d.toISOString().slice(0, 10) : "";
  const invoice = (b.receipt_no ?? "").trim();
  const amount = b.total ?? 0;
  // Pump attendants tick the plate by hand, which reads back as "sy200,".
  const plate = (b.plate ?? "").replace(/[,，;:✓✔]+/g, " ").trim();
  const { match } = await loadMatcher();
  const vehicleId = plate ? match(plate) : null;
  return {
    isFuel: b.is_fuel_bill,
    station: b.station ?? "",
    time: b.bill_time ?? "",
    plate,
    vehicleId,
    date,
    invoice,
    item: (b.fuel_type ?? "").trim(),
    liters: b.liters ?? 0,
    amount,
    dup: await existing(vehicleId, { date, invoice, amount }),
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

// Untrusted JSON -> rows, or the first problem in Thai.
export function parseRows(input: unknown): { rows: BillRow[] } | { error: string } {
  if (!Array.isArray(input) || !input.length) return { error: "ไม่มีรายการที่จะบันทึก" };
  const rows: BillRow[] = [];
  for (const [i, raw] of input.entries()) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const no = Math.trunc(numOf(o.no)) || i + 1;
    const n = `บิลที่ ${no}`;
    const d = normalizeDate(str(o.date, 20));
    if (!d) return { error: `${n}: วันที่ไม่ถูกต้อง` };
    const row: BillRow = {
      no,
      vehicleId: str(o.vehicleId, 36),
      plate: str(o.plate, 100),
      date: d.toISOString().slice(0, 10),
      invoice: str(o.invoice, 100),
      item: str(o.item, 200) || "น้ำมัน",
      liters: numOf(o.liters),
      amount: Math.round(numOf(o.amount) * 100) / 100,
      odoStart: numOf(o.odoStart),
      odoEnd: numOf(o.odoEnd),
      receiver: str(o.receiver, 200),
    };
    if (!row.vehicleId) return { error: `${n}: ต้องเลือกรถ` };
    if (row.amount <= 0) return { error: `${n}: ต้องกรอกจำนวนเงิน` };
    if (row.liters < 0 || row.odoStart < 0 || row.odoEnd < 0) return { error: `${n}: ตัวเลขติดลบไม่ได้` };
    rows.push(row);
  }
  return { rows };
}

export async function commitBills(rows: BillRow[], username: string) {
  const { match, valid } = await loadMatcher();
  const bad = rows.find((r) => !valid.has(r.vehicleId));
  if (bad) return { error: `บิลที่ ${bad.no}: ไม่พบรถที่เลือก` };

  return prisma.$transaction(async (tx) => {
    let created = 0;
    let createdSum = 0;
    let dup = 0;
    const seen = new Set<string>();
    for (const r of rows) {
      const k = fuelKey(r.vehicleId, r);
      const inv = `inv|${r.invoice}|${r.amount.toFixed(2)}`;
      const stored = await tx.gasolineCost.findFirst({
        where: { OR: sameBill(r.vehicleId, r), Vehicle: { TenantId: T } },
        select: { GasolineCostId: true },
      });
      if (stored || seen.has(k) || (r.invoice && seen.has(inv))) {
        dup++;
        continue;
      }
      seen.add(k);
      if (r.invoice) seen.add(inv);
      await tx.gasolineCost.create({
        data: {
          VehicleId: r.vehicleId,
          Status: "active",
          DateTime: new Date(`${r.date}T00:00:00.000Z`),
          Item: r.item,
          TaxInvoiceNumber: r.invoice || null,
          Liters: r.liters,
          Amount: r.amount,
          OdometerStart: r.odoStart,
          OdometerEnd: r.odoEnd,
          Distance: r.odoStart > 0 && r.odoEnd > r.odoStart ? Math.round((r.odoEnd - r.odoStart) * 100) / 100 : null,
          ReceiverName: r.receiver || null,
          ImportKey: k,
          CreatedByUsername: username,
          UpdatedByUsername: username,
        },
      });
      created++;
      createdSum += r.amount;
      if (r.plate && match(r.plate) !== r.vehicleId) await rememberAlias(tx, r.plate, r.vehicleId, username);
    }
    await tx.importLog.create({
      data: {
        TenantId: T,
        FileName: `รูปบิลน้ำมัน ${rows.length} ใบ`,
        FileRows: rows.length,
        FileSum: rows.reduce((a, r) => a + r.amount, 0),
        CreatedRows: created,
        CreatedSum: createdSum,
        DupRows: dup,
        CreatedByUsername: username,
      },
    });
    return { created, dup };
  });
}
