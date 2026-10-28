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
import { randomUUID } from "crypto";
import sharp from "sharp";
import { extractBill, extractOdometer } from "@/lib/fuel/extract";
import { put } from "@/lib/storage";
import { fuelKey, loadMatcher, rememberAlias } from "./office-import";
import { checkExpressPick, getFuelMasters, guessSupplier, queueOrder, rememberStations, stationSuppliers, suggestItem, type ExpressPick } from "./express-fuel";

const T = DEFAULT_TENANT_ID;

export interface BillRow {
  no: number; // "บิลที่ n" as numbered on screen, for error messages
  vehicleId: string;
  plate: string; // as printed on the bill; teaches an alias when the user picks another vehicle
  date: string; // YYYY-MM-DD
  invoice: string;
  item: string;
  liters: number;
  price: number; // per litre as on the bill, 0 = unknown (worked out from amount / liters)
  amount: number;
  odoStart: number;
  odoEnd: number;
  receiver: string;
  billUrl: string; // "" when none
  odoUrl: string; // odometer / hour-meter photo, "" when none
  station: string; // as read from the bill: remembered against the Express supplier picked
  express: ExpressPick | null; // book this bill in Express (PK, + H3 when the item allows)
}

// Only photos this import stored itself (storeBillPhoto / storeOdometerPhoto) may be attached.
const BILL_URL = /^\/uploads\/fuel-bills\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/;
const ODO_URL = /^\/uploads\/fuel-odometer\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/;

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

// Vehicles for the dropdown, each with its Express fuel item: the one chosen
// before, else a suggestion from the plate.
export async function vehicleList() {
  const [{ vehicles }, masters, mapped] = await Promise.all([
    loadMatcher(),
    getFuelMasters(),
    prisma.vehicle.findMany({ where: { TenantId: T }, select: { VehicleId: true, ExpressItemCode: true } }),
  ]);
  const chosen = new Map(mapped.map((m) => [m.VehicleId, m.ExpressItemCode]));
  return vehicles.map((v) => ({
    id: v.VehicleId,
    plate: plateText(v),
    model: v.Model,
    expressItem: chosen.get(v.VehicleId) || (masters ? suggestItem(v, masters.items) : ""),
  }));
}

// Suppliers and items for the Express choices on the import page.
export async function expressChoices() {
  const masters = await getFuelMasters();
  if (!masters) return null;
  return {
    at: masters.at,
    writer: masters.writer === true,
    suppliers: masters.suppliers.map((s) => ({ code: s.code, name: s.name })),
    items: masters.items.map((i) => ({ code: i.code, desc: i.desc, depCode: i.depCode, depName: i.depName, stock: i.stock, vatClaim: i.vatClaim })),
  };
}

// Stored at upload, before the reader runs, so a bill can still be typed by hand
// and saved with its photo when the reader fails (quota used up, rejected key).
// Full size, not compressImage (1280 px, q72): the reader got the year, the
// VAT-inclusive total and the invoice letters wrong at that size, and people
// read the small print on the stored photo too. About 300 KB a bill.
// Throws when the file is not an image sharp can read.
export async function storeBillPhoto(image: Buffer) {
  const buf = await sharp(image)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const { url } = await put(`fuel-bills/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.jpg`, buf);
  return { buf, url };
}

// The odometer / hour-meter photo taken at the fill: stored like the bill photo
// (its own folder), then read by the same AI. Throws when not an image.
export async function storeOdometerPhoto(image: Buffer) {
  const buf = await sharp(image)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const { url } = await put(`fuel-odometer/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.jpg`, buf);
  return { buf, url };
}

// Throws when the reader fails; the caller turns that into a message.
export async function readOdometer(buf: Buffer) {
  const o = await extractOdometer(buf, "image/jpeg");
  return { isMeter: o.is_meter, reading: o.reading && o.reading > 0 ? o.reading : 0, unit: o.unit ?? "" };
}

