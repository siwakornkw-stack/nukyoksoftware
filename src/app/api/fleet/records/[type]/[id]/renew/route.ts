import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const plusYear = (d: Date) => {
  const n = new Date(d);
  n.setUTCFullYear(n.getUTCFullYear() + 1);
  return n;
};

// Renew a tax / พ.ร.บ. / insurance record: a copy one year later (Year +1,
// dates +1 year) with the new premium; company, broker and class carry over.
// Body: {"premium": 1234}
export async function POST(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { type, id } = await ctx.params;
  const b = (await req.json().catch(() => null)) ?? {};
  const premium = Number(b.premium);
  if (!Number.isFinite(premium) || premium < 0) return NextResponse.json({ error: "เบี้ยไม่ถูกต้อง" }, { status: 400 });
  const own = { Vehicle: { TenantId: DEFAULT_TENANT_ID } };
  const common = (r: { Year: number; EndDate: Date; InsuranceCompany: string; BrokerName: string; VehicleId: string; Note: string | null }) => ({
    Status: "active",
    Year: r.Year + 1,
    EndDate: plusYear(r.EndDate),
    TotalPremium: premium,
    InsuranceCompany: r.InsuranceCompany,
    BrokerName: r.BrokerName,
    Note: "",
    VehicleId: r.VehicleId,
    CreatedByUsername: s.username,
  });

  let created: { id: string; EndDate: Date } | null = null;
  if (type === "tax") {
    const r = await prisma.tax.findFirst({ where: { TaxId: id, ...own } });
    if (!r) return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    const data = common(r);
    if (await prisma.tax.findFirst({ where: { VehicleId: r.VehicleId, EndDate: data.EndDate } })) {
      return NextResponse.json({ error: "มีรายการของปีถัดไปแล้ว" }, { status: 400 });
    }
    const n = await prisma.tax.create({ data });
    created = { id: n.TaxId, EndDate: n.EndDate };
  } else if (type === "compulsory") {
    const r = await prisma.compulsoryMotorInsuranceVehicle.findFirst({ where: { CompulsoryMotorInsuranceVehicleId: id, ...own } });
    if (!r) return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    const data = common(r);
    if (await prisma.compulsoryMotorInsuranceVehicle.findFirst({ where: { VehicleId: r.VehicleId, EndDate: data.EndDate } })) {
      return NextResponse.json({ error: "มีรายการของปีถัดไปแล้ว" }, { status: 400 });
    }
    const n = await prisma.compulsoryMotorInsuranceVehicle.create({ data });
    created = { id: n.CompulsoryMotorInsuranceVehicleId, EndDate: n.EndDate };
  } else if (type === "insurance") {
    const r = await prisma.insurancePolicyVehicle.findFirst({ where: { InsurancePolicyVehicleId: id, ...own } });
    if (!r) return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    const data = { ...common(r), Type: r.Type, StartDate: plusYear(r.StartDate) };
    if (await prisma.insurancePolicyVehicle.findFirst({ where: { VehicleId: r.VehicleId, EndDate: data.EndDate } })) {
      return NextResponse.json({ error: "มีรายการของปีถัดไปแล้ว" }, { status: 400 });
    }
    const n = await prisma.insurancePolicyVehicle.create({ data });
    created = { id: n.InsurancePolicyVehicleId, EndDate: n.EndDate };
  } else {
    return NextResponse.json({ error: "ต่ออายุได้เฉพาะภาษี พ.ร.บ. และประกัน" }, { status: 400 });
  }

  await audit(`record:${type}`, created.id, "renew", s.username, { renewedFrom: id }, { EndDate: created.EndDate, TotalPremium: premium });
  return NextResponse.json({ ok: true, id: created.id, endDate: created.EndDate.toISOString().slice(0, 10) }, { status: 201 });
}
