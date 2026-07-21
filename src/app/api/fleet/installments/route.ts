import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "@/lib/fleet/queries";
import { put } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "unpaid"; // unpaid | overdue | paid | all
  const vehicle = url.searchParams.get("vehicle") || undefined;

  const rows = await prisma.installmentsVehicle.findMany({
    where: {
      Vehicle: { TenantId: DEFAULT_TENANT_ID },
      ...(vehicle ? { VehicleId: vehicle } : {}),
      ...(filter === "paid" ? { DatePay: { not: null } } : {}),
      ...(filter === "unpaid" || filter === "overdue" ? { DatePay: null } : {}),
    },
    include: { Vehicle: { select: { VehicleId: true, LicensePlatePrefix: true, LicensePlateSuffix: true } } },
    orderBy: { DueDate: "asc" },
    take: 1000,
  });

  const now = Date.now();
  let list = rows.map((i) => {
    const overdueDays = i.DatePay ? 0 : Math.floor((now - i.DueDate.getTime()) / 86400000);
    return {
      id: i.InstallmentsVehicleId,
      vehicleId: i.Vehicle.VehicleId,
      plate: `${i.Vehicle.LicensePlatePrefix} ${i.Vehicle.LicensePlateSuffix}`,
      installmentNumber: i.InstallmentNumber,
      dueDate: i.DueDate.toISOString().slice(0, 10),
      amount: dec(i.Amount),
      datePay: i.DatePay ? i.DatePay.toISOString().slice(0, 10) : null,
      overdueDays,
    };
  });
  if (filter === "overdue") list = list.filter((i) => i.overdueDays > 0);
  return NextResponse.json({ installments: list });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // Mark-paid uses multipart/form-data so an optional evidence file can be attached.
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const action = String(form.get("action") || "");
    if (action !== "pay") return NextResponse.json({ error: "unknown action" }, { status: 400 });

    const id = String(form.get("id") || "");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const inst = await prisma.installmentsVehicle.findFirst({
      where: { InstallmentsVehicleId: id, Vehicle: { TenantId: DEFAULT_TENANT_ID } },
      select: { InstallmentsVehicleId: true },
    });
    if (!inst) return NextResponse.json({ error: "not found" }, { status: 404 });

    let evidenceUrl: string | undefined;
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `fleet/installments/${id}/${randomUUID()}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await put(key, bytes);
      evidenceUrl = stored.url;
    }

    await prisma.installmentsVehicle.update({
      where: { InstallmentsVehicleId: id },
      data: {
        DatePay: new Date(),
        Status: "paid",
        UpdatedByUsername: session.username,
        ...(evidenceUrl ? { PaymentEvidence: evidenceUrl } : {}),
      },
    });
    return NextResponse.json({ ok: true, evidence: evidenceUrl ?? null });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "pay") {
    if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const inst = await prisma.installmentsVehicle.findFirst({
      where: { InstallmentsVehicleId: body.id, Vehicle: { TenantId: DEFAULT_TENANT_ID } },
      select: { InstallmentsVehicleId: true },
    });
    if (!inst) return NextResponse.json({ error: "not found" }, { status: 404 });
    await prisma.installmentsVehicle.update({
      where: { InstallmentsVehicleId: body.id },
      data: { DatePay: new Date(), Status: "paid", UpdatedByUsername: session.username },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "generate") {
    const vehicleId = body.vehicleId as string;
    if (!vehicleId) return NextResponse.json({ error: "missing vehicleId" }, { status: 400 });
    const v = await prisma.vehicle.findFirst({
      where: { VehicleId: vehicleId, TenantId: DEFAULT_TENANT_ID },
    });
    if (!v) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!v.InstallmentPeriods || !v.InstallmentAmount) {
      return NextResponse.json({ error: "รถคันนี้ยังไม่ได้ตั้งจำนวนงวด/ค่างวด" }, { status: 400 });
    }
    const existing = await prisma.installmentsVehicle.count({ where: { VehicleId: vehicleId } });
    if (existing > 0) {
      return NextResponse.json({ error: "มีค่างวดอยู่แล้ว" }, { status: 400 });
    }
    const start = body.startDate ? new Date(body.startDate) : new Date();
    const anchorDay = start.getUTCDate();
    const amount = Number(v.InstallmentAmount);
    const data = Array.from({ length: v.InstallmentPeriods }, (_, idx) => {
      const y = start.getUTCFullYear();
      const mo = start.getUTCMonth() + idx;
      // Clamp the day to the target month's length so a 29-31 anchor does not
      // roll forward into the following month.
      const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      const day = Math.min(anchorDay, lastDay);
      return {
        VehicleId: vehicleId,
        Status: "active",
        InstallmentNumber: idx + 1,
        DueDate: new Date(Date.UTC(y, mo, day)),
        Amount: amount,
        CreatedByUsername: session.username,
      };
    });
    await prisma.installmentsVehicle.createMany({ data });
    return NextResponse.json({ ok: true, created: data.length });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
