// Two-step import for the office spreadsheets: preview() parses the file and
// proposes a vehicle for every sheet/row; commit() re-parses the same file and
// applies the user's choice per item ("new" = create the vehicle, "skip", or a
// VehicleId). Re-importing a file is safe: rows already stored are counted as
// duplicates, not written twice.
import type { WorkBook } from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { baht, num, thDate } from "@/lib/format";
import { parseFuelWorkbook, parseInsuranceWorkbook, type FuelRow, type InsuranceRow } from "./office-sheets";
import { guessPlate, plateKey, plateMatcher, plateText } from "./plates";
import { VEHICLE_DEFAULTS } from "./vehicle-defaults";

export type Decision = "new" | "skip" | string;

export interface PreviewItem {
  key: string;
  label: string;
  detail: string;
  summary: string;
  newPlate: string;
  match: string | null;
  count: number;
  dup: number;
}

export interface Preview {
  vehicles: { id: string; plate: string; model: string }[];
  items: PreviewItem[];
}

export interface CommitResult {
  created: number;
  dup: number;
  skipped: number;
  vehiclesCreated: number;
}

type Tx = Prisma.TransactionClient;

const T = DEFAULT_TENANT_ID;
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);
const beYear = (iso: string) => Number(iso.slice(0, 4)) + 543;

async function loadVehicles() {
  return prisma.vehicle.findMany({
    where: { TenantId: T },
    select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true },
    orderBy: { No: "asc" },
  });
}

function vehicleOptions(vs: Awaited<ReturnType<typeof loadVehicles>>) {
  return vs.map((v) => ({ id: v.VehicleId, plate: plateText(v), model: v.Model }));
}

// One new vehicle per plate even if several sheets/rows ask for it.
function vehicleCreator(tx: Tx, username: string) {
  const made = new Map<string, string>();
  let count = 0;
  const create = async (label: string, model: string, characteristic = "") => {
    const g = guessPlate(label);
    const k = plateKey(g.prefix + g.suffix);
    const hit = made.get(k);
    if (hit) return hit;
    const v = await tx.vehicle.create({
      data: {
        ...VEHICLE_DEFAULTS,
        TenantId: T,
        Status: "active",
        LicensePlatePrefix: g.prefix,
        LicensePlateSuffix: g.suffix,
        LicensePlateProvince: "",
        // Trucks: the text around the plate ("เฮี๊ยบ"). Machines: the model.
        Model: g.prefix ? g.rest : model || label,
        Color: "",
        VehicleCharacteristic: characteristic,
        Note: "สร้างจากการนำเข้าไฟล์ Excel",
        CreatedByUsername: username,
      },
    });
    made.set(k, v.VehicleId);
    count++;
    return v.VehicleId;
  };
  return { create, count: () => count };
}

function newPlateText(label: string) {
  const g = guessPlate(label);
  return `${g.prefix} ${g.suffix}`.trim();
}

// ---------------------------------------------------------------- fuel

const fuelKey = (vid: string, r: { date: string; invoice: string; amount: number }) =>
  `${vid}|${r.date}|${r.invoice}|${r.amount.toFixed(2)}`;

async function fuelExisting(vehicleIds: string[], rows: FuelRow[]) {
  if (!vehicleIds.length || !rows.length) return new Set<string>();
  const dates = rows.map((r) => r.date).sort();
  const found = await prisma.gasolineCost.findMany({
    where: { VehicleId: { in: vehicleIds }, DateTime: { gte: utc(dates[0]), lte: utc(dates[dates.length - 1]) } },
    select: { VehicleId: true, DateTime: true, TaxInvoiceNumber: true, Amount: true },
  });
  return new Set(
    found.map((g) =>
      fuelKey(g.VehicleId, { date: day(g.DateTime), invoice: g.TaxInvoiceNumber ?? "", amount: Number(g.Amount) })
    )
  );
}

