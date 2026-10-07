import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { normalizeDate } from "@/lib/fleet/dates";
import { VEHICLE_DEFAULTS } from "@/lib/fleet/vehicle-defaults";

export const dynamic = "force-dynamic";

function pick(r: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
function pickRaw(r: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}
function toNum(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// A missing or unreadable date stops the import: falling back to today put due
// dates and payments on the wrong day without anyone noticing.
function rowDate(r: Record<string, unknown>, keys: string[], rowNo: number, label: string, bad: string[]): Date {
  const raw = pickRaw(r, keys);
  const d = normalizeDate(raw);
  if (!d) bad.push(raw == null ? `แถว ${rowNo}: ไม่มี${label}` : `แถว ${rowNo}: ${label} "${String(raw).slice(0, 30)}" ไม่ถูกต้อง`);
  return d ?? new Date(0);
}

const PLATE_KEYS = ["เลขทะเบียน", "ทะเบียน", "เลขที่ทะเบียน", "ทะเบียนรถ", "plate", "Plate"];
const PREFIX_KEYS = ["หมวด", "หมวดทะเบียน", "prefix"];

function splitPlate(r: Record<string, unknown>): { prefix: string; suffix: string } | null {
  let suffix = pick(r, PLATE_KEYS);
  let prefix = pick(r, PREFIX_KEYS);
  if (!suffix) return null;
  if (!prefix && /\s/.test(suffix)) {
    const parts = suffix.split(/\s+/);
    prefix = parts[0];
    suffix = parts.slice(1).join(" ");
  }
  return { prefix, suffix };
}

// Resolve a spreadsheet plate to a VehicleId within the tenant.
function plateResolver(vehicles: { VehicleId: string; LicensePlatePrefix: string; LicensePlateSuffix: string }[]) {
  const bySuffix = new Map<string, string>();
  const byFull = new Map<string, string>();
  for (const v of vehicles) {
    bySuffix.set(v.LicensePlateSuffix, v.VehicleId);
    byFull.set(`${v.LicensePlatePrefix}|${v.LicensePlateSuffix}`, v.VehicleId);
  }
  return (plate: { prefix: string; suffix: string }) =>
    plate.prefix ? byFull.get(`${plate.prefix}|${plate.suffix}`) ?? bySuffix.get(plate.suffix) : bySuffix.get(plate.suffix);
}

function badDates(bad: string[]) {
  const more = bad.length > 10 ? ` และอีก ${bad.length - 10} แถว` : "";
  return NextResponse.json(
    { error: `แก้วันที่ในไฟล์ก่อนนำเข้า (ยังไม่ได้บันทึกอะไร): ${bad.slice(0, 10).join(" · ")}${more}` },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  const mode = String(form.get("mode") || "vehicles");

  const buf = await file.arrayBuffer();
  // No cellDates: its Date objects depend on the machine time zone (a day early
  // on a UTC+7 PC). Raw Excel serials go through normalizeDate, BE years included.
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  let created = 0,
    dup = 0,
    skipped = 0;
  const bad: string[] = [];

  if (mode === "installments") {
    const vehicles = await prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true },
    });
    const resolve = plateResolver(vehicles);
    // Dedupe against existing (VehicleId, InstallmentNumber) and within the batch.
    const existing = await prisma.installmentsVehicle.findMany({
      where: { Vehicle: { TenantId: DEFAULT_TENANT_ID } },
      select: { VehicleId: true, InstallmentNumber: true },
    });
    const seen = new Set(existing.map((e) => `${e.VehicleId}|${e.InstallmentNumber}`));

    const data: Prisma.InstallmentsVehicleCreateManyInput[] = [];
    for (const [i, r] of rows.entries()) {
      const plate = splitPlate(r);
      if (!plate) {
        skipped++;
        continue;
      }
      const vid = resolve(plate);
      if (!vid) {
        skipped++;
        continue;
      }
      const number = Math.round(toNum(pick(r, ["งวด", "งวดที่", "installmentNumber", "InstallmentNumber"])) ?? 0);
      const key = `${vid}|${number}`;
      if (seen.has(key)) {
        dup++;
        continue;
      }
      seen.add(key);
      data.push({
        VehicleId: vid,
        Status: "active",
        InstallmentNumber: number,
        DueDate: rowDate(r, ["ครบกำหนด", "วันครบกำหนด", "dueDate", "DueDate"], i + 2, "วันครบกำหนด", bad),
        Amount: toNum(pick(r, ["ยอด", "ค่างวด", "จำนวนเงิน", "amount", "Amount"])) ?? 0,
        CreatedByUsername: session.username,
      });
      created++;
    }
    if (bad.length) return badDates(bad);
    if (data.length) await prisma.installmentsVehicle.createMany({ data });
  } else if (mode === "income") {
    const vehicles = await prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true },
    });
    const resolve = plateResolver(vehicles);
    // Dedupe against existing (VehicleId, InvoiceNumber) when an invoice no. is present.
    const existing = await prisma.incomeVehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID, InvoiceNumber: { not: "" } },
      select: { VehicleId: true, InvoiceNumber: true },
    });
    const seen = new Set(existing.map((e) => `${e.VehicleId}|${e.InvoiceNumber}`));

    const data: Prisma.IncomeVehicleCreateManyInput[] = [];
    for (const [i, r] of rows.entries()) {
      const plate = splitPlate(r);
      if (!plate) {
        skipped++;
        continue;
      }
      const vid = resolve(plate);
      if (!vid) {
        skipped++;
        continue;
      }
      const invoice = pick(r, ["เลขที่ใบแจ้งหนี้", "ใบแจ้งหนี้", "invoice", "Invoice"]);
      const key = `${vid}|${invoice}`;
      if (invoice && seen.has(key)) {
        dup++;
        continue;
      }
      if (invoice) seen.add(key);
      data.push({
        VehicleId: vid,
        TenantId: DEFAULT_TENANT_ID,
        Status: "active",
        Description: pick(r, ["รายละเอียด", "รายการ", "description", "Description"]),
        DateTime: rowDate(r, ["วันที่", "วันที่รับเงิน", "date", "Date"], i + 2, "วันที่", bad),
        Time: "",
        WorkOrderNumber: pick(r, ["เลขที่ใบสั่งงาน", "ใบสั่งงาน", "workOrder", "WorkOrder"]),
        InvoiceNumber: invoice,
        AmountReceive: toNum(pick(r, ["รับเงิน", "ยอด", "จำนวนเงิน", "amount", "Amount"])) ?? 0,
        CreatedByUsername: session.username,
      });
      created++;
    }
    if (bad.length) return badDates(bad);
    if (data.length) await prisma.incomeVehicle.createMany({ data });
  } else {
    // mode === "vehicles" (default)
    const existing = await prisma.vehicle.findMany({
      where: { TenantId: DEFAULT_TENANT_ID },
      select: { LicensePlatePrefix: true, LicensePlateSuffix: true },
    });
    const seen = new Set(existing.map((v) => `${v.LicensePlatePrefix}|${v.LicensePlateSuffix}`));
    const data: Prisma.VehicleCreateManyInput[] = [];

    for (const r of rows) {
      const plate = splitPlate(r);
      if (!plate) {
        skipped++;
        continue;
      }
      const key = `${plate.prefix}|${plate.suffix}`;
      if (seen.has(key)) {
        dup++;
        continue;
      }
      seen.add(key);
      data.push({
        ...VEHICLE_DEFAULTS,
        TenantId: DEFAULT_TENANT_ID,
        Status: "active",
        LicensePlatePrefix: plate.prefix,
        LicensePlateSuffix: plate.suffix,
        LicensePlateProvince: pick(r, ["จังหวัด", "province"]),
        Model: pick(r, ["รุ่น", "model", "Model"]),
        Color: pick(r, ["สี", "color"]),
        InstallmentPeriods: toNum(pick(r, ["จำนวนงวด", "งวด"])),
        InstallmentAmount: toNum(pick(r, ["ค่างวด", "ยอดค่างวด"])),
        CreatedByUsername: session.username,
      });
      created++;
    }
    if (data.length) await prisma.vehicle.createMany({ data });
  }

  await prisma.importLog.create({
    data: {
      TenantId: DEFAULT_TENANT_ID,
      FileName: file.name,
      FileRows: rows.length,
      CreatedRows: created,
      DupRows: dup,
      CreatedByUsername: session.username,
    },
  });

  return NextResponse.json({ created, dup, skipped, total: rows.length, mode });
}
