import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { num, thDate } from "@/lib/format";
import { bkkDateTime, effectiveApproval, getPurchaseOrder, VAT_TYPE_LABEL } from "@/lib/po/purchase-orders";
import { ApprovalBadge, DocStatBadge } from "../badges";
import { ApprovalPanel } from "./ApprovalPanel";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PurchaseOrderPage({ params }: { params: Promise<{ poNo: string }> }) {
  const { poNo } = await params;
  const [found, s] = await Promise.all([getPurchaseOrder(decodeURIComponent(poNo)), getSession()]);
  if (!found) notFound();
  const { row, po } = found;
  const sup = po.supplier;

  const info: [string, React.ReactNode][] = [
    ["วันที่", thDate(po.poDate)],
    ["รับของวันที่", thDate(po.receiveDate)],
    ["แผนก", po.depCode ? `${po.depCode} ${po.depName}` : "-"],
    ["เครดิต", `${po.payTerm} วัน`],
    ["ประเภทราคา", VAT_TYPE_LABEL[po.vatType] ?? po.vatType],
    ["อ้างอิง", po.yourRef || "-"],
    ["ผู้บันทึก (Express)", po.expressUser || "-"],
    ["แก้ไขล่าสุดใน Express", thDate(po.expressChanged)],
  ];
  if (po.completeDate) info.push([po.docStat === "C" ? "ยกเลิกวันที่" : "ปิดเอกสารวันที่", thDate(po.completeDate)]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={`ใบสั่งซื้อ ${po.poNo}`}
        subtitle={`ข้อมูลจาก Express (ดูอย่างเดียว) · ดึงล่าสุด ${bkkDateTime(row.SyncedAt)}`}
        action={
          <div className="flex gap-2">
            <Link href="/po" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">กลับรายการ</Link>
            <Link href={`/print/po/${encodeURIComponent(po.poNo)}`} className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              🖨 พรีวิว / พิมพ์
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">สถานะ Express:</span> <DocStatBadge stat={row.DocStat} missing={row.MissingInExpress} />
        <span className="ml-3 text-slate-400">อนุมัติ:</span> <ApprovalBadge k={effectiveApproval(row)} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-xs text-slate-400">ผู้จำหน่าย</div>
          <div className="mt-1 font-semibold">{sup.name} <span className="text-xs font-normal text-slate-500">({sup.code})</span></div>
          {sup.address && <div className="whitespace-pre-line text-sm text-slate-300">{sup.address} {sup.zip}</div>}
          <div className="mt-1 text-sm text-slate-400">
            {sup.phone && <>โทร {sup.phone}</>}
            {sup.taxId && <> · เลขผู้เสียภาษี {sup.taxId}</>}
            {sup.branch && <> · สาขา {sup.branch}</>}
          </div>
          {sup.remark && <div className="mt-1 text-sm text-sky-300">{sup.remark}</div>}
        </Card>
        <Card>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-400">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">No.</th>
                <th className="py-2 pr-3">รหัส</th>
                <th className="py-2 pr-3">รายละเอียด</th>
                <th className="py-2 pr-3 text-right">จำนวน</th>
                <th className="py-2 pr-3 text-right">ราคา/หน่วย</th>
                <th className="py-2 pr-3 text-right">จำนวนเงิน</th>
                <th className="py-2 pr-3 text-right">ค้างรับ</th>
                <th className="py-2 text-right">ยกเลิก</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => (
                <tr key={l.seq} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">{l.seq}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{l.code}</td>
                  <td className="py-2 pr-3">{l.name}{l.free && <span className="ml-1 text-xs text-emerald-300">(แถม)</span>}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{num(l.qty, 2)} {l.unit}</td>
                  <td className="py-2 pr-3 text-right">{money(l.price)}</td>
                  <td className="py-2 pr-3 text-right">{money(l.amount)}</td>
                  <td className={`py-2 pr-3 text-right ${l.remainQty > 0 ? "text-amber-300" : "text-slate-500"}`}>{num(l.remainQty, 2)}</td>
                  <td className="py-2 text-right text-slate-500">{l.cancelQty ? num(l.cancelQty, 2) : "-"}</td>
                </tr>
              ))}
              {!po.lines.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">ไม่มีรายการสินค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-400">จำนวนเงิน</dt><dd className="text-right">{money(po.amount)}</dd>
          <dt className="text-slate-400">หักส่วนลด</dt><dd className="text-right">{money(po.discAmt)}</dd>
          <dt className="text-slate-400">ยอดหลังหักส่วนลด</dt><dd className="text-right">{money(po.total)}</dd>
          <dt className="text-slate-400">ภาษีมูลค่าเพิ่ม {po.vatRate}%</dt><dd className="text-right">{money(po.vatAmt)}</dd>
          <dt className="font-semibold">รวมทั้งสิ้น</dt><dd className="text-right font-semibold text-sky-300">{money(po.netAmt)}</dd>
        </dl>
      </Card>

      <ApprovalPanel
        poNo={po.poNo}
        hash={row.ContentHash}
        canApprove={!!s && isAdmin(s)}
        cancelled={row.DocStat === "C" || row.MissingInExpress}
        received={row.DocStat === "M"}
        initial={{
          approvalStatus: row.ApprovalStatus,
          approvalNote: row.ApprovalNote ?? "",
          approvedBy: row.ApprovedBy ?? "",
          approvedAt: row.ApprovedAt?.toISOString() ?? "",
        }}
      />
    </div>
  );
}
