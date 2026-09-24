import { prisma } from "@/lib/db";

// Letterhead for printed documents (billing notes). One AppSetting row, JSON.
const KEY = "company_profile";

export interface CompanyProfile {
  name: string;
  address: string;
  taxId: string;
  phone: string;
}

export async function getCompany(): Promise<CompanyProfile> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  let v: Partial<CompanyProfile> = {};
  try {
    v = row?.value ? JSON.parse(row.value) : {};
  } catch {}
  return { name: v.name ?? "เทวาวณิชกิจ", address: v.address ?? "", taxId: v.taxId ?? "", phone: v.phone ?? "" };
}

export async function setCompany(p: CompanyProfile): Promise<void> {
  const value = JSON.stringify(p);
  await prisma.appSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
