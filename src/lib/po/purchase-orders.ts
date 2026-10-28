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
// Over-long text is cut, not dropped (a .max() failure would blank the field).
const text = (max = 200) => z.string().catch("").transform((s) => s.slice(0, max));
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
  // Express purchase documents opened "อ้างถึงใบสั่งซื้อ" this PO (APTRN.PONUM).
  receipts: z
    .array(z.object({ docNo: text(20), date: iso.catch(null), netAmt: n, docStat: text(1) }))
    .max(200)
    .catch([]),
});

export type PoData = z.infer<typeof poSchema>;
export type PoLine = PoData["lines"][number];

export const DOC_STAT_LABEL: Record<string, string> = { N: "ค้างรับ", M: "รับครบแล้ว", C: "ยกเลิก" };
export const VAT_TYPE_LABEL: Record<string, string> = { "0": "ไม่มี VAT", "1": "รวม VAT", "2": "แยก VAT" };
export const APPROVAL_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", auto: "อนุมัติแล้ว (รับครบ)", rejected: "ไม่อนุมัติ", none: "-" } as const;
export type ApprovalKey = keyof typeof APPROVAL_LABEL;

// The approval a PO effectively has. A PO Express shows as fully received (M)
// counts as approved even without a decision here (the office's rule: goods
// received means it was approved). Not a PK: an admin's approval here is what
// writes its R3, and a PK is already received when its H3 is keyed or written
// with it from a fuel bill. Cancelled/deleted POs need no decision.
export function effectiveApproval(p: { PoNo: string; ApprovalStatus: string | null; DocStat: string; MissingInExpress?: boolean }): ApprovalKey {
  if (p.ApprovalStatus === "approved" || p.ApprovalStatus === "rejected") return p.ApprovalStatus;
  if (p.DocStat === "M" && !isPk(p.PoNo)) return "auto";
  if (p.DocStat === "C" || p.MissingInExpress) return "none";
  return "pending";
}

// PK (ใบสั่งซื้อ-น้ำมัน(ใหม่)) → H3 (paid on the card, keyed in Express) →
// approved here → R3 (ตั้งหนี้บัตรเครดิต to 0009). Approving queues the R3
// (R3Status "queued"); the office PC (scripts/express-po-sync.mjs, EXPRESS_R3_MODE)
// writes it into Express from the PK's H3 and reports back through
// /api/cron/express-r3. The sync reads every R3 back: one opened "อ้างถึงใบสั่งซื้อ"
// (PONUM) or one we wrote (PK number in REFNUM) becomes R3DocNo.
export const isPk = (poNo: string) => poNo.startsWith("PK");
export const firstR3 = (po: Pick<PoData, "receipts">): string | null =>
  po.receipts.find((r) => r.docNo.startsWith("R3") && r.docStat !== "C")?.docNo ?? null;
export type R3State =
  | { state: "opened"; docNo: string }
  | { state: "queued" }
  | { state: "waiting" } // no H3 for the PK in Express yet
  | { state: "error"; error: string }
  | null;
export function r3State(p: { PoNo: string; ApprovalStatus: string | null; R3DocNo: string | null; R3Status?: string | null; R3Error?: string | null }): R3State {
  if (!isPk(p.PoNo)) return null;
  if (p.R3DocNo) return { state: "opened", docNo: p.R3DocNo };
  if (p.ApprovalStatus !== "approved") return null;
  if (p.R3Status === "waiting") return { state: "waiting" };
  if (p.R3Status === "error") return { state: "error", error: p.R3Error || "สร้าง R3 ไม่สำเร็จ" };
  return { state: "queued" };
}
// Approved PKs still without an R3 (queued, waiting for H3, or failed).
export const r3WaitingWhere: Prisma.PurchaseOrderWhereInput = { PoNo: { startsWith: "PK" }, ApprovalStatus: "approved", R3DocNo: null };
// What the office PC should try now: failed ones wait for an admin's "ลองใหม่".
export const r3QueueWhere: Prisma.PurchaseOrderWhereInput = {
  ...r3WaitingWhere,
  TenantId: DEFAULT_TENANT_ID,
  MissingInExpress: false,
  DocStat: { not: "C" },
  OR: [{ R3Status: null }, { R3Status: { in: ["queued", "waiting"] } }],
};

