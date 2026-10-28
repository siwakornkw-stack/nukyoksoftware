// Booking fuel bills in Express Accounting: the web side.
//
// The office PC sends the fuel master data (suppliers, per-vehicle items) read
// from Express's fuel PO history (scripts/express/fuel-masters.mjs, with the PO
// sync). Saving bills on /fleet/fuel/import/bills with "สั่งเปิด PK + H3" queues
// an ExpressFuelOrder per new bill; the PC writes the PK (+ H3) into Express and
// reports back through /api/cron/express-fuel. The R3 follows when an admin
// approves the PK on /po/pk.
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { guessPlate, plateKey } from "./plates";

const MASTERS_KEY = "express_fuel_masters";
const STATIONS_KEY = "express_station_suppliers";

const text = (max: number) => z.string().catch("").transform((s) => s.trim().slice(0, max));
const mastersSchema = z.object({
  suppliers: z
    .array(z.object({ code: text(10), name: text(120), taxId: text(15), branch: text(5), uses: z.number().catch(0), last: text(10) }))
    .max(200),
  items: z
    .array(
      z.object({
        code: text(20),
        desc: text(50),
        depCode: text(4),
        depName: text(50),
        unit: text(2),
        stock: z.boolean().catch(false),
        vatClaim: z.boolean().catch(true),
        uses: z.number().catch(0),
        last: text(10),
      })
    )
    .max(1000),
  // The PC writes the PK/H3 (EXPRESS_FUEL_MODE=live). Off: nothing would ever
  // write a queued bill, so the web does not offer it.
  writer: z.boolean().catch(false),
});
export type FuelMasters = z.infer<typeof mastersSchema> & { at: string };
export type FuelItem = FuelMasters["items"][number];

export async function saveFuelMasters(raw: unknown): Promise<boolean> {
  const p = mastersSchema.safeParse(raw);
  if (!p.success || !p.data.items.length) return false;
  const value = JSON.stringify({ ...p.data, at: new Date().toISOString() });
  await prisma.appSetting.upsert({ where: { key: MASTERS_KEY }, update: { value }, create: { key: MASTERS_KEY, value } });
  return true;
}

export async function getFuelMasters(): Promise<FuelMasters | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: MASTERS_KEY } });
  try {
    return row?.value ? (JSON.parse(row.value) as FuelMasters) : null;
  } catch {
    return null;
  }
}

// Staff type the tax invoice number without the leading letter Express-side
// ("ต26102811012580" -> "26102811012580", 234 of 264 bills since Sep 2026);
// the field holds 15 characters. Null when it still does not fit.
export function expressInvoice(invoice: string): string | null {
  let s = invoice.trim().replace(/\s+/g, "");
  if (/^[ก-ฮ]+\d+$/.test(s)) s = s.replace(/^[ก-ฮ]+/, "");
  return s && s.length <= 15 ? s : null;
}

// Station text on the bill -> Express supplier code: what staff picked last time
// for that station, else Bangchak's usual code.
const stationKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export async function stationSuppliers(): Promise<Record<string, string>> {
  const row = await prisma.appSetting.findUnique({ where: { key: STATIONS_KEY } });
  try {
    return row?.value ? JSON.parse(row.value) : {};
  } catch {
    return {};
  }
}
export function guessSupplier(station: string, remembered: Record<string, string>, masters: FuelMasters | null): string {
  const k = stationKey(station);
  if (k && remembered[k]) return remembered[k];
  if (/บางจาก|bangchak/i.test(station) && masters?.suppliers.some((s) => s.code === "บ015")) return "บ015";
  return "";
}
export async function rememberStations(pairs: { station: string; supplier: string }[]) {
  const cur = await stationSuppliers();
  let changed = false;
  for (const p of pairs) {
    const k = stationKey(p.station);
    if (k && p.supplier && cur[k] !== p.supplier) {
      cur[k] = p.supplier;
      changed = true;
    }
  }
  if (!changed) return;
  const value = JSON.stringify(cur);
  await prisma.appSetting.upsert({ where: { key: STATIONS_KEY }, update: { value }, create: { key: STATIONS_KEY, value } });
}

