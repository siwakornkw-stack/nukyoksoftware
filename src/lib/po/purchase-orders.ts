import { createHash } from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

// Purchase orders copied from Express (scripts/express-po-sync.mjs) and
// approved here. Nothing in this module talks to Express: the sync script on
// the office PC only reads the Express files and pushes them to
// /api/cron/express-po.

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const text = (max = 200) => z.string().max(max).catch("");
const n = z.number().finite().catch(0);

const lineSchema = z.object({
  seq: n,
  code: text(),
  name: text(),
  location: text(),
  qty: n,
  cancelQty: n,
  cancelDate: iso.catch(null),
  remainQty: n,
  unitCode: text(),
  unit: text(),
  price: n,
  disc: text(),
  discAmt: n,
  amount: n,
  receiveDate: iso.catch(null),
  free: z.boolean().catch(false),
});

export const poSchema = z.object({
  poNo: z.string().trim().min(1).max(20),
  poDate: iso,
  vatType: text(),
  depCode: text(),
  depName: text(),
  supplier: z.object({
    code: text(),
    name: text(),
    address: text(500),
    zip: text(),
    phone: text(),
    taxId: text(),
    branch: text(),
    remark: text(),
  }),
  yourRef: text(),
  payTerm: n,
  receiveDate: iso.catch(null),
  shipTo: text(),
  place: text(),
  amount: n,
  disc: text(),
  discAmt: n,
  total: n,
  vatRate: n,
  vatAmt: n,
  netAmt: n,
  docStat: text(),
  completeDate: iso.catch(null),
  expressUser: text(),
  expressChanged: iso.catch(null),
  expressApprovedBy: text(),
  expressApproved: iso.catch(null),
  lines: z.array(lineSchema).max(500),
});

export type PoData = z.infer<typeof poSchema>;
export type PoLine = PoData["lines"][number];

export const DOC_STAT_LABEL: Record<string, string> = { N: "ค้างรับ", M: "รับครบแล้ว", C: "ยกเลิก" };
export const VAT_TYPE_LABEL: Record<string, string> = { "0": "ไม่มี VAT", "1": "รวม VAT", "2": "แยก VAT" };
export const APPROVAL_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", auto: "อนุมัติแล้ว (รับครบ)", rejected: "ไม่อนุมัติ", none: "-" } as const;
export type ApprovalKey = keyof typeof APPROVAL_LABEL;

// The approval a PO effectively has. A PO Express shows as fully received (M)
// counts as approved even without a decision here (the office's rule: goods
// received means it was approved). Cancelled/deleted POs need no decision.
export function effectiveApproval(p: { ApprovalStatus: string | null; DocStat: string; MissingInExpress?: boolean }): ApprovalKey {
  if (p.ApprovalStatus === "approved" || p.ApprovalStatus === "rejected") return p.ApprovalStatus;
  if (p.DocStat === "M") return "auto";
  if (p.DocStat === "C" || p.MissingInExpress) return "none";
  return "pending";
}

// effectiveApproval as a Prisma filter (tabs on /po). "approved" includes "auto".
export function approvalWhere(k: string): Prisma.PurchaseOrderWhereInput {
  if (k === "pending") return { ApprovalStatus: null, DocStat: { notIn: ["M", "C"] }, MissingInExpress: false };
  if (k === "approved") return { OR: [{ ApprovalStatus: "approved" }, { ApprovalStatus: null, DocStat: "M" }] };
  if (k === "rejected") return { ApprovalStatus: "rejected" };
  return {};
}

// What an approver signs off on. Receiving progress (remaining qty, status,
// complete date) is left out so goods arriving does not undo an approval.
export function contentHash(po: PoData): string {
  const signed = {
    poNo: po.poNo,
    poDate: po.poDate,
    supplier: po.supplier.code,
    depCode: po.depCode,
    vatType: po.vatType,
    discAmt: po.discAmt,
    vatAmt: po.vatAmt,
    netAmt: po.netAmt,
    lines: po.lines.map((l) => [l.code, l.name, l.qty, l.cancelQty, l.unitCode, l.price, l.discAmt, l.amount]),
  };
  return createHash("sha1").update(JSON.stringify(signed)).digest("hex");
}

