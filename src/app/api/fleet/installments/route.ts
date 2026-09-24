import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "@/lib/fleet/queries";
import { put } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { installmentDueDates } from "@/lib/fleet/schedule";

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
      evidence: i.PaymentEvidence,
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
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    const action = String(form.get("action") || "");
    if (action !== "pay") return NextResponse.json({ error: "unknown action" }, { status: 400 });

    const id = String(form.get("id") || "");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const inst = await prisma.installmentsVehicle.findFirst({
      where: { InstallmentsVehicleId: id, Vehicle: { TenantId: DEFAULT_TENANT_ID } },
      select: { InstallmentsVehicleId: true, DatePay: true },
    });
    if (!inst) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Checked before storing the evidence file so a repeat does not leave an orphan on disk.
    if (inst.DatePay) return NextResponse.json({ error: "งวดนี้ชำระแล้ว" }, { status: 400 });

    let evidenceUrl: string | undefined;
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `fleet/installments/${id}/${randomUUID()}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await put(key, bytes);
      evidenceUrl = stored.url;
    }

    // Only an unpaid row: paying twice must not move the pay date.
    const { count } = await prisma.installmentsVehicle.updateMany({
      where: { InstallmentsVehicleId: id, DatePay: null },
      data: {
        DatePay: new Date(),
        Status: "paid",
        UpdatedByUsername: session.username,
        ...(evidenceUrl ? { PaymentEvidence: evidenceUrl } : {}),
      },
    });
    if (!count) return NextResponse.json({ error: "งวดนี้ชำระแล้ว" }, { status: 400 });
    await audit("installment", id, "pay", session.username, { DatePay: null }, { DatePay: new Date(), PaymentEvidence: evidenceUrl ?? null });
    return NextResponse.json({ ok: true, evidence: evidenceUrl ?? null });
  }

  const body = (await req.json().catch(() => null)) ?? {};
  const action = body.action;
  // A JSON object here would reach Prisma as a filter ({ not: "" }), not a value.
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (action === "pay") {
    const id = str(body.id);
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const inst = await prisma.installmentsVehicle.findFirst({
      where: { InstallmentsVehicleId: id, Vehicle: { TenantId: DEFAULT_TENANT_ID } },
      select: { InstallmentsVehicleId: true },
    });
    if (!inst) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { count } = await prisma.installmentsVehicle.updateMany({
      where: { InstallmentsVehicleId: id, DatePay: null },
      data: { DatePay: new Date(), Status: "paid", UpdatedByUsername: session.username },
    });
    if (!count) return NextResponse.json({ error: "งวดนี้ชำระแล้ว" }, { status: 400 });
    await audit("installment", id, "pay", session.username, { DatePay: null }, { DatePay: new Date() });
    return NextResponse.json({ ok: true });
  }

  if (action === "generate") {
    const vehicleId = str(body.vehicleId);
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
    const start = body.startDate ? new Date(str(body.startDate)) : new Date();
    if (isNaN(start.getTime())) return NextResponse.json({ error: "วันที่งวดแรกไม่ถูกต้อง" }, { status: 400 });
    const amount = Number(v.InstallmentAmount);
    const data = installmentDueDates(start, v.InstallmentPeriods).map((DueDate, idx) => ({
      VehicleId: vehicleId,
      Status: "active",
      InstallmentNumber: idx + 1,
      DueDate,
      Amount: amount,
      CreatedByUsername: session.username,
    }));
    try {
      await prisma.installmentsVehicle.createMany({ data });
    } catch (e) {
      // A concurrent generate won the race: (VehicleId, InstallmentNumber) is unique.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "มีค่างวดอยู่แล้ว" }, { status: 400 });
      }
      throw e;
    }
    await audit("vehicle", vehicleId, "generate-installments", session.username, null, {
      periods: data.length,
      amount,
      firstDue: data[0]?.DueDate,
    });
    return NextResponse.json({ ok: true, created: data.length });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
