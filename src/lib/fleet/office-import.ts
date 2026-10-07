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
import { audit } from "@/lib/audit";
import {
  parseFuelWorkbook,
  parseInstallmentWorkbook,
  parseInsuranceWorkbook,
  type FuelRow,
  type InstallmentRow,
  type InsuranceRow,
} from "./office-sheets";
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
  notes?: number; // insurance: stored records whose note the file will update; installments: stored unpaid ones the file marks paid
  premiums?: number; // insurance: stored records whose premium the file will set
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
  notesUpdated?: number;
  premiumsUpdated?: number;
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

export async function loadMatcher() {
  const [vehicles, aliases] = await Promise.all([
    loadVehicles(),
    prisma.vehicleAlias.findMany({ where: { TenantId: T }, select: { AliasKey: true, VehicleId: true } }),
  ]);
  const match = plateMatcher(vehicles, new Map(aliases.map((a) => [a.AliasKey, a.VehicleId])));
  return { vehicles, match, valid: new Set(vehicles.map((v) => v.VehicleId)) };
}

// A row the user pointed at a different vehicle than we guessed teaches us that
// the label is another name for it, so the next month's file matches by itself.
export async function rememberAlias(tx: Tx, label: string, vehicleId: string, username: string) {
  const AliasKey = plateKey(label);
  if (!AliasKey) return;
  await tx.vehicleAlias.upsert({
    where: { TenantId_AliasKey: { TenantId: T, AliasKey } },
    create: { TenantId: T, AliasKey, Label: label, VehicleId: vehicleId, CreatedByUsername: username },
    update: { VehicleId: vehicleId, Label: label },
  });
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

// Also used by the bill-photo import, so a bill entered from a photo is a
// duplicate when the month's Excel file brings the same row.
export const fuelKey = (vid: string, r: { date: string; invoice: string; amount: number }) =>
  `${vid}|${r.date}|${r.invoice}|${r.amount.toFixed(2)}`;

// Matched on the key stored at import, not the row's current values, so edits
// made on the web (amount, date, even moving it to another vehicle) do not
// make the original spreadsheet row look new again.
async function fuelExisting(targets: { vid: string; rows: FuelRow[] }[]) {
  const keys = targets.flatMap((t) => t.rows.map((r) => fuelKey(t.vid, r)));
  if (!keys.length) return new Set<string>();
  const found = await prisma.gasolineCost.findMany({
    where: { ImportKey: { in: keys }, Vehicle: { TenantId: T } },
    select: { ImportKey: true },
  });
  return new Set(found.map((g) => g.ImportKey!));
}

export async function previewFuel(wb: WorkBook): Promise<Preview> {
  const sheets = parseFuelWorkbook(wb);
  const { vehicles, match } = await loadMatcher();
  const matched = sheets.map((s) => match(s.label, s.model));
  const seen = await fuelExisting(sheets.flatMap((s, i) => (matched[i] ? [{ vid: matched[i]!, rows: s.rows }] : [])));

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
  const { match, valid } = await loadMatcher();

  return prisma.$transaction(async (tx) => {
    const creator = vehicleCreator(tx, username);
    const targets: { vid: string; rows: FuelRow[] }[] = [];
    let skipped = 0;
    for (const s of sheets) {
      const auto = match(s.label, s.model);
      const d = decisions[s.sheet] ?? auto ?? "new";
      if (d === "skip" || (d !== "new" && !valid.has(d))) {
        skipped += s.rows.length;
        continue;
      }
      const vid = d === "new" ? await creator.create(s.label, s.model) : d;
      if (d !== "new" && d !== auto) await rememberAlias(tx, s.label, d, username);
      targets.push({ vid, rows: s.rows });
    }

    const seen = await fuelExisting(targets);
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
          ImportKey: k,
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

// A spreadsheet row counts as stored if either its import key is on file (the
// record may have been edited or moved since) or a record with the same
// vehicle + kind + expiry exists now (e.g. someone renewed it by hand first).
async function insExisting() {
  const seen = new Set<string>();
  const where = { Vehicle: { TenantId: T } };
  const select = { VehicleId: true, EndDate: true, ImportKey: true };
  const [ins, cmi, tax] = await Promise.all([
    prisma.insurancePolicyVehicle.findMany({ where, select }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where, select }),
    prisma.tax.findMany({ where, select }),
  ]);
  for (const [kind, rows] of [["ins", ins], ["cmi", cmi], ["tax", tax]] as const)
    for (const r of rows) {
      seen.add(`${kind}|${r.VehicleId}|${day(r.EndDate)}`);
      if (r.ImportKey) seen.add(r.ImportKey);
    }
  return seen;
}

type NoteChange = { kind: Kind; id: string; note: string };

// Stored records for this row whose note differs from the file's. The office
// rewrites the note as the status changes ("กำลังต่อ" -> "ขายรถแล้ว"), so the old
// text is kept in brackets rather than lost. An empty note in the file changes nothing.
async function noteChanges(db: Tx, vid: string, row: InsuranceRow): Promise<NoteChange[]> {
  if (!row.note) return [];
  const out: NoteChange[] = [];
  for (const [kind, end] of insDates(row)) {
    const where = {
      Vehicle: { TenantId: T },
      OR: [{ ImportKey: `${kind}|${vid}|${end}` }, { VehicleId: vid, EndDate: utc(end) }],
    };
    const found =
      kind === "ins"
        ? (await db.insurancePolicyVehicle.findMany({ where, select: { InsurancePolicyVehicleId: true, Note: true } })).map((r) => ({ id: r.InsurancePolicyVehicleId, old: r.Note }))
        : kind === "cmi"
          ? (await db.compulsoryMotorInsuranceVehicle.findMany({ where, select: { CompulsoryMotorInsuranceVehicleId: true, Note: true } })).map((r) => ({ id: r.CompulsoryMotorInsuranceVehicleId, old: r.Note }))
          : (await db.tax.findMany({ where, select: { TaxId: true, Note: true } })).map((r) => ({ id: r.TaxId, old: r.Note }));
    for (const f of found) {
      const old = f.old ?? "";
      if (old.startsWith(row.note)) continue;
      out.push({ kind, id: f.id, note: old ? `${row.note} (เดิม: ${old})` : row.note });
    }
  }
  return out;
}

async function applyNoteChanges(tx: Tx, changes: NoteChange[], username: string) {
  for (const c of changes) {
    const data = { Note: c.note, UpdatedByUsername: username, UpdatedAt: new Date() };
    if (c.kind === "ins") await tx.insurancePolicyVehicle.update({ where: { InsurancePolicyVehicleId: c.id }, data });
    else if (c.kind === "cmi") await tx.compulsoryMotorInsuranceVehicle.update({ where: { CompulsoryMotorInsuranceVehicleId: c.id }, data });
    else await tx.tax.update({ where: { TaxId: c.id }, data });
  }
}

const premiumOf = (r: InsuranceRow, kind: Kind) => (kind === "ins" ? r.insPremium : kind === "cmi" ? r.cmiPremium : r.taxPremium);

type PremiumChange = { kind: Kind; id: string; before: number; after: number };

// Stored records for this row whose premium differs from the file's. The file is
// where the office keeps the premium, so a filled-in amount wins; an empty or
// zero premium in the file changes nothing.
async function premiumChanges(db: Tx, vid: string, row: InsuranceRow): Promise<PremiumChange[]> {
  const out: PremiumChange[] = [];
  for (const [kind, end] of insDates(row)) {
    const after = premiumOf(row, kind);
    if (!after) continue;
    const where = {
      Vehicle: { TenantId: T },
      OR: [{ ImportKey: `${kind}|${vid}|${end}` }, { VehicleId: vid, EndDate: utc(end) }],
    };
    const select = { TotalPremium: true };
    const found =
      kind === "ins"
        ? (await db.insurancePolicyVehicle.findMany({ where, select: { ...select, InsurancePolicyVehicleId: true } })).map((r) => ({ id: r.InsurancePolicyVehicleId, p: r.TotalPremium }))
        : kind === "cmi"
          ? (await db.compulsoryMotorInsuranceVehicle.findMany({ where, select: { ...select, CompulsoryMotorInsuranceVehicleId: true } })).map((r) => ({ id: r.CompulsoryMotorInsuranceVehicleId, p: r.TotalPremium }))
          : (await db.tax.findMany({ where, select: { ...select, TaxId: true } })).map((r) => ({ id: r.TaxId, p: r.TotalPremium }));
    for (const f of found) {
      const before = Number(f.p);
      if (before !== after) out.push({ kind, id: f.id, before, after });
    }
  }
  return out;
}

async function applyPremiumChanges(tx: Tx, changes: PremiumChange[], username: string) {
  for (const c of changes) {
    const data = { TotalPremium: c.after, UpdatedByUsername: username, UpdatedAt: new Date() };
    if (c.kind === "ins") await tx.insurancePolicyVehicle.update({ where: { InsurancePolicyVehicleId: c.id }, data });
    else if (c.kind === "cmi") await tx.compulsoryMotorInsuranceVehicle.update({ where: { CompulsoryMotorInsuranceVehicleId: c.id }, data });
    else await tx.tax.update({ where: { TaxId: c.id }, data });
  }
}

const RECORD_KEY: Record<Kind, string> = { ins: "insurance", cmi: "compulsory", tax: "tax" };

export async function previewInsurance(wb: WorkBook): Promise<Preview> {
  const rows = parseInsuranceWorkbook(wb);
  const { vehicles, match } = await loadMatcher();
  const matched = rows.map((r) => match(r.label));
  const seen = await insExisting();
  const notes = await Promise.all(rows.map((r, i) => (matched[i] ? noteChanges(prisma, matched[i]!, r) : [])));
  const premiums = await Promise.all(rows.map((r, i) => (matched[i] ? premiumChanges(prisma, matched[i]!, r) : [])));
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
              .map(([k, d]) => {
                const p = premiumOf(r, k);
                return `${label[k]} ${thDate(d)}${k === "ins" && insExtra ? ` (${insExtra})` : ""}${p ? ` ${baht(p)}` : ""}`;
              })
              .join(" · ")
          : "ไม่มีวันหมดอายุในแถวนี้",
        newPlate: newPlateText(r.label),
        match: vid,
        count: dates.length,
        dup: vid ? dates.filter(([k, d]) => seen.has(`${k}|${vid}|${d}`)).length : 0,
        notes: notes[i].length,
        premiums: premiums[i].length,
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
  const { match, valid } = await loadMatcher();

  const { priced, ...result } = await prisma.$transaction(async (tx) => {
    const creator = vehicleCreator(tx, username);
    const targets: { vid: string; row: InsuranceRow }[] = [];
    let skipped = 0;
    for (const r of rows) {
      const dates = insDates(r);
      const auto = match(r.label);
      const d = decisions[r.key] ?? (dates.length ? auto ?? "new" : "skip");
      if (!dates.length || d === "skip" || (d !== "new" && !valid.has(d))) {
        skipped += dates.length;
        continue;
      }
      const vid = d === "new" ? await creator.create(r.label, "", [r.vehicleType, r.characteristic].filter(Boolean).join(" ")) : d;
      if (d !== "new" && d !== auto) await rememberAlias(tx, r.label, d, username);
      targets.push({ vid, row: r });
    }

    const seen = await insExisting();
    // Worked out before the inserts, so only records that already existed are touched.
    const changes = (await Promise.all(targets.map((t) => noteChanges(tx, t.vid, t.row)))).flat();
    await applyNoteChanges(tx, changes, username);
    // A record moved to another vehicle can match two rows (its import key and its
    // new vehicle + expiry): change it once, from the first row.
    const priced = (await Promise.all(targets.map((t) => premiumChanges(tx, t.vid, t.row))))
      .flat()
      .filter((c, i, all) => all.findIndex((x) => x.kind === c.kind && x.id === c.id) === i);
    await applyPremiumChanges(tx, priced, username);
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
        const rec = { ...base, Year, EndDate, ImportKey: k, TotalPremium: premiumOf(row, kind) ?? 0 };
        if (kind === "ins") {
          const StartDate = new Date(EndDate);
          StartDate.setUTCFullYear(StartDate.getUTCFullYear() - 1);
          ins.push({ ...rec, StartDate, Type: row.insClass || "-", InsuranceCompany: row.insCompany });
        } else if (kind === "cmi") {
          cmi.push({ ...rec, InsuranceCompany: "" });
        } else {
          tax.push({ ...rec, InsuranceCompany: "" });
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
    return { created, dup, skipped, vehiclesCreated: creator.count(), notesUpdated: changes.length, premiumsUpdated: priced.length, priced };
  });
  // Premiums are money: log each change the way the record edit API does.
  for (const c of priced) await audit(`record:${RECORD_KEY[c.kind]}`, c.id, "update", username, { TotalPremium: c.before }, { TotalPremium: c.after, file: fileName });
  return result;
}

// -------------------------------------------------------- installments

// Stored installments of these vehicles by "<VehicleId>|<number>" (unique in the DB).
async function instExisting(db: Tx | typeof prisma, vids: string[]) {
  const found = vids.length
    ? await db.installmentsVehicle.findMany({
        where: { VehicleId: { in: vids }, Vehicle: { TenantId: T } },
        select: { InstallmentsVehicleId: true, VehicleId: true, InstallmentNumber: true, DatePay: true },
      })
    : [];
  return new Map(found.map((f) => [`${f.VehicleId}|${f.InstallmentNumber}`, { id: f.InstallmentsVehicleId, paid: !!f.DatePay }]));
}

export async function previewInstallments(wb: WorkBook): Promise<Preview> {
  const rows = parseInstallmentWorkbook(wb);
  const { vehicles, match } = await loadMatcher();
  const matched = rows.map((r) => match(r.label, r.asset));
  const seen = await instExisting(prisma, matched.filter((v): v is string => !!v));

  return {
    vehicles: vehicleOptions(vehicles),
    items: rows.map((r, i) => {
      const vid = matched[i];
      const stored = vid ? r.items.map((it) => seen.get(`${vid}|${it.no}`)) : [];
      const nos = r.items.map((it) => it.no);
      return {
        key: r.key,
        label: r.label,
        detail: [
          r.asset !== r.label && r.asset,
          r.payNote,
          r.dueDay ? null : "ไม่พบวันที่ชำระในไฟล์: ใช้วันที่ 1",
          r.repeated.length && `เลขงวดซ้ำ ข้าม: ${r.repeated.join(", ")}`,
        ]
          .filter(Boolean)
          .join(" · "),
        summary: `งวด ${Math.min(...nos)}-${Math.max(...nos)}/${r.periods} (${r.items.length} งวด) · ${baht(r.amount)}/งวด · จ่ายแล้ว ${r.items.filter((it) => it.paid).length} งวด`,
        newPlate: newPlateText(r.label),
        match: vid,
        count: r.items.length,
        dup: stored.filter(Boolean).length,
        notes: r.items.filter((it, k) => it.paid && stored[k] && !stored[k]!.paid).length,
      };
    }),
  };
}

export async function commitInstallments(
  wb: WorkBook,
  decisions: Record<string, Decision>,
  username: string,
  fileName: string
): Promise<CommitResult> {
  const rows = parseInstallmentWorkbook(wb);
  const { match, valid } = await loadMatcher();

  const { result, paidIds } = await prisma.$transaction(async (tx) => {
    const creator = vehicleCreator(tx, username);
    const targets: { vid: string; row: InstallmentRow }[] = [];
    let skipped = 0;
    for (const r of rows) {
      const auto = match(r.label, r.asset);
      const d = decisions[r.key] ?? auto ?? "new";
      if (d === "skip" || (d !== "new" && !valid.has(d))) {
        skipped += r.items.length;
        continue;
      }
      const vid = d === "new" ? await creator.create(r.label, r.asset) : d;
      if (d !== "new" && d !== auto) await rememberAlias(tx, r.label, d, username);
      targets.push({ vid, row: r });
    }

    const seen = await instExisting(tx, targets.map((t) => t.vid));
    const data: Prisma.InstallmentsVehicleCreateManyInput[] = [];
    const paidIds: { id: string; due: Date }[] = [];
    let dup = 0;
    for (const { vid, row } of targets) {
      for (const it of row.items) {
        const k = `${vid}|${it.no}`;
        const old = seen.get(k);
        const due = utc(it.due);
        if (old) {
          dup++;
          // The file is the office's payment record: a green month marks a stored unpaid row paid.
          if (it.paid && !old.paid) paidIds.push({ id: old.id, due });
          continue;
        }
        seen.set(k, { id: "", paid: it.paid });
        data.push({
          VehicleId: vid,
          Status: it.paid ? "paid" : "active",
          InstallmentNumber: it.no,
          DueDate: due,
          Amount: row.amount,
          // The file shows that it was paid, not when: the due date stands in.
          DatePay: it.paid ? due : null,
          CreatedByUsername: username,
          UpdatedByUsername: username,
        });
      }
    }
    // skipDuplicates: a row someone added by hand since the check above is left alone.
    const created = data.length ? (await tx.installmentsVehicle.createMany({ data, skipDuplicates: true })).count : 0;
    const marked: typeof paidIds = [];
    for (const p of paidIds) {
      const { count } = await tx.installmentsVehicle.updateMany({
        where: { InstallmentsVehicleId: p.id, DatePay: null },
        data: { DatePay: p.due, Status: "paid", UpdatedByUsername: username, UpdatedAt: new Date() },
      });
      if (count) marked.push(p);
    }

    const all = rows.flatMap((r) => r.items.map(() => r.amount));
    await tx.importLog.create({
      data: {
        TenantId: T,
        FileName: fileName,
        FileRows: all.length,
        FileSum: all.reduce((a, n) => a + n, 0),
        CreatedRows: created,
        CreatedSum: data.reduce((a, r) => a + Number(r.Amount), 0),
        DupRows: dup + data.length - created,
        CreatedByUsername: username,
      },
    });
    return {
      result: { created, dup: dup + data.length - created, skipped, vehiclesCreated: creator.count(), notesUpdated: marked.length },
      paidIds: marked,
    };
  });

  for (const p of paidIds) await audit("installment", p.id, "pay-import", username, { DatePay: null }, { DatePay: p.due, file: fileName });
  return result;
}