// "DD/MM/พ.ศ. HH:MM" in Bangkok time for server-rendered pages (the server runs TZ=UTC).
const bkkFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export function bkkDateTime(v: Date | string | null | undefined): string {
  if (!v) return "-";
  const p = Object.fromEntries(bkkFmt.formatToParts(new Date(v)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${Number(p.year) + 543} ${p.hour}:${p.minute}`;
}

const SYNC_KEY = "express_po_sync";
const COMPANY_KEY = "express_company";

export type SyncInfo = { at: string; count: number; missing: number };

function columns(po: PoData, hash: string) {
  return {
    PoDate: po.poDate ? new Date(`${po.poDate}T00:00:00Z`) : null,
    SupplierCode: po.supplier.code,
    SupplierName: po.supplier.name,
    DepCode: po.depCode,
    DepName: po.depName,
    NetAmt: po.netAmt,
    DocStat: po.docStat.slice(0, 1),
    Data: po as unknown as Prisma.InputJsonValue,
    ContentHash: hash,
    MissingInExpress: false,
    SyncedAt: new Date(),
  };
}

// Upsert one batch. A decided PO whose signed content changed in Express goes
// back to pending (logged), like an edited fuel row losing its check.
export async function upsertPurchaseOrders(list: PoData[]): Promise<{ created: number; updated: number; reset: number }> {
  const existing = await prisma.purchaseOrder.findMany({
    where: { TenantId: DEFAULT_TENANT_ID, PoNo: { in: list.map((p) => p.poNo) } },
    select: { PurchaseOrderId: true, PoNo: true, ContentHash: true, ApprovalStatus: true, ApprovalNote: true, ApprovedBy: true, ApprovedAt: true },
  });
  const byNo = new Map(existing.map((e) => [e.PoNo, e]));
  let created = 0, updated = 0, reset = 0;
  for (const po of list) {
    const hash = contentHash(po);
    const old = byNo.get(po.poNo);
    if (!old) {
      await prisma.purchaseOrder.create({ data: { TenantId: DEFAULT_TENANT_ID, PoNo: po.poNo, ...columns(po, hash) } });
      created++;
      continue;
    }
    const clear = old.ApprovalStatus && old.ContentHash !== hash;
    await prisma.purchaseOrder.update({
      where: { PurchaseOrderId: old.PurchaseOrderId },
      data: { ...columns(po, hash), ...(clear ? { ApprovalStatus: null, ApprovalNote: null, ApprovedBy: null, ApprovedAt: null } : {}) },
    });
    updated++;
    if (clear) {
      reset++;
      const before = { PoNo: old.PoNo, ApprovalStatus: old.ApprovalStatus, ApprovalNote: old.ApprovalNote, ApprovedBy: old.ApprovedBy, ApprovedAt: old.ApprovedAt };
      await audit("PurchaseOrder", old.PurchaseOrderId, "express-changed", "express-sync", before, { PoNo: old.PoNo, ApprovalStatus: null });
    }
  }
  return { created, updated, reset };
}

// Final call of a sync run: flag POs no longer in Express, store the letterhead
// and the sync time.
export async function finishSync(allPoNos: string[], company: unknown): Promise<SyncInfo> {
  const keep = new Set(allPoNos);
  const ours = await prisma.purchaseOrder.findMany({ where: { TenantId: DEFAULT_TENANT_ID }, select: { PoNo: true, MissingInExpress: true } });
  const gone = ours.filter((p) => !keep.has(p.PoNo)).map((p) => p.PoNo);
  const back = ours.filter((p) => keep.has(p.PoNo) && p.MissingInExpress).map((p) => p.PoNo);
  if (gone.length) await prisma.purchaseOrder.updateMany({ where: { TenantId: DEFAULT_TENANT_ID, PoNo: { in: gone } }, data: { MissingInExpress: true } });
  if (back.length) await prisma.purchaseOrder.updateMany({ where: { TenantId: DEFAULT_TENANT_ID, PoNo: { in: back } }, data: { MissingInExpress: false } });

  const info: SyncInfo = { at: new Date().toISOString(), count: allPoNos.length, missing: gone.length };
  await setSetting(SYNC_KEY, JSON.stringify(info));
  const c = z.object({ name: text(), address: text(500), phone: text(), taxId: text() }).safeParse(company);
  if (c.success && c.data.name) await setSetting(COMPANY_KEY, JSON.stringify(c.data));
  return info;
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

async function getJson<T>(key: string): Promise<T | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  try {
    return row?.value ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

export const getSyncInfo = () => getJson<SyncInfo>(SYNC_KEY);
export const getExpressCompany = () => getJson<{ name: string; address: string; phone: string; taxId: string }>(COMPANY_KEY);

export async function getPurchaseOrder(poNo: string) {
  const row = await prisma.purchaseOrder.findUnique({ where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: poNo } } });
  if (!row) return null;
  const parsed = poSchema.safeParse(row.Data);
  return parsed.success ? { row, po: parsed.data } : null;
}
