import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { setVehicleBudget } from "@/lib/fleet/budget";
import { dec } from "@/lib/fleet/queries";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Admin: { vehicleId, budget: number | null }  (null = no budget)
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const b = (await req.json().catch(() => null)) ?? {};
  const vehicleId = typeof b.vehicleId === "string" ? b.vehicleId : "";
  const budget = b.budget == null || b.budget === "" ? null : Number(b.budget);
  if (budget != null && (!Number.isFinite(budget) || budget <= 0 || budget > 10_000_000)) {
    return NextResponse.json({ error: "งบต้องมากกว่า 0" }, { status: 400 });
  }
  const v = vehicleId ? await prisma.vehicle.findFirst({ where: { VehicleId: vehicleId, TenantId: DEFAULT_TENANT_ID }, select: { MonthlyBudget: true } }) : null;
  if (!v) return NextResponse.json({ error: "ไม่พบรถคันนี้" }, { status: 404 });
  await setVehicleBudget(vehicleId, budget);
  await audit("vehicle", vehicleId, "update", s.username, { MonthlyBudget: v.MonthlyBudget == null ? null : dec(v.MonthlyBudget) }, { MonthlyBudget: budget });
  return NextResponse.json({ ok: true });
}