export async function previewFuel(wb: WorkBook): Promise<Preview> {
  const sheets = parseFuelWorkbook(wb);
  const vehicles = await loadVehicles();
  const match = plateMatcher(vehicles);
  const matched = sheets.map((s) => match(s.label, s.model));
  const seen = await fuelExisting(
    matched.filter((x): x is string => !!x),
    sheets.flatMap((s) => s.rows)
  );

  return {
    vehicles: vehicleOptions(vehicles),
    items: sheets.map((s, i) => {
      const vid = matched[i];
      const amount = s.rows.reduce((a, r) => a + r.amount, 0);
      const liters = s.rows.reduce((a, r) => a + r.liters, 0);
      const dates = s.rows.map((r) => r.date).sort();
      return {
        key: s.sheet,
        label: s.label,
        detail: [s.driver && `คนขับ ${s.driver}`, s.model && `รุ่น ${s.model}`, s.period].filter(Boolean).join(" · "),
        summary: `${s.rows.length} รายการ · ${baht(amount)} · ${num(liters, 2)} ลิตร · ${thDate(dates[0])} - ${thDate(dates[dates.length - 1])}`,
        newPlate: newPlateText(s.label),
        match: vid,
        count: s.rows.length,
        dup: vid ? s.rows.filter((r) => seen.has(fuelKey(vid, r))).length : 0,
      };
    }),
  };
}

export async function commitFuel(
  wb: WorkBook,
  decisions: Record<string, Decision>,
  username: string,
  fileName: string
): Promise<CommitResult> {
  const sheets = parseFuelWorkbook(wb);
  const vehicles = await loadVehicles();
  const valid = new Set(vehicles.map((v) => v.VehicleId));
  const match = plateMatcher(vehicles);

  return prisma.$transaction(async (tx) => {
    const creator = vehicleCreator(tx, username);
    const targets: { vid: string; rows: FuelRow[] }[] = [];
    let skipped = 0;
    for (const s of sheets) {
      const d = decisions[s.sheet] ?? match(s.label, s.model) ?? "new";
      if (d === "skip" || (d !== "new" && !valid.has(d))) {
        skipped += s.rows.length;
        continue;
      }
      const vid = d === "new" ? await creator.create(s.label, s.model) : d;
      targets.push({ vid, rows: s.rows });
    }

    const seen = await fuelExisting(
      targets.map((t) => t.vid),
      targets.flatMap((t) => t.rows)
    );
    const data: Prisma.GasolineCostCreateManyInput[] = [];
    let dup = 0;
    for (const { vid, rows } of targets) {
      for (const r of rows) {
        const k = fuelKey(vid, r);
        if (seen.has(k)) {
          dup++;
          continue;
        }
        seen.add(k);
        data.push({
          VehicleId: vid,
          Status: "active",
          DateTime: utc(r.date),
          Item: r.item || "น้ำมัน",
          TaxInvoiceNumber: r.invoice || null,
          Liters: r.liters,
          Amount: r.amount,
          OdometerStart: r.odoStart,
          OdometerEnd: r.odoEnd,
          Distance: r.distance,
          ReceiverName: r.receiver || null,
          CreatedByUsername: username,
          UpdatedByUsername: username,
        });
      }
    }
    if (data.length) await tx.gasolineCost.createMany({ data });

    const all = sheets.flatMap((s) => s.rows);
    await tx.importLog.create({
      data: {
        TenantId: T,
        FileName: fileName,
        FileRows: all.length,
        FileSum: all.reduce((a, r) => a + r.amount, 0),
        CreatedRows: data.length,
        CreatedSum: data.reduce((a, r) => a + Number(r.Amount), 0),
        DupRows: dup,
        CreatedByUsername: username,
      },
    });
    return { created: data.length, dup, skipped, vehiclesCreated: creator.count() };
  });
}

// ----------------------------------------------------------- insurance

type Kind = "ins" | "cmi" | "tax";

function insDates(r: InsuranceRow): [Kind, string][] {
  const out: [Kind, string][] = [];
  if (r.insEnd) out.push(["ins", r.insEnd]);
  if (r.cmiEnd) out.push(["cmi", r.cmiEnd]);
  if (r.taxEnd) out.push(["tax", r.taxEnd]);
  return out;
}

async function insExisting(vehicleIds: string[]) {
  const seen = new Set<string>();
  if (!vehicleIds.length) return seen;
  const where = { VehicleId: { in: vehicleIds } };
  const select = { VehicleId: true, EndDate: true };
  const [ins, cmi, tax] = await Promise.all([
    prisma.insurancePolicyVehicle.findMany({ where, select }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where, select }),
    prisma.tax.findMany({ where, select }),
  ]);
  for (const [kind, rows] of [["ins", ins], ["cmi", cmi], ["tax", tax]] as const)
    for (const r of rows) seen.add(`${kind}|${r.VehicleId}|${day(r.EndDate)}`);
  return seen;
}

