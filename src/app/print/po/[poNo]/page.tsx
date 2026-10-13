import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { bahtText } from "@/lib/baht-text";
import { thDate } from "@/lib/format";
import { bkkDateTime, getExpressCompany, getPurchaseOrder } from "@/lib/po/purchase-orders";
import { PoPrintBar } from "./PoPrintBar";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const MIN_ROWS = 12; // keeps the item box the height of the Express form

// ใบสั่งซื้อ preview, laid out like the Express form (POPRPO). Outside the
// (app) layout so the printout has no sidebar; always light (paper).
export default async function PoPrintPage({ params }: { params: Promise<{ poNo: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { poNo } = await params;
  const found = await getPurchaseOrder(decodeURIComponent(poNo));
  if (!found) notFound();
  const { row, po } = found;
  // Express's own letterhead (ISINFO) when the sync has sent it.
  const company = (await getExpressCompany()) ?? (await getCompany());
  const sup = po.supplier;
  const blanks = Math.max(0, MIN_ROWS - po.lines.length);

  const approved = row.ApprovalStatus === "approved";
  const banner =
    row.DocStat === "C" ? "ยกเลิก" : row.ApprovalStatus === "rejected" ? "ไม่อนุมัติ" : !approved ? "รออนุมัติ" : "";

  return (
    <div className="min-h-screen bg-slate-200 py-6 text-slate-900 print:bg-white print:py-0">
      <PoPrintBar note={banner ? `สถานะ: ${banner}` : `อนุมัติแล้วโดย ${row.ApprovedBy}`} />
      <div className="relative mx-auto w-[210mm] max-w-full bg-white p-[12mm] shadow-lg print:w-auto print:p-0 print:shadow-none">
        {banner && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded-xl border-4 border-rose-300/70 px-8 py-2 text-6xl font-bold text-rose-300/70">{banner}</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-lg font-bold">{company.name}</div>
            {company.address && <div className="whitespace-pre-line text-xs">{company.address}</div>}
            {company.phone && <div className="text-xs">{company.phone}</div>}
            {company.taxId && <div className="mt-1 text-xs">สำนักงานใหญ่ : เลขประจำตัวผู้เสียภาษี {company.taxId}</div>}
          </div>
          <div className="mt-8 rounded bg-sky-100 px-5 py-1.5 text-xl font-semibold">ใบสั่งซื้อ</div>
        </div>

        <div className="mt-4 grid grid-cols-[1.55fr_1fr] gap-1 text-xs">
          <div className="rounded-lg border border-slate-700 p-3">
            <div>
              <span className="font-semibold">เรียน</span> {sup.name}
            </div>
            <div className="ml-7 whitespace-pre-line">{sup.address}{sup.zip && ` ${sup.zip}`}</div>
            {sup.phone && <div className="ml-7">โทร. {sup.phone}</div>}
            {(sup.taxId || sup.branch) && (
              <div className="ml-7">
                {sup.taxId && <>เลขผู้เสียภาษี {sup.taxId}</>} {sup.branch && <>สาขา {sup.branch}</>}
              </div>
            )}
          </div>
          <table className="rounded-lg border border-slate-700 border-separate p-2">
            <tbody>
              <tr><td className="pr-3">เลขที่ใบสั่งซื้อ</td><td className="font-semibold">{po.poNo}</td></tr>
              <tr><td className="pr-3">วันที่</td><td>{thDate(po.poDate)}</td></tr>
              <tr><td className="pr-3">วันที่รับของ</td><td>{thDate(po.receiveDate)}</td></tr>
              <tr><td className="pr-3">หน่วยงาน</td><td>{po.depName || po.depCode || "-"}</td></tr>
              {po.payTerm > 0 && <tr><td className="pr-3">เครดิต</td><td>{po.payTerm} วัน</td></tr>}
              {po.yourRef && <tr><td className="pr-3">อ้างอิง</td><td>{po.yourRef}</td></tr>}
            </tbody>
          </table>
        </div>

        <table className="mt-1 w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-slate-700 px-2 py-1.5 w-10">No.</th>
              <th className="border border-slate-700 px-2 py-1.5">รายละเอียด</th>
              <th className="border border-slate-700 px-2 py-1.5 w-24">จำนวน</th>
              <th className="border border-slate-700 px-2 py-1.5 w-24">หน่วยละ</th>
              <th className="border border-slate-700 px-2 py-1.5 w-28">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.seq} className="align-top">
                <td className="border-x border-slate-700 px-2 py-1 text-center">{l.seq}</td>
                <td className="border-x border-slate-700 px-2 py-1">{l.name}{l.free && " (แถม)"}</td>
                <td className="border-x border-slate-700 px-2 py-1 text-right whitespace-nowrap">{qty(l.qty)} {l.unit}</td>
                <td className="border-x border-slate-700 px-2 py-1 text-right">{money(l.price)}</td>
                <td className="border-x border-slate-700 px-2 py-1 text-right">{money(l.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`b${i}`}>
                {Array.from({ length: 5 }, (_, j) => (
                  <td key={j} className="border-x border-slate-700 px-2 py-1">&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} rowSpan={5} className="border border-slate-700 px-2 py-1.5 align-top">
                <div>หมายเหตุ</div>
                {sup.remark && <div className="mt-1 text-sky-700">{sup.remark}</div>}
                {po.place && <div className="mt-1">สถานที่ส่งของ: {po.place}</div>}
                <div className="mt-3">({bahtText(po.netAmt)})</div>
              </td>
              <td colSpan={2} className="border-t border-slate-700 px-2 pt-1.5">รวมเป็นเงิน</td>
              <td className="border border-slate-700 border-b-0 px-2 pt-1.5 text-right">{money(po.amount)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="px-2">หัก ส่วนลด</td>
              <td className="border-x border-slate-700 px-2 text-right">{money(po.discAmt)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="px-2">จำนวนเงินหลังหักส่วนลด</td>
              <td className="border-x border-slate-700 px-2 text-right">{money(po.total)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="px-2">จำนวนภาษีมูลค่าเพิ่ม {po.vatRate.toFixed(2)} %</td>
              <td className="border-x border-slate-700 px-2 text-right">{money(po.vatAmt)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={2} className="border-b border-slate-700 px-2 pb-1.5">จำนวนเงินรวมทั้งสิ้น</td>
              <td className="border border-t-0 border-slate-700 px-2 pb-1.5 text-right">{money(po.netAmt)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="grid grid-cols-2 gap-10 rounded-b-lg border border-t-0 border-slate-700 px-6 pb-4 pt-10 text-center text-xs">
          <div>
            <div className="flex items-end justify-center gap-1">
              ลงชื่อ<span className="inline-block w-48 border-b border-slate-700" />ผู้สั่งซื้อ
            </div>
            <div className="mt-1">{thDate(po.poDate)}</div>
          </div>
          <div>
            <div className="mx-auto flex h-5 w-48 items-end justify-center border-b border-slate-700 font-semibold text-emerald-700">
              {approved && row.ApprovedBy}
            </div>
            <div className="mt-1">ผู้อนุมัติ</div>
            {approved && row.ApprovedAt && <div className="text-slate-500">{bkkDateTime(row.ApprovedAt)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