// Mileage the next fill-up starts from: the latest fill of that vehicle on or
// before the date. Staff write the previous fill's end mileage as the start
// (508 of 525 such pairs in Jun-Oct 2026); when that end is 0 they repeat the
// previous start (machines filled before anyone read the hour meter).
export async function lastOdo(vehicleId: string, date: string) {
  const day = normalizeDate(date);
  const g = await prisma.gasolineCost.findFirst({
    where: {
      VehicleId: vehicleId,
      Vehicle: { TenantId: T },
      OR: [{ OdometerEnd: { gt: 0 } }, { OdometerStart: { gt: 0 } }],
      ...(day ? { DateTime: { lte: day } } : {}),
    },
    orderBy: [{ DateTime: "desc" }, { CreatedAt: "desc" }],
    select: { DateTime: true, OdometerStart: true, OdometerEnd: true },
  });
  if (!g) return null;
  const end = Number(g.OdometerEnd);
  return { odo: end > 0 ? end : Number(g.OdometerStart), date: g.DateTime.toISOString().slice(0, 10) };
}

// Throws when the reader fails; the caller turns that into a message.
export async function readBill(buf: Buffer) {
  const b = await extractBill(buf, "image/jpeg");
  const d = b.bill_date ? normalizeDate(b.bill_date) : null;
  const date = d ? d.toISOString().slice(0, 10) : "";
  const invoice = (b.receipt_no ?? "").trim();
  const amount = b.total ?? 0;
  // Pump attendants tick the plate by hand, which reads back as "sy200,".
  const plate = (b.plate ?? "").replace(/[,，;:✓✔]+/g, " ").trim();
  const { match } = await loadMatcher();
  const vehicleId = plate ? match(plate) : null;
  const [remembered, masters] = await Promise.all([stationSuppliers(), getFuelMasters()]);
  return {
    isFuel: b.is_fuel_bill,
    station: b.station ?? "",
    supplier: guessSupplier(b.station ?? "", remembered, masters),
    price: b.price_per_liter && b.price_per_liter > 0 ? b.price_per_liter : 0,
    time: b.bill_time ?? "",
    plate,
    vehicleId,
    date,
    invoice,
    item: (b.fuel_type ?? "").trim(),
    liters: b.liters ?? 0,
    amount,
    dup: await existing(vehicleId, { date, invoice, amount }),
    lastOdo: vehicleId ? await lastOdo(vehicleId, date) : null,
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
      price: Math.max(0, numOf(o.price)),
      amount: Math.round(numOf(o.amount) * 100) / 100,
      odoStart: numOf(o.odoStart),
      odoEnd: numOf(o.odoEnd),
      receiver: str(o.receiver, 200),
      billUrl: BILL_URL.test(str(o.billUrl, 200)) ? str(o.billUrl, 200) : "",
      odoUrl: ODO_URL.test(str(o.odoUrl, 200)) ? str(o.odoUrl, 200) : "",
      station: str(o.station, 200),
      express: null,
    };
    const ex = (o.express ?? null) as Record<string, unknown> | null;
    if (ex && typeof ex === "object") row.express = { supplier: str(ex.supplier, 10), item: str(ex.item, 20) };
    if (!row.vehicleId) return { error: `${n}: ต้องเลือกรถ` };
    // Bangkok's calendar day: a bill from tomorrow is a typo (and would be booked in Express).
    if (row.date > new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)) return { error: `${n}: วันที่อยู่ในอนาคต` };
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

  // Bills to book in Express: every choice is checked before anything is saved.
  const masters = rows.some((r) => r.express) ? await getFuelMasters() : null;
  const orders = new Map<number, Extract<ReturnType<typeof checkExpressPick>, { order: unknown }>["order"]>();
  for (const r of rows) {
    if (!r.express) continue;
    const c = checkExpressPick(r.express, r, masters);
    if ("error" in c) return { error: `บิลที่ ${r.no}: ${c.error}` };
    orders.set(r.no, c.order);
  }

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let createdSum = 0;
    let dup = 0;
    let queued = 0;
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
      const g = await tx.gasolineCost.create({
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
          BillUrl: r.billUrl || null,
          OdometerUrl: r.odoUrl || null,
          ImportKey: k,
          CreatedByUsername: username,
          UpdatedByUsername: username,
        },
      });
      created++;
      createdSum += r.amount;
      const o = orders.get(r.no);
      if (o) {
        await queueOrder(tx, { GasolineCostId: g.GasolineCostId, date: r.date, liters: r.liters, amount: r.amount }, o, username);
        // Remember the vehicle's Express item for the next bills.
        await tx.vehicle.update({ where: { VehicleId: r.vehicleId }, data: { ExpressItemCode: o.item.code, ExpressDepCode: o.dep } });
        queued++;
      }
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
    return { created, dup, queued };
  });
  await rememberStations(rows.filter((r) => r.express && r.station).map((r) => ({ station: r.station, supplier: r.express!.supplier })));
  return result;
}
