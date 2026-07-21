import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryBills, distinctEmployees } from "@/lib/fuel/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const filters = {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    employee: url.searchParams.get("employee") || undefined,
    status: url.searchParams.get("status") || undefined,
  };
  const [rawBills, employees] = await Promise.all([queryBills(filters), distinctEmployees()]);
  // Convert Prisma Decimal money fields to numbers for the client.
  const bills = rawBills.map((b) => ({
    ...b,
    liters: b.liters == null ? null : Number(b.liters),
    pricePerLiter: b.pricePerLiter == null ? null : Number(b.pricePerLiter),
    total: b.total == null ? null : Number(b.total),
  }));
  return NextResponse.json({ bills, employees });
}
