import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { reconcileMonth, rematchBills } from "@/lib/fuel/reconcile";
import { rememberAlias } from "@/lib/fleet/office-import";

export const dynamic = "force-dynamic";

const bkkMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()).slice(0, 7);

export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const m = new URL(req.url).searchParams.get("month") || "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : bkkMonth();
  return NextResponse.json({ month, ...(await reconcileMonth(month)) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "rematch") return NextResponse.json({ linked: await rematchBills() });

  // Manual link: also remember the receipt's plate text as an alias so later
  // receipts with the same (mis)reading match by themselves.
  if (b.action === "assign") {
    const billId = Number(b.billId);
    const vehicleId = typeof b.vehicleId === "string" ? b.vehicleId : "";
    if (!Number.isInteger(billId)) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 400 });
    const [bill, vehicle] = await Promise.all([
      prisma.fuelBill.findUnique({ where: { id: billId } }),
      prisma.vehicle.findFirst({ where: { VehicleId: vehicleId, TenantId: DEFAULT_TENANT_ID } }),
    ]);
    if (!bill) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
    if (!vehicle) return NextResponse.json({ error: "ไม่พบรถคันนี้" }, { status: 400 });
    await prisma.fuelBill.update({ where: { id: billId }, data: { VehicleId: vehicleId } });
    if (bill.plate) await rememberAlias(prisma, bill.plate, vehicleId, s.username);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
