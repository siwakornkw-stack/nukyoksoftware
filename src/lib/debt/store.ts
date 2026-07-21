import { prisma } from "@/lib/db";
import type { DebtRecord, DebtStatus, VersionMeta } from "./types";

// Prisma-backed replacement for dhevadebt's Vercel-Blob store.

type RecordRow = {
  id: string;
  docNo: string;
  docType: string;
  date: string | null;
  customer: string;
  project: string;
  taxId: string;
  dueDate: string | null;
  branch: string;
  value: unknown; // Prisma Decimal
  vat: unknown;
  total: unknown;
  depositRef: string;
  status: string;
  salesperson: string;
};

function toRecord(r: RecordRow): DebtRecord {
  return {
    id: r.id,
    docNo: r.docNo,
    docType: r.docType,
    date: r.date,
    customer: r.customer,
    project: r.project,
    taxId: r.taxId,
    dueDate: r.dueDate,
    branch: r.branch,
    value: Number(r.value),
    vat: Number(r.vat),
    total: Number(r.total),
    depositRef: r.depositRef,
    status: r.status as DebtStatus,
    salesperson: r.salesperson,
  };
}

export async function readVersions(): Promise<{
  currentVersionId: string | null;
  versions: VersionMeta[];
}> {
  const versions = await prisma.debtVersion.findMany({
    orderBy: { uploadedAt: "desc" },
  });
  const current = versions.find((v) => v.isCurrent) ?? null;
  return {
    currentVersionId: current?.id ?? null,
    versions: versions.map((v) => ({
      id: v.id,
      fileName: v.fileName,
      uploadedAt: v.uploadedAt.toISOString(),
      rowCount: v.rowCount,
      totalAmount: Number(v.totalAmount),
    })),
  };
}

export async function getCurrentRecords(): Promise<{
  meta: VersionMeta | null;
  records: DebtRecord[];
}> {
  const current = await prisma.debtVersion.findFirst({ where: { isCurrent: true } });
  if (!current) return { meta: null, records: [] };
  const rows = await prisma.debtRecord.findMany({ where: { versionId: current.id } });
  return {
    meta: {
      id: current.id,
      fileName: current.fileName,
      uploadedAt: current.uploadedAt.toISOString(),
      rowCount: current.rowCount,
      totalAmount: Number(current.totalAmount),
    },
    records: rows.map(toRecord),
  };
}

export async function addVersion(
  fileName: string,
  records: DebtRecord[]
): Promise<VersionMeta> {
  const total = records.reduce((a, r) => a + r.total, 0);
  const version = await prisma.$transaction(async (tx) => {
    await tx.debtVersion.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });
    const v = await tx.debtVersion.create({
      data: {
        fileName,
        rowCount: records.length,
        totalAmount: total,
        isCurrent: true,
      },
    });
    if (records.length) {
      await tx.debtRecord.createMany({
        data: records.map((r) => ({
          versionId: v.id,
          docNo: r.docNo,
          docType: r.docType,
          date: r.date,
          customer: r.customer,
          project: r.project,
          taxId: r.taxId,
          dueDate: r.dueDate,
          branch: r.branch,
          value: r.value,
          vat: r.vat,
          total: r.total,
          depositRef: r.depositRef,
          status: r.status,
          salesperson: r.salesperson,
        })),
      });
    }
    return v;
  });
  return {
    id: version.id,
    fileName: version.fileName,
    uploadedAt: version.uploadedAt.toISOString(),
    rowCount: version.rowCount,
    totalAmount: Number(version.totalAmount),
  };
}

export async function setCurrentVersion(id: string): Promise<boolean> {
  const exists = await prisma.debtVersion.findUnique({ where: { id } });
  if (!exists) return false;
  await prisma.$transaction([
    prisma.debtVersion.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.debtVersion.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  return true;
}

export async function updateRecordStatus(
  docNo: string,
  status: DebtStatus
): Promise<boolean> {
  const current = await prisma.debtVersion.findFirst({ where: { isCurrent: true } });
  if (!current) return false;
  const res = await prisma.debtRecord.updateMany({
    where: { versionId: current.id, docNo },
    data: { status },
  });
  return res.count > 0;
}