// effectiveApproval as a Prisma filter (tabs on /po). "approved" includes "auto".
export function approvalWhere(k: string): Prisma.PurchaseOrderWhereInput {
  const pk = { PoNo: { startsWith: "PK" } };
  if (k === "pending") return { ApprovalStatus: null, MissingInExpress: false, OR: [{ DocStat: { notIn: ["M", "C"] } }, { DocStat: "M", ...pk }] };
  if (k === "approved") return { OR: [{ ApprovalStatus: "approved" }, { ApprovalStatus: null, DocStat: "M", NOT: pk }] };
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
    R3DocNo: firstR3(po),
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
    let old = byNo.get(po.poNo);
    if (!old) {
      try {
        await prisma.purchaseOrder.create({ data: { TenantId: DEFAULT_TENANT_ID, PoNo: po.poNo, ...columns(po, hash) } });
        created++;
        continue;
      } catch (e) {
        // Another sync run created it meanwhile: update that row instead.
        if ((e as Prisma.PrismaClientKnownRequestError)?.code !== "P2002") throw e;
        old = (await prisma.purchaseOrder.findUnique({
          where: { TenantId_PoNo: { TenantId: DEFAULT_TENANT_ID, PoNo: po.poNo } },
          select: { PurchaseOrderId: true, PoNo: true, ContentHash: true, ApprovalStatus: true, ApprovalNote: true, ApprovedBy: true, ApprovedAt: true },
        }))!;
      }
    }
    // Cleared whenever the signed content changed, whatever `old` said: an
    // approval may have landed after the read above (it matched the old hash),
    // and must not survive onto figures nobody approved.
    const changed = old.ContentHash !== hash;
    await prisma.purchaseOrder.update({
      where: { PurchaseOrderId: old.PurchaseOrderId },
      // A queued R3 was for the old figures: it leaves the queue with the approval.
      data: {
        ...columns(po, hash),
        ...(changed ? { ApprovalStatus: null, ApprovalNote: null, ApprovedBy: null, ApprovedAt: null, R3Status: null, R3Error: null } : {}),
      },
    });
    updated++;
    if (changed && old.ApprovalStatus) {
      reset++;
      const before = { PoNo: old.PoNo, ApprovalStatus: old.ApprovalStatus, ApprovalNote: old.ApprovalNote, ApprovedBy: old.ApprovedBy, ApprovedAt: old.ApprovedAt };
      await audit("PurchaseOrder", old.PurchaseOrderId, "express-changed", "express-sync", before, { PoNo: old.PoNo, ApprovalStatus: null });
    }
  }
  return { created, updated, reset };
}

const companySchema = z.object({ name: text(), address: text(500), phone: text(), taxId: text() });

// Every sync request carries the Express company (ISINFO). Once one company is
// stored, data from another one is refused: EXPRESS_DIR pointing at another
// company or year folder would otherwise mix its POs into ours.
export async function checkCompany(company: unknown): Promise<string | null> {
  const c = companySchema.safeParse(company);
  if (!c.success || !c.data.name) return "ไม่มีข้อมูลบริษัทจาก Express (อัปเดต scripts/express-po-sync.mjs บนเครื่องที่มี Express)";
  const stored = await getExpressCompany();
  if (stored && (stored.taxId !== c.data.taxId || stored.name !== c.data.name)) {
    return `ข้อมูลมาจากบริษัท "${c.data.name}" (${c.data.taxId}) ไม่ใช่ "${stored.name}" (${stored.taxId}): ตรวจ EXPRESS_DIR บนเครื่องที่มี Express`;
  }
  return null;
}

// Final call of a sync run: flag POs no longer in Express, store the letterhead
// and the sync time. Refuses when most POs would vanish at once: that is a
// wrong folder or a half-read file, not deletions in Express.
export async function finishSync(allPoNos: string[], company: unknown): Promise<SyncInfo | { error: string }> {
  const keep = new Set(allPoNos);
  const ours = await prisma.purchaseOrder.findMany({ where: { TenantId: DEFAULT_TENANT_ID }, select: { PoNo: true, MissingInExpress: true } });
  const gone = ours.filter((p) => !keep.has(p.PoNo)).map((p) => p.PoNo);
  const present = ours.filter((p) => !p.MissingInExpress).length;
  const newlyGone = ours.filter((p) => !keep.has(p.PoNo) && !p.MissingInExpress).length;
  if (present >= 20 && newlyGone > present / 2) {
    return { error: `Express มี PO ${allPoNos.length} ใบ แต่ในระบบมี ${present} ใบ: ไม่ติดป้าย "ถูกลบ" ให้ ตรวจ EXPRESS_DIR` };
  }
  const back = ours.filter((p) => keep.has(p.PoNo) && p.MissingInExpress).map((p) => p.PoNo);
  if (gone.length) await prisma.purchaseOrder.updateMany({ where: { TenantId: DEFAULT_TENANT_ID, PoNo: { in: gone } }, data: { MissingInExpress: true } });
  if (back.length) await prisma.purchaseOrder.updateMany({ where: { TenantId: DEFAULT_TENANT_ID, PoNo: { in: back } }, data: { MissingInExpress: false } });

  const info: SyncInfo = { at: new Date().toISOString(), count: allPoNos.length, missing: gone.length };
  await setSetting(SYNC_KEY, JSON.stringify(info));
  const c = companySchema.safeParse(company);
  if (c.success && c.data.name) await setSetting(COMPANY_KEY, JSON.stringify(c.data));
  return info;
}

// No successful sync for this long = the office PC (Task Scheduler, every
// minute) is off, logged out or failing.
export const SYNC_MAX_AGE_MS = 60 * 60 * 1000;
export async function syncStale(): Promise<{ stale: boolean; at: string | null }> {
  const s = await getSyncInfo();
  return { stale: !s || Date.now() - new Date(s.at).getTime() > SYNC_MAX_AGE_MS, at: s?.at ?? null };
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