export async function previewInsurance(wb: WorkBook): Promise<Preview> {
  const rows = parseInsuranceWorkbook(wb);
  const vehicles = await loadVehicles();
  const match = plateMatcher(vehicles);
  const matched = rows.map((r) => match(r.label));
  const seen = await insExisting(matched.filter((x): x is string => !!x));
  const label: Record<Kind, string> = { ins: "ประกัน", cmi: "พ.ร.บ.", tax: "ภาษี" };

  return {
    vehicles: vehicleOptions(vehicles),
    items: rows.map((r, i) => {
      const vid = matched[i];
      const dates = insDates(r);
      const insExtra = [r.insClass, r.insCompany].filter(Boolean).join(" ");
      return {
        key: r.key,
        label: r.label,
        detail: [r.vehicleType, r.characteristic, r.driver && `คนขับ ${r.driver}`, `ชีท ${r.sheet}`, r.note]
          .filter(Boolean)
          .join(" · "),
        summary: dates.length
          ? dates
              .map(([k, d]) => `${label[k]} ${thDate(d)}${k === "ins" && insExtra ? ` (${insExtra})` : ""}`)
              .join(" · ")
          : "ไม่มีวันหมดอายุในแถวนี้",
        newPlate: newPlateText(r.label),
        match: vid,
        count: dates.length,
        dup: vid ? dates.filter(([k, d]) => seen.has(`${k}|${vid}|${d}`)).length : 0,
      };
    }),
  };
}

export async function commitInsurance(
  wb: WorkBook,
  decisions: Record<string, Decision>,
  username: string,
  fileName: string
): Promise<CommitResult> {
  const rows = parseInsuranceWorkbook(wb);
  const vehicles = await loadVehicles();
  const valid = new Set(vehicles.map((v) => v.VehicleId));
  const match = plateMatcher(vehicles);

  return prisma.$transaction(async (tx) => {
    const creator = vehicleCreator(tx, username);
    const targets: { vid: string; row: InsuranceRow }[] = [];
    let skipped = 0;
    for (const r of rows) {
      const dates = insDates(r);
      const d = decisions[r.key] ?? (dates.length ? match(r.label) ?? "new" : "skip");
      if (!dates.length || d === "skip" || (d !== "new" && !valid.has(d))) {
        skipped += dates.length;
        continue;
      }
      const vid = d === "new" ? await creator.create(r.label, "", [r.vehicleType, r.characteristic].filter(Boolean).join(" ")) : d;
      targets.push({ vid, row: r });
    }

    const seen = await insExisting(targets.map((t) => t.vid));
    const ins: Prisma.InsurancePolicyVehicleCreateManyInput[] = [];
    const cmi: Prisma.CompulsoryMotorInsuranceVehicleCreateManyInput[] = [];
    const tax: Prisma.TaxCreateManyInput[] = [];
    let dup = 0;
    for (const { vid, row } of targets) {
      const base = {
        VehicleId: vid,
        Status: "active",
        TotalPremium: 0,
        BrokerName: "",
        Note: row.note || null,
        CreatedByUsername: username,
        UpdatedByUsername: username,
      };
      for (const [kind, end] of insDates(row)) {
        const k = `${kind}|${vid}|${end}`;
        if (seen.has(k)) {
          dup++;
          continue;
        }
        seen.add(k);
        const EndDate = utc(end);
        const Year = beYear(end);
        if (kind === "ins") {
          const StartDate = new Date(EndDate);
          StartDate.setUTCFullYear(StartDate.getUTCFullYear() - 1);
          ins.push({ ...base, Year, EndDate, StartDate, Type: row.insClass || "-", InsuranceCompany: row.insCompany });
        } else if (kind === "cmi") {
          cmi.push({ ...base, Year, EndDate, InsuranceCompany: "" });
        } else {
          tax.push({ ...base, Year, EndDate, InsuranceCompany: "" });
        }
      }
    }
    if (ins.length) await tx.insurancePolicyVehicle.createMany({ data: ins });
    if (cmi.length) await tx.compulsoryMotorInsuranceVehicle.createMany({ data: cmi });
    if (tax.length) await tx.tax.createMany({ data: tax });

    const created = ins.length + cmi.length + tax.length;
    await tx.importLog.create({
      data: {
        TenantId: T,
        FileName: fileName,
        FileRows: rows.length,
        CreatedRows: created,
        DupRows: dup,
        CreatedByUsername: username,
      },
    });
    return { created, dup, skipped, vehiclesCreated: creator.count() };
  });
}
