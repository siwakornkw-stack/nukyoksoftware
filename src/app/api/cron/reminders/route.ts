import { NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "@/lib/fleet/queries";

export const dynamic = "force-dynamic";

interface Reminder {
  plate: string;
  text: string;
  lineUserId: string | null;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const T = DEFAULT_TENANT_ID;
  const now = new Date();

  // Date-only "today" (UTC midnight of the current Bangkok date), matching how
  // EndDate/DueDate are stored (see normalizeDate). Comparing at day
  // granularity keeps the 01:00-Bangkok cron from ever landing on the wrong
  // side of a date boundary.
  const today = new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now)}T00:00:00.000Z`
  );
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const daysLeft = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86400000);
  const REMIND_DAYS = new Set([30, 7, 3]);
  // Fire at exactly 30/7/3 days out, then every day once it's actually expired.
  const shouldRemind = (d: Date) => REMIND_DAYS.has(daysLeft(d)) || daysLeft(d) <= 0;

  const vehicleSel = {
    select: {
      LicensePlatePrefix: true,
      LicensePlateSuffix: true,
      VehicleDriver: { select: { LineUserId: true } },
    },
  };

  // Unbounded below: once something is overdue it must keep matching every day
  // (shouldRemind), not just up to 30 days past expiry.
  const [tenant, taxesRaw, cmisRaw, policiesRaw, oilsRaw, overdue] = await Promise.all([
    prisma.tenant.findUnique({ where: { TenantId: T } }),
    prisma.tax.findMany({ where: { Vehicle: { TenantId: T }, EndDate: { lte: in30 } }, include: { Vehicle: vehicleSel } }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where: { Vehicle: { TenantId: T }, EndDate: { lte: in30 } }, include: { Vehicle: vehicleSel } }),
    prisma.insurancePolicyVehicle.findMany({ where: { Vehicle: { TenantId: T }, EndDate: { lte: in30 } }, include: { Vehicle: vehicleSel } }),
    prisma.drainTheOilVehicle.findMany({ where: { Vehicle: { TenantId: T }, DueDate: { lte: in30 } }, include: { Vehicle: vehicleSel } }),
    prisma.installmentsVehicle.findMany({ where: { Vehicle: { TenantId: T }, DatePay: null, DueDate: { lt: now } }, include: { Vehicle: vehicleSel } }),
  ]);

  // Only the days that actually match the 30/7/3-then-daily rule.
  const taxes = taxesRaw.filter((t) => shouldRemind(t.EndDate));
  const cmis = cmisRaw.filter((c) => shouldRemind(c.EndDate));
  const policies = policiesRaw.filter((p) => shouldRemind(p.EndDate));
  const oils = oilsRaw.filter((o) => o.DueDate && shouldRemind(o.DueDate));

  const plate = (v: { LicensePlatePrefix: string; LicensePlateSuffix: string }) =>
    `${v.LicensePlatePrefix} ${v.LicensePlateSuffix}`;
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const reminders: Reminder[] = [];
  for (const t of taxes)
    reminders.push({ plate: plate(t.Vehicle), lineUserId: t.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ภาษีรถ ${plate(t.Vehicle)} จะหมดอายุ ${day(t.EndDate)}` });
  for (const c of cmis)
    reminders.push({ plate: plate(c.Vehicle), lineUserId: c.Vehicle.VehicleDriver?.LineUserId ?? null, text: `พ.ร.บ. รถ ${plate(c.Vehicle)} จะหมดอายุ ${day(c.EndDate)}` });
  for (const p of policies)
    reminders.push({ plate: plate(p.Vehicle), lineUserId: p.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ประกันภัยรถ ${plate(p.Vehicle)} จะหมดอายุ ${day(p.EndDate)}` });
  for (const o of oils)
    reminders.push({ plate: plate(o.Vehicle), lineUserId: o.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ถึงกำหนดเปลี่ยนถ่ายน้ำมันเครื่องรถ ${plate(o.Vehicle)} (${o.DueDate ? day(o.DueDate) : "-"})` });
  for (const i of overdue)
    reminders.push({ plate: plate(i.Vehicle), lineUserId: i.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ค่างวดรถ ${plate(i.Vehicle)} งวดที่ ${i.InstallmentNumber} เกินกำหนด (${day(i.DueDate)}) ยอด ${dec(i.Amount).toLocaleString()} บาท` });

  // Persist notifications to an admin customer if available.
  const admin = await prisma.customer.findFirst({
    where: { TenantId: T, Role: "admin", Status: "active" },
    select: { CustomerId: true },
  });
  if (admin && reminders.length) {
    await prisma.notification.createMany({
      data: reminders.map((r) => ({ CustomerId: admin.CustomerId, Title: "แจ้งเตือน", Message: r.text })),
    });
  }

  // Push to drivers via LINE when we have a token + their userId.
  const token = tenant?.LineChannelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  let pushed = 0;
  if (token) {
    const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: token.trim() });
    for (const r of reminders) {
      if (!r.lineUserId) continue;
      try {
        await client.pushMessage({ to: r.lineUserId, messages: [{ type: "text", text: r.text }] });
        pushed++;
      } catch (e) {
        console.error("reminder push failed:", (e as Error)?.message);
      }
    }
  }

  return NextResponse.json({ ok: true, reminders: reminders.length, pushed });
}