// Vehicle -> its Express fuel item: the code or description carries the plate
// ("70-1826", "3297 (ก)" / "ค่าน้ำมันรถกระบะ ก-3297…") or the model ("ค่าน้ำมัน SY200H").
// Only a single clear match is suggested; anything else is left for staff.
export function suggestItem(v: { LicensePlatePrefix: string; LicensePlateSuffix: string; Model: string }, items: FuelItem[]): string {
  const keys = [plateKey(v.LicensePlatePrefix + v.LicensePlateSuffix), plateKey(v.Model)].filter((k) => k.length >= 3);
  if (!keys.length) return "";
  const hits = items.filter((it) => {
    const code = plateKey(it.code);
    const g = guessPlate(it.desc);
    const descPlate = plateKey(g.prefix + g.suffix);
    const desc = plateKey(it.desc);
    return keys.some((k) => k === code || (g.prefix && k === descPlate) || (k.length >= 4 && desc.includes(k)));
  });
  return hits.length === 1 ? hits[0].code : "";
}

export interface ExpressPick {
  supplier: string;
  item: string;
}

// Checks one bill's Express choices against the master data; the error is Thai.
// The department is always the item's own (from Express), never the browser's.
export function checkExpressPick(
  p: ExpressPick,
  r: { invoice: string; liters: number; price: number; amount: number },
  masters: FuelMasters | null
): { order: { supplier: string; item: FuelItem; dep: string; invoice: string; price: number } } | { error: string } {
  if (!masters) return { error: "ยังไม่มีข้อมูลจาก Express (เครื่องที่มี Express ยังไม่ส่งข้อมูลมา)" };
  if (!masters.writer) return { error: "การสั่งเปิดใน Express ยังไม่เปิดใช้" };
  if (!masters.suppliers.some((s) => s.code === p.supplier)) return { error: "เลือกปั๊ม (ผู้จำหน่ายใน Express)" };
  const item = masters.items.find((i) => i.code === p.item);
  if (!item) return { error: "เลือกรหัสรถใน Express" };
  const dep = item.depCode;
  if (!dep) return { error: "รหัสรถนี้ไม่มีแผนกใน Express" };
  const invoice = expressInvoice(r.invoice);
  if (!invoice) return { error: "เลขที่ใบกำกับภาษีต้องมี และยาวไม่เกิน 15 ตัว (ใช้ใน H3 และรายงานภาษีซื้อ)" };
  if (r.liters <= 0) return { error: "ต้องกรอกจำนวนลิตร" };
  const price = r.price > 0 ? r.price : Math.round((r.amount / r.liters) * 100) / 100;
  return { order: { supplier: p.supplier, item, dep, invoice, price } };
}

export async function queueOrder(
  tx: Prisma.TransactionClient,
  g: { GasolineCostId: string; date: string; liters: number; amount: number },
  o: { supplier: string; item: FuelItem; dep: string; invoice: string; price: number },
  username: string
) {
  await tx.expressFuelOrder.create({
    data: {
      TenantId: DEFAULT_TENANT_ID,
      GasolineCostId: g.GasolineCostId,
      Status: "queued",
      WithH3: !o.item.stock && o.item.vatClaim,
      SupplierCode: o.supplier,
      ItemCode: o.item.code,
      DepCode: o.dep,
      Date: new Date(`${g.date}T00:00:00Z`),
      Invoice: o.invoice,
      Liters: g.liters,
      Price: o.price,
      Amount: g.amount,
      RequestedBy: username,
    },
  });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  queued: "กำลังเปิดใน Express",
  done: "เปิดแล้ว",
  error: "ไม่สำเร็จ",
  cancelled: "ยกเลิก",
};

export async function recentOrders(take = 30) {
  const rows = await prisma.expressFuelOrder.findMany({
    where: { TenantId: DEFAULT_TENANT_ID },
    orderBy: { CreatedAt: "desc" },
    take,
    include: { GasolineCost: { select: { Vehicle: { select: { LicensePlatePrefix: true, LicensePlateSuffix: true } } } } },
  });
  return rows.map((r) => ({
    id: r.ExpressFuelOrderId,
    status: r.Status,
    withH3: r.WithH3,
    plate: `${r.GasolineCost.Vehicle.LicensePlatePrefix} ${r.GasolineCost.Vehicle.LicensePlateSuffix}`.trim(),
    date: r.Date.toISOString().slice(0, 10),
    invoice: r.Invoice,
    amount: Number(r.Amount),
    pkNo: r.PkNo ?? "",
    h3No: r.H3No ?? "",
    error: r.Error ?? "",
    by: r.RequestedBy,
  }));
}
