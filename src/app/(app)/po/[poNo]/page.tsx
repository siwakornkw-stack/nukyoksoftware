import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { getSession, isAdmin } from "@/lib/auth";
import { num, thDate } from "@/lib/format";
import { bkkDateTime, effectiveApproval, getPurchaseOrder, r3State, VAT_TYPE_LABEL } from "@/lib/po/purchase-orders";
import { ApprovalBadge, DocStatBadge, R3Badge } from "../badges";
import { CopyButton } from "../CopyButton";
import { R3Retry } from "./R3Retry";
import { ApprovalPanel } from "./ApprovalPanel";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { ORDER_STATUS_LABEL } from "@/lib/fleet/express-fuel";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PurchaseOrderPage({ params }: { params: Promise<{ poNo: string }> }) {
  const { poNo } = await params;
  const [found, s] = await Promise.all([getPurchaseOrder(decodeURIComponent(poNo)), getSession()]);
  if (!found) notFound();
  const { row, po } = found;
  const sup = po.supplier;
  const r3 = r3State(row);
  // A PK written from a fuel bill on the web: its bill and odometer photos, and
  // where its H3 stands (written by the office PC once the PK is approved).
  const fromBill = row.PoNo.startsWith("PK")
    ? await prisma.expressFuelOrder.findFirst({
        where: { TenantId: DEFAULT_TENANT_ID, PkNo: row.PoNo },
        select: {
          RequestedBy: true,
          CreatedAt: true,
          Status: true,
          WithH3: true,
          H3No: true,
          Error: true,
          GasolineCost: { select: { BillUrl: true, OdometerUrl: true, OdometerStart: true, OdometerEnd: true } },
        },
      })
    : null;

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
            <Link href={po.poNo.startsWith("PK") ? "/po/pk" : "/po"} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">กลับรายการ</Link>
            <Link href={`/print/po/${encodeURIComponent(po.poNo)}`} className="rounded-lg px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              🖨 พรีวิว / พิมพ์
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">สถานะ Express:</span> <DocStatBadge stat={row.DocStat} missing={row.MissingInExpress} />
        <span className="ml-3 text-slate-400">อนุมัติ:</span> <ApprovalBadge k={effectiveApproval(row)} /> <R3Badge r3={r3} />
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

      {fromBill && (
        <Card className="mb-4">
          <div className="mb-2 font-semibold">บิลน้ำมันต้นทาง</div>
          <div className="mb-1 text-sm">
            {ORDER_STATUS_LABEL[fromBill.Status] ?? fromBill.Status}
            {fromBill.H3No && <span className="ml-2 text-slate-300">H3: {fromBill.H3No}</span>}
            {!fromBill.WithH3 && <span className="ml-2 text-xs text-amber-300">รถคันนี้ H3 ต้องคีย์ใน Express เอง</span>}
            {fromBill.Status === "error" && fromBill.Error && <div className="text-xs text-rose-300">{fromBill.Error}</div>}
          </div>
          <div className="mb-2 text-xs text-slate-400">
            บันทึกบนเว็บโดย {fromBill.RequestedBy} · {bkkDateTime(fromBill.CreatedAt)}
            {Number(fromBill.GasolineCost.OdometerEnd) > 0 && (
              <>
                {" "}· เลขไมล์ {Number(fromBill.GasolineCost.OdometerStart) > 0 && <>{num(Number(fromBill.GasolineCost.OdometerStart))} → </>}
                {num(Number(fromBill.GasolineCost.OdometerEnd))}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {[["รูปบิล", fromBill.GasolineCost.BillUrl], ["รูปเลขไมล์", fromBill.GasolineCost.OdometerUrl]].map(([label, url]) =>
              url ? (
                <a key={label} href={url} target="_blank" rel="noreferrer" className="block w-48">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private /uploads photo behind the session */}
                  <img src={url} alt={label ?? ""} className="h-48 w-48 rounded-lg bg-slate-900 object-contain" />
                  <span className="mt-1 block text-center text-xs text-slate-400">{label}</span>
                </a>
              ) : null
            )}
          </div>
        </Card>
      )}

      <ApprovalPanel
        poNo={po.poNo}
        hash={row.ContentHash}
        canApprove={!!s && isAdmin(s)}
        cancelled={row.DocStat === "C" || row.MissingInExpress}
        received={effectiveApproval(row) === "auto"}
        initial={{
          approvalStatus: row.ApprovalStatus,
          approvalNote: row.ApprovalNote ?? "",
          approvedBy: row.ApprovedBy ?? "",
          approvedAt: row.ApprovedAt?.toISOString() ?? "",
        }}
      />

      {r3 && (
        <Card className="mt-4">
          <div className="mb-2 font-semibold">ตั้งหนี้ R3 (บัตรเครดิต)</div>
          {r3.state === "opened" ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              ✅ มี R3 ใน Express แล้ว: <span className="font-semibold">{r3.docNo}</span> <CopyButton value={r3.docNo} label="คัดลอกเลข R3" />
            </div>
          ) : r3.state === "queued" || (r3.state === "waiting" && fromBill?.WithH3 && fromBill.Status !== "done") ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-300">
              ⏳ อนุมัติแล้ว ระบบจะ{fromBill?.WithH3 && fromBill.Status !== "done" ? "เปิด H3 ของบิลนี้ แล้ว" : ""}เพิ่มบิลนี้เข้า R3 ของวันที่บิล (ตั้งหนี้ 0009) ใน Express
              ให้เองภายในประมาณ 1-2 นาที
            </div>
          ) : r3.state === "waiting" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              ⏳ ยังไม่มี H3 ที่อ้างถึง {po.poNo} ใน Express: บันทึก H3 (อ้างถึงใบสั่งซื้อ = {po.poNo}) แล้วระบบจะเพิ่มเข้า R3 ของวันที่บิลให้ในรอบถัดไป
            </div>
          ) : (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
              <div className="font-medium text-rose-300">⛔ สร้าง R3 ไม่สำเร็จ</div>
              <div className="mt-1 text-slate-300">{r3.error}</div>
              {!!s && isAdmin(s) && <R3Retry poNo={po.poNo} duplicate={r3.error.startsWith("อาจซ้ำ:")} />}
            </div>
          )}
        </Card>
      )}

      {po.receipts.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 font-semibold">เอกสารใน Express ที่อ้างถึงใบนี้</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">เลขที่</th>
                <th className="py-2 pr-3">วันที่</th>
                <th className="py-2 pr-3 text-right">ยอดสุทธิ</th>
                <th className="py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {po.receipts.map((d) => (
                <tr key={d.docNo} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">{d.docNo}</td>
                  <td className="py-2 pr-3">{thDate(d.date)}</td>
                  <td className="py-2 pr-3 text-right">{money(d.netAmt)}</td>
                  <td className="py-2 text-slate-400">{d.docStat === "C" ? "ยกเลิก" : "ปกติ"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
