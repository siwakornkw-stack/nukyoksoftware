// Company income from the office's monthly "รายรับ MM.69" workbooks. The files
// carry no vehicle, so rows are stored as IncomeVehicle with VehicleId null: they
// count in the report totals and the monthly chart, not in per-vehicle P&L.
// Several files go in one request (a year is twelve files). Re-importing is safe:
// a sales-tax document is keyed by its number, a cash bill by number + date
// (one bill can be paid in parts on different days).
import type { WorkBook } from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { SheetError, parseIncomeWorkbook, type IncomeRow } from "./office-sheets";

const T = DEFAULT_TENANT_ID;
const SOURCE = { tax: "sales-tax", cash: "cash-bill" } as const;

export interface IncomeFile {
  name: string;
  wb: WorkBook;
}

export interface IncomePreviewSheet {
  file: string;
  sheet: string;
  kind: "tax" | "cash";
  rows: number;
  sum: number;
  cancelled: number;
  dup: number; // already stored, or listed earlier in this batch
  newRows: number;
  newSum: number;
  from: string;
  to: string;
}

const rowKey = (r: IncomeRow) => (r.kind === "tax" ? `tax|${r.docNo}` : `cash|${r.docNo}|${r.date}`);

async function stored(db: Prisma.TransactionClient | typeof prisma) {
  const found = await db.incomeVehicle.findMany({
    where: { TenantId: T, SourceLabel: { in: [SOURCE.tax, SOURCE.cash] } },
    select: { SourceLabel: true, InvoiceNumber: true, DateTime: true },
  });
  return new Set(
    found.map((f) =>
      f.SourceLabel === SOURCE.tax ? `tax|${f.InvoiceNumber}` : `cash|${f.InvoiceNumber}|${f.DateTime.toISOString().slice(0, 10)}`
    )
  );
}

// Parses every file first so a bad date in any of them stops the whole batch
// before anything is written. The error lists every bad file, not just the first.
function parseAll(files: IncomeFile[]) {
  const errors: string[] = [];
  const out = files.map((f) => {
    try {
      return { file: f.name, sheets: parseIncomeWorkbook(f.wb) };
    } catch (e) {
      if (!(e instanceof SheetError)) throw e;
      errors.push(`${f.name}: ${e.message.replace(/^แก้ไฟล์ก่อนนำเข้า: /, "")}`);
      return { file: f.name, sheets: [] };
    }
  });
  if (errors.length) throw new SheetError(`แก้ไฟล์ก่อนนำเข้า: ${errors.join(" · ")}`);
  return out;
}

export async function previewIncome(files: IncomeFile[]): Promise<IncomePreviewSheet[]> {
  const parsed = parseAll(files);
  const seen = await stored(prisma);
  const out: IncomePreviewSheet[] = [];
  for (const { file, sheets } of parsed) {
    for (const s of sheets) {
      let dup = 0;
      let newSum = 0;
      for (const r of s.rows) {
        const k = rowKey(r);
        if (seen.has(k)) dup++;
        else {
          seen.add(k);
          newSum += r.amount;
        }
      }
      const dates = s.rows.map((r) => r.date).sort();
      out.push({
        file,
        sheet: s.sheet,
        kind: s.kind,
        rows: s.rows.length,
        sum: s.rows.reduce((a, r) => a + r.amount, 0),
        cancelled: s.cancelled,
        dup,
        newRows: s.rows.length - dup,
        newSum,
        from: dates[0] ?? "",
        to: dates[dates.length - 1] ?? "",
      });
    }
  }
  return out;
}

export async function commitIncome(files: IncomeFile[], username: string) {
  const parsed = parseAll(files);
  return prisma.$transaction(async (tx) => {
    const seen = await stored(tx);
    let created = 0;
    let dup = 0;
    let sum = 0;
    for (const { file, sheets } of parsed) {
      const all = sheets.flatMap((s) => s.rows);
      const data: Prisma.IncomeVehicleCreateManyInput[] = [];
      for (const r of all) {
        const k = rowKey(r);
        if (seen.has(k)) {
          dup++;
          continue;
        }
        seen.add(k);
        const day = new Date(`${r.date}T00:00:00.000Z`);
        data.push({
          TenantId: T,
          VehicleId: null,
          Status: "active",
          SourceLabel: SOURCE[r.kind],
          CustomerName: r.customer || null,
          Description: r.project,
          DateTime: day,
          ReceiveDate: day,
          Time: "",
          WorkOrderNumber: "",
          InvoiceNumber: r.docNo.slice(0, 50),
          AmountReceive: r.amount,
          CreatedByUsername: username,
          UpdatedByUsername: username,
        });
      }
      if (data.length) await tx.incomeVehicle.createMany({ data });
      const fileNew = data.reduce((a, d) => a + Number(d.AmountReceive), 0);
      created += data.length;
      sum += fileNew;
      await tx.importLog.create({
        data: {
          TenantId: T,
          FileName: file,
          FileRows: all.length,
          FileSum: all.reduce((a, r) => a + r.amount, 0),
          CreatedRows: data.length,
          CreatedSum: fileNew,
          DupRows: all.length - data.length,
          CreatedByUsername: username,
        },
      });
    }
    return { created, dup, sum };
  });
}
