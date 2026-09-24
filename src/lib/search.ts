import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { plateKey, plateText } from "@/lib/fleet/plates";

export interface Hit {
  title: string;
  sub?: string;
  href: string;
}
export interface HitGroup {
  label: string;
  hits: Hit[];
}

const LIMIT = 8;

// One query across modules. Plates compare on plateKey, so "81-2801",
// "81 2801" and a learned alias ("SY55u") all find the same vehicle.
export async function searchAll(raw: string): Promise<HitGroup[]> {
  const q = raw.trim();
  if (q.length < 2) return [];
  const T = DEFAULT_TENANT_ID;
  const key = plateKey(q);
  const ci = { contains: q, mode: "insensitive" as const };
  const num = /^\d+$/.test(q) ? Number(q) : null;

  const [vehicles, aliases, drivers, debtVersion, assets, jobs, bills] = await Promise.all([
    prisma.vehicle.findMany({
      where: { TenantId: T },
      select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true, Model: true, ChassisNumber: true, Status: true },
    }),
    prisma.vehicleAlias.findMany({ where: { TenantId: T }, select: { AliasKey: true, Label: true, VehicleId: true } }),
    prisma.vehicleDriver.findMany({
      where: { TenantId: T, OR: [{ Name: ci }, { MobileNo: { contains: q } }] },
      select: { VehicleDriverId: true, Name: true, MobileNo: true },
      take: LIMIT,
    }),
    prisma.debtVersion.findFirst({ where: { isCurrent: true }, select: { id: true } }),
    prisma.asset.findMany({
      where: { TenantId: T, OR: [{ Name: ci }, { Code: ci }, { Category: ci }] },
      select: { Name: true, Category: true, Code: true, Inactive: true },
      take: LIMIT,
    }),
    prisma.driverJob.findMany({
      where: { TenantId: T, OR: [{ Origin: ci }, { Destination: ci }, ...(num != null ? [{ JobNo: num }] : [])] },
      select: { JobNo: true, Origin: true, Destination: true, Status: true },
      orderBy: { CreatedAt: "desc" },
      take: LIMIT,
    }),
    prisma.fuelBill.findMany({
      where: { OR: [{ plate: ci }, { receiptNo: ci }, { employeeName: ci }, ...(num != null ? [{ id: num }] : [])] },
      select: { id: true, plate: true, receiptNo: true, employeeName: true, billDate: true, status: true },
      orderBy: { id: "desc" },
      take: LIMIT,
    }),
  ]);

  const aliasHit = new Set(aliases.filter((a) => key && a.AliasKey.includes(key)).map((a) => a.VehicleId));
  const vehicleHits = vehicles
    .filter(
      (v) =>
        aliasHit.has(v.VehicleId) ||
        (key && plateKey(v.LicensePlatePrefix + v.LicensePlateSuffix).includes(key)) ||
        (key && plateKey(v.Model).includes(key)) ||
        (q.length >= 4 && v.ChassisNumber.toLowerCase().includes(q.toLowerCase()))
    )
    .slice(0, LIMIT)
    .map((v) => ({
      title: plateText(v) || v.Model,
      sub: [v.Model, v.Status !== "active" ? "เลิกใช้" : ""].filter(Boolean).join(" · "),
      href: `/fleet/vehicles/${v.VehicleId}`,
    }));

  const debt = debtVersion
    ? await prisma.debtRecord.findMany({
        where: { versionId: debtVersion.id, OR: [{ docNo: ci }, { customer: ci }, { project: ci }] },
        select: { docNo: true, customer: true, total: true, status: true, dueDate: true },
        take: LIMIT,
      })
    : [];

  const groups: HitGroup[] = [
    { label: "รถ", hits: vehicleHits },
    { label: "คนขับ", hits: drivers.map((d) => ({ title: d.Name, sub: d.MobileNo ?? "", href: "/fleet/drivers" })) },
    {
      label: "หนี้ลูกค้า",
      hits: debt.map((d) => ({
        title: `${d.docNo} · ${d.customer}`,
        sub: `${Number(d.total).toLocaleString()} บาท · ${d.status}${d.dueDate ? ` · ครบกำหนด ${d.dueDate}` : ""}`,
        href: "/debt/records",
      })),
    },
    {
      label: "สินทรัพย์",
      hits: assets.map((a) => ({ title: a.Name, sub: [a.Category, a.Code, a.Inactive ? "ปลดระวาง" : ""].filter(Boolean).join(" · "), href: "/assets" })),
    },
    { label: "งานวิ่ง", hits: jobs.map((j) => ({ title: `#${j.JobNo} ${j.Origin} → ${j.Destination}`, sub: j.Status, href: "/fleet/drivers" })) },
    {
      label: "บิลน้ำมัน (LINE)",
      hits: bills.map((b) => ({
        title: `บิล #${b.id}${b.plate ? ` · ${b.plate}` : ""}`,
        sub: [b.employeeName, b.billDate, b.receiptNo, b.status === "suspect" ? "น่าสงสัย" : ""].filter(Boolean).join(" · "),
        href: "/fuel",
      })),
    },
  ];
  return groups.filter((g) => g.hits.length);
}
