import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { getCompany } from "@/lib/company";
import { bahtText } from "@/lib/baht-text";
import { thDate } from "@/lib/format";
import { PrintBar } from "./PrintBar";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bkkISO = (d: Date) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);

// Billing note (ใบวางบิล) for finished driver jobs. Outside the (app) layout so
// the printout has no sidebar; always light, it is a paper document.
export default async function BillPage({ params }: { params: Promise<{ billNo: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { billNo } = await params;
  const bill = await prisma.driverBill.findFirst({
    where: { BillNo: decodeURIComponent(billNo), TenantId: DEFAULT_TENANT_ID },
    include: { Jobs: { orderBy: { JobNo: "asc" } } },
  });
  if (!bill) notFound();
  const company = await getCompany();
  const total = Number(bill.Total);

  return (
    <div className="min-h-screen bg-slate-200 py-6 text-slate-900 print:bg-white print:py-0">
      <PrintBar admin={isAdmin(s)} company={company} />
      <div className="mx-auto w-[210mm] max-w-full bg-white p-[14mm] shadow-lg print:w-auto print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
          <div>
            <div className="text-xl font-bold">{company.name}</div>
            {company.address && <div className="whitespace-pre-line text-sm">{company.address}</div>}
            <div className="text-sm">
              {company.taxId && <>เลขประจำตัวผู้เสียภาษี {company.taxId}</>}
              {company.taxId && company.phone && " · "}
              {company.phone && <>โทร {company.phone}</>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">ใบวางบิล</div>
            <div className="text-sm text-slate-600">BILLING NOTE</div>
          </div>
        </div>

        <div className="mt-4 flex justify-between gap-6 text-sm">
          <div>
            <div className="text-slate-500">ลูกค้า</div>
            <div className="text-base font-semibold">{bill.CustomerName}</div>
          </div>
          <table className="text-sm">
            <tbody>
              <tr><td className="pr-3 text-slate-500">เลขที่</td><td className="font-semibold">{bill.BillNo}</td></tr>
              <tr><td className="pr-3 text-slate-500">วันที่</td><td>{thDate(bkkISO(bill.CreatedAt))}</td></tr>
            </tbody>
          </table>
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5 w-12">ลำดับ</th>
              <th className="border border-slate-300 px-2 py-1.5 w-24">วันที่</th>
              <th className="border border-slate-300 px-2 py-1.5">รายการ</th>
              <th className="border border-slate-300 px-2 py-1.5 w-32 text-right">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {bill.Jobs.map((j, i) => (
              <tr key={j.DriverJobId}>
                <td className="border border-slate-300 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center">{thDate(bkkISO(j.ScheduledAt ?? j.RespondedAt ?? j.CreatedAt))}</td>
                <td className="border border-slate-300 px-2 py-1.5">
                  งานวิ่ง #{j.JobNo} {j.Origin} → {j.Destination}
                  {j.VehicleNo && <span className="text-slate-500"> ({j.VehicleNo})</span>}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right">{money(Number(j.Price ?? 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={3} className="border border-slate-300 px-2 py-2 bg-slate-100">({bahtText(total)})</td>
              <td className="border border-slate-300 px-2 py-2 text-right">{money(total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-16 grid grid-cols-2 gap-10 text-center text-sm">
          <div>
            <div className="mx-auto w-56 border-b border-dotted border-slate-500" />
            <div className="mt-1">ผู้วางบิล</div>
            <div className="text-slate-500">วันที่ ____/____/______</div>
          </div>
          <div>
            <div className="mx-auto w-56 border-b border-dotted border-slate-500" />
            <div className="mt-1">ผู้รับวางบิล</div>
            <div className="text-slate-500">วันที่นัดชำระ ____/____/______</div>
          </div>
        </div>
      </div>
    </div>
  );
}
