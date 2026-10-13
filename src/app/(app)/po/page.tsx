import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { PageHeader, Card } from "@/components/ui";
import { baht, thDate } from "@/lib/format";
import { dec } from "@/lib/fleet/queries";
import { bkkDateTime, getSyncInfo } from "@/lib/po/purchase-orders";
import { ApprovalBadge, DocStatBadge } from "./badges";

export const dynamic = "force-dynamic";

type SP = { q?: string; ap?: string; ex?: string; from?: string; to?: string; page?: string };

const AP_TABS = [
  { key: "pending", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ไม่อนุมัติ" },
  { key: "all", label: "ทั้งหมด" },
] as const;
const EX_OPTS = [
  { key: "", label: "ทุกสถานะ Express" },
  { key: "N", label: "ค้างรับ" },
  { key: "M", label: "รับครบแล้ว" },
  { key: "C", label: "ยกเลิก" },
];
const PAGE = 50;
const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

const approvalWhere = (k: string): Prisma.PurchaseOrderWhereInput =>
  k === "pending"
    ? { ApprovalStatus: null, DocStat: { not: "C" }, MissingInExpress: false } // nothing to approve on a cancelled/deleted PO
    : k === "approved" || k === "rejected"
      ? { ApprovalStatus: k }
      : {};

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const ap = AP_TABS.some((t) => t.key === sp.ap) ? sp.ap! : "pending";
  const ex = EX_OPTS.some((o) => o.key === sp.ex) ? sp.ex! : "";
  const from = isoDate(sp.from), to = isoDate(sp.to);
  const page = Math.max(1, Number(sp.page) || 1);

  const base: Prisma.PurchaseOrderWhereInput = {
    TenantId: DEFAULT_TENANT_ID,
    ...(q ? { OR: [{ PoNo: { contains: q, mode: "insensitive" } }, { SupplierName: { contains: q } }, { SupplierCode: { contains: q } }, { DepName: { contains: q } }] } : {}),
    ...(ex ? { DocStat: ex } : {}),
    ...(from || to ? { PoDate: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } } : {}),
  };
  const where = { ...base, ...approvalWhere(ap) };

  const [rows, total, counts, sync] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ PoDate: "desc" }, { PoNo: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { PoNo: true, PoDate: true, SupplierName: true, DepName: true, NetAmt: true, DocStat: true, MissingInExpress: true, ApprovalStatus: true, ApprovedBy: true },
    }),
    prisma.purchaseOrder.count({ where }),
    Promise.all(AP_TABS.map((t) => prisma.purchaseOrder.count({ where: { ...base, ...approvalWhere(t.key) } }))),
    getSyncInfo(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const keep: Record<string, string> = {};
  if (q) keep.q = q;
  if (ex) keep.ex = ex;
  if (from) keep.from = from;
  if (to) keep.to = to;
  const link = (p: Record<string, string>) => `/po?${new URLSearchParams({ ...keep, ap, ...p })}`;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="ใบสั่งซื้อ (PO)"
        subtitle={
          sync
            ? `ดึงจาก Express ล่าสุด ${bkkDateTime(sync.at)} · ${sync.count.toLocaleString("th-TH")} ใบ · ดูอย่างเดียว ไม่แก้ไขข้อมูลใน Express`
            : "ยังไม่เคยดึงข้อมูลจาก Express (รัน scripts/express-po-sync.mjs บนเครื่องที่มี Express)"
        }
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2" action="/po">
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
            <Link href={`/po?ap=${ap}`} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">ล้าง</Link>
          )}
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {AP_TABS.map((t, i) => (
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
                    <ApprovalBadge status={r.ApprovalStatus} />
                    {r.ApprovedBy && <div className="text-xs text-slate-500">{r.ApprovedBy}</div>}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link href={`/print/po/${encodeURIComponent(r.PoNo)}`} className="text-xs text-slate-400 hover:text-white">🖨 พรีวิว</Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">ไม่มีใบสั่งซื้อในกลุ่มนี้</td>
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
