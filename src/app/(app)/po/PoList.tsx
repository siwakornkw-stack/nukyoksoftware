import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { PageHeader, Card } from "@/components/ui";
import { baht, thDate } from "@/lib/format";
import { dec } from "@/lib/fleet/queries";
import { getSession, isAdmin } from "@/lib/auth";
import { approvalWhere, bkkDateTime, effectiveApproval, getSyncInfo, r3State, r3WaitingWhere } from "@/lib/po/purchase-orders";
import { ApprovalBadge, DocStatBadge, R3Badge } from "./badges";
import { QuickApprove } from "./QuickApprove";

export type SP = { q?: string; ap?: string; ex?: string; from?: string; to?: string; page?: string };

const AP_TABS = [
  { key: "pending", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ไม่อนุมัติ" },
  { key: "all", label: "ทั้งหมด" },
];
// PK: approved but no R3 (ตั้งหนี้บัตรเครดิต) opened in Express yet.
const PK_TABS = [AP_TABS[0], AP_TABS[1], { key: "r3wait", label: "รอ R3" }, AP_TABS[2], AP_TABS[3]];
const EX_OPTS = [
  { key: "", label: "ทุกสถานะ Express" },
  { key: "N", label: "ค้างรับ" },
  { key: "M", label: "รับครบแล้ว" },
  { key: "C", label: "ยกเลิก" },
];
const PAGE = 50;
const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

// Express keeps every PO book in POPR, told apart by the number prefix (ISRUN):
// PO ใบสั่งซื้อ, PP ใบสั่งซื้อ-น้ำมัน, PK ใบสั่งซื้อ-น้ำมัน(ใหม่). PK has its own menu.
export const PO_BOOKS = {
  main: { title: "ใบสั่งซื้อ (PO)", path: "/po", where: { NOT: { PoNo: { startsWith: "PK" } } } },
  pk: { title: "ใบสั่งซื้อน้ำมันใหม่ (PK)", path: "/po/pk", where: { PoNo: { startsWith: "PK" } } },
} satisfies Record<string, { title: string; path: string; where: Prisma.PurchaseOrderWhereInput }>;
export type PoBook = keyof typeof PO_BOOKS;

// The /po list, shared by the PO menu and the PK (new fuel PO) menu.
export async function PoList({ sp, book }: { sp: SP; book: PoBook }) {
  const { title, path, where: bookWhere } = PO_BOOKS[book];
  const q = sp.q?.trim() ?? "";
  const tabs = book === "pk" ? PK_TABS : AP_TABS;
  const ap = tabs.some((t) => t.key === sp.ap) ? sp.ap! : "pending";
  const ex = EX_OPTS.some((o) => o.key === sp.ex) ? sp.ex! : "";
  const from = isoDate(sp.from), to = isoDate(sp.to);
  const page = Math.max(1, Number(sp.page) || 1);

  const base: Prisma.PurchaseOrderWhereInput = {
    TenantId: DEFAULT_TENANT_ID,
    AND: [bookWhere],
    ...(q ? { OR: [{ PoNo: { contains: q, mode: "insensitive" } }, { SupplierName: { contains: q } }, { SupplierCode: { contains: q } }, { DepName: { contains: q } }] } : {}),
    ...(ex ? { DocStat: ex } : {}),
    ...(from || to ? { PoDate: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } } : {}),
  };
  // AND, not a spread: both sides may filter DocStat (the tab and the Express
  // status filter), and a spread let the tab's condition replace the filter.
  const tabWhere = (k: string): Prisma.PurchaseOrderWhereInput => ({ AND: [base, k === "r3wait" ? r3WaitingWhere : approvalWhere(k)] });
  const where = tabWhere(ap);

  const [rows, total, counts, sync, s] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ PoDate: "desc" }, { PoNo: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { PoNo: true, PoDate: true, SupplierName: true, DepName: true, NetAmt: true, DocStat: true, MissingInExpress: true, ApprovalStatus: true, ApprovedBy: true, ContentHash: true, R3DocNo: true, R3Status: true, R3Error: true },
    }),
    prisma.purchaseOrder.count({ where }),
    Promise.all(tabs.map((t) => prisma.purchaseOrder.count({ where: tabWhere(t.key) }))),
    getSyncInfo(),
    getSession(),
  ]);
  const admin = !!s && isAdmin(s);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const keep: Record<string, string> = {};
  if (q) keep.q = q;
  if (ex) keep.ex = ex;
  if (from) keep.from = from;
  if (to) keep.to = to;
  const link = (p: Record<string, string>) => `${path}?${new URLSearchParams({ ...keep, ap, ...p })}`;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={title}
        subtitle={
          sync
            ? `ดึงจาก Express ล่าสุด ${bkkDateTime(sync.at)} · ${sync.count.toLocaleString("th-TH")} ใบ · ดูอย่างเดียว ไม่แก้ไขข้อมูลใน Express`
            : "ยังไม่เคยดึงข้อมูลจาก Express (รัน scripts/express-po-sync.mjs บนเครื่องที่มี Express)"
        }
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2" action={path}>
          <input type="hidden" name="ap" value={ap} />
          <label className="text-xs text-slate-400">
            ค้นหา
            <input name="q" defaultValue={q} className="field mt-1 w-64" placeholder="เลขที่ PO / ผู้จำหน่าย / แผนก" />
          </label>
          <label className="text-xs text-slate-400">
            สถานะ Express
            <select name="ex" defaultValue={ex} className="field mt-1">
              {EX_OPTS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            ตั้งแต่วันที่
            <input type="date" name="from" defaultValue={from} className="field mt-1" />
          </label>
          <label className="text-xs text-slate-400">
            ถึงวันที่
            <input type="date" name="to" defaultValue={to} className="field mt-1" />
          </label>
          <button className="rounded-lg px-3 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">ค้นหา</button>
          {(q || ex || from || to) && (
            <Link href={`${path}?ap=${ap}`} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">ล้าง</Link>
          )}
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <Link
            key={t.key}
            href={link({ ap: t.key })}
            className={`rounded-lg px-3 py-1.5 text-sm ${t.key === ap ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-white"}`}
          >
            {t.label} ({counts[i].toLocaleString("th-TH")})
          </Link>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">เลขที่</th>
                <th className="py-2 pr-3">วันที่</th>
                <th className="py-2 pr-3">ผู้จำหน่าย</th>
                <th className="py-2 pr-3">แผนก</th>
                <th className="py-2 pr-3 text-right">ยอดสุทธิ</th>
                <th className="py-2 pr-3">สถานะ Express</th>
                <th className="py-2 pr-3">อนุมัติ</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.PoNo} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">
                    <Link href={`/po/${encodeURIComponent(r.PoNo)}`} className="text-sky-400 hover:underline">{r.PoNo}</Link>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{thDate(r.PoDate?.toISOString())}</td>
                  <td className="py-2 pr-3">{r.SupplierName || "-"}</td>
                  <td className="py-2 pr-3 text-slate-400">{r.DepName || "-"}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{baht(dec(r.NetAmt))}</td>
                  <td className="py-2 pr-3"><DocStatBadge stat={r.DocStat} missing={r.MissingInExpress} /></td>
                  <td className="py-2 pr-3">
                    {(() => {
                      const k = effectiveApproval(r);
                      if (k === "pending" && admin) return <QuickApprove poNo={r.PoNo} hash={r.ContentHash} summary={`${r.SupplierName} · ${baht(dec(r.NetAmt))}`} />;
                      return (
                        <>
                          <ApprovalBadge k={k} />
                          {r.ApprovedBy && <div className="text-xs text-slate-500">{r.ApprovedBy}</div>}
                          {book === "pk" && (
                            <div className="mt-1">
                              <R3Badge r3={r3State(r)} />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link href={`/print/po/${encodeURIComponent(r.PoNo)}`} className="text-xs text-slate-400 hover:text-white">🖨 พรีวิว</Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {book === "pk" && !counts[tabs.findIndex((t) => t.key === "all")] && !(q || ex || from || to)
                      ? "ยังไม่มีใบสั่งซื้อ PK ใน Express (สร้างที่ Express: ซื้อ → ใบสั่งซื้อ → ใบสั่งซื้อ-น้ำมัน(ใหม่) แล้วระบบจะดึงมาภายใน 1-2 นาที)"
                      : "ไม่มีใบสั่งซื้อในกลุ่มนี้"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
            <span>หน้า {page} / {pages} · {total.toLocaleString("th-TH")} ใบ</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={link({ page: String(page - 1) })} className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">ก่อนหน้า</Link>}
              {page < pages && <Link href={link({ page: String(page + 1) })} className="rounded-lg px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60">ถัดไป</Link>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
