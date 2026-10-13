import { NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { bearerOk } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";
import { dec } from "@/lib/fleet/queries";
import { bangkokToday, shouldRemind as remindOn } from "@/lib/fleet/schedule";
import { DEBT_CLOSED } from "@/lib/today";
import { oilStatusAll, tireStatusAll } from "@/lib/fleet/maintenance";
import { budgetStatus } from "@/lib/fleet/budget";
import { addMonths, BASELINE_MONTHS, efficiencyDrops, loadFuelRecords } from "@/lib/fleet/fuel-report";

export const dynamic = "force-dynamic";

interface Reminder {
  key: string;
  title: string;
  plate: string;
  text: string;
  lineUserId: string | null;
  once?: boolean; // notify once; a repeat does not mark it unread again
}

export async function GET(req: Request) {
  if (!bearerOk(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const T = DEFAULT_TENANT_ID;
  const now = new Date();

  // Comparing at day granularity keeps the 01:00-Bangkok cron from ever landing
  // on the wrong side of a date boundary.
  const today = bangkokToday(now);
  const shouldRemind = (d: Date) => remindOn(d, today);

  const vehicleSel = {
    select: {
      LicensePlatePrefix: true,
      LicensePlateSuffix: true,
      VehicleDriver: { select: { LineUserId: true } },
    },
  };

  // Only each vehicle's newest record counts: last year's expired row must not
  // keep firing once it has been renewed. No date filter here, or a renewed
  // row outside the window would let the old one look like the newest.
  // Unbounded below on purpose: an overdue record matches every day (shouldRemind).
  // A deleted vehicle is only marked inactive and keeps its records; it needs no
  // renewal reminders (unpaid installments below still apply).
  const activeVehicle = { TenantId: T, Status: "active" };
  const [tenant, taxesRaw, cmisRaw, policiesRaw, oilsRaw, overdue] = await Promise.all([
    prisma.tenant.findUnique({ where: { TenantId: T } }),
    prisma.tax.findMany({ where: { Vehicle: activeVehicle }, orderBy: { EndDate: "desc" }, distinct: ["VehicleId"], include: { Vehicle: vehicleSel } }),
    prisma.compulsoryMotorInsuranceVehicle.findMany({ where: { Vehicle: activeVehicle }, orderBy: { EndDate: "desc" }, distinct: ["VehicleId"], include: { Vehicle: vehicleSel } }),
    prisma.insurancePolicyVehicle.findMany({ where: { Vehicle: activeVehicle }, orderBy: { EndDate: "desc" }, distinct: ["VehicleId"], include: { Vehicle: vehicleSel } }),
    // Newest oil change by service date; its DueDate is the one that matters.
    prisma.drainTheOilVehicle.findMany({ where: { Vehicle: activeVehicle }, orderBy: { Date: "desc" }, distinct: ["VehicleId"], include: { Vehicle: vehicleSel } }),
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
    reminders.push({ key: `tax|${t.TaxId}`, title: "ภาษีรถ", plate: plate(t.Vehicle), lineUserId: t.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ภาษีรถ ${plate(t.Vehicle)} จะหมดอายุ ${day(t.EndDate)}` });
  for (const c of cmis)
    reminders.push({ key: `cmi|${c.CompulsoryMotorInsuranceVehicleId}`, title: "พ.ร.บ.", plate: plate(c.Vehicle), lineUserId: c.Vehicle.VehicleDriver?.LineUserId ?? null, text: `พ.ร.บ. รถ ${plate(c.Vehicle)} จะหมดอายุ ${day(c.EndDate)}` });
  for (const p of policies)
    reminders.push({ key: `ins|${p.InsurancePolicyVehicleId}`, title: "ประกันภัย", plate: plate(p.Vehicle), lineUserId: p.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ประกันภัยรถ ${plate(p.Vehicle)} จะหมดอายุ ${day(p.EndDate)}` });
  for (const o of oils)
    reminders.push({ key: `oil|${o.DrainTheOilVehicleId}`, title: "น้ำมันเครื่อง", plate: plate(o.Vehicle), lineUserId: o.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ถึงกำหนดเปลี่ยนถ่ายน้ำมันเครื่องรถ ${plate(o.Vehicle)} (${o.DueDate ? day(o.DueDate) : "-"})` });
  for (const i of overdue)
    reminders.push({ key: `inst|${i.InstallmentsVehicleId}`, title: "ค่างวด", plate: plate(i.Vehicle), lineUserId: i.Vehicle.VehicleDriver?.LineUserId ?? null, text: `ค่างวดรถ ${plate(i.Vehicle)} งวดที่ ${i.InstallmentNumber} เกินกำหนด (${day(i.DueDate)}) ยอด ${dec(i.Amount).toLocaleString()} บาท` });

  // Oil change by distance: every day while a vehicle is past its interval.
  const oil = await oilStatusAll();
  for (const r of oil.rows.filter((x) => x.status === "overdue"))
    reminders.push({ key: `oilkm|${r.vehicleId}`, title: "น้ำมันเครื่อง", plate: r.plate, lineUserId: null, text: `รถ ${r.plate} ใช้งานมาแล้ว ${r.sinceKm?.toLocaleString()} (กม./ชม.) เกินระยะเปลี่ยนน้ำมันเครื่อง ${r.interval.toLocaleString()}` });

  // Tires past the age or distance limit: daily, like the oil reminders.
  const tires = await tireStatusAll();
  for (const t of tires.rows.filter((x) => x.status === "overdue"))
    reminders.push({ key: `tire|${t.tireId}`, title: "ยาง", plate: t.plate, lineUserId: null, text: `ยางรถ ${t.plate} ตำแหน่ง ${t.position} ครบกำหนดเปลี่ยน (${t.reason})` });

  // Monthly budget: once at 80% and once at 100% per vehicle and month.
  const budget = await budgetStatus(today);
  for (const b of budget.rows) {
    if (b.pct == null || b.pct < 80) continue;
    const level = b.pct >= 100 ? 100 : 80;
    reminders.push({
      key: `budget|${b.vehicleId}|${budget.month}|${level}`,
      title: "งบรายเดือน",
      plate: b.plate,
      lineUserId: null,
      once: true,
      text: `รถ ${b.plate} ใช้ไป ${b.spent.toLocaleString()} บาท (${b.pct}% ของงบ ${b.budget!.toLocaleString()} บาท) เดือนนี้`,
    });
  }

  // km/L of last month far below the vehicle's own normal: once per vehicle and month.
  const lastMonth = addMonths(today.toISOString().slice(0, 7), -1);
  const fuelHistory = await loadFuelRecords({ from: addMonths(lastMonth, -BASELINE_MONTHS), to: lastMonth });
  for (const a of efficiencyDrops(fuelHistory, [lastMonth]))
    reminders.push({ key: `kml|${a.row.vehicleId}|${lastMonth}`, title: "อัตราสิ้นเปลืองผิดปกติ", plate: a.row.plate, lineUserId: null, once: true, text: `รถ ${a.row.plate} กินน้ำมันผิดปกติ ${a.detail}` });

  // Customer debt (current BillingNote version) crossing 30/60/90 days overdue:
  // in-app, once per threshold (the morning summary carries the running totals).
  const debtVersion = await prisma.debtVersion.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (debtVersion) {
    const todayISO = today.toISOString().slice(0, 10);
    const openDebt = await prisma.debtRecord.findMany({
      where: { versionId: debtVersion.id, dueDate: { lt: todayISO }, status: { notIn: DEBT_CLOSED } },
      select: { docNo: true, customer: true, total: true, paid: true, dueDate: true, salesperson: true },
    });
    for (const d of openDebt) {
      const days = Math.round((today.getTime() - Date.parse(`${d.dueDate}T00:00:00Z`)) / 86400000);
      if (days !== 30 && days !== 60 && days !== 90) continue;
      reminders.push({
        key: `debt|${d.docNo}|${days}`,
        title: "หนี้ลูกค้า",
        plate: "",
        lineUserId: null,
        text: `หนี้ ${d.customer} เอกสาร ${d.docNo} เกินกำหนด ${days} วัน ยอดค้าง ${(dec(d.total) - dec(d.paid)).toLocaleString()} บาท${d.salesperson ? ` (พนักงานขาย ${d.salesperson})` : ""}`,
      });
    }

    // Broken payment promises: the newest follow-up of a document that is still
    // open, whose promised date has passed. Daily until paid or a new note.
    const promises = await prisma.debtFollowUp.findMany({
      where: { promiseDate: { not: null } },
      orderBy: { createdAt: "desc" },
      distinct: ["docNo"],
    });
    const late = promises.filter((p) => p.promiseDate! < todayISO);
    if (late.length) {
      const open = await prisma.debtRecord.findMany({
        where: { versionId: debtVersion.id, docNo: { in: late.map((p) => p.docNo) }, status: { notIn: DEBT_CLOSED } },
        select: { docNo: true, total: true, paid: true },
      });
      const byDoc = new Map(open.map((r) => [r.docNo, dec(r.total) - dec(r.paid)]));
      for (const p of late) {
        const due = byDoc.get(p.docNo);
        if (due === undefined || due <= 0) continue;
        reminders.push({
          key: `debtpromise|${p.id}`,
          title: "ลูกค้าผิดนัดชำระ",
          plate: "",
          lineUserId: null,
          text: `${p.customer} สัญญาจะชำระเอกสาร ${p.docNo} ภายใน ${p.promiseDate} แต่ยังค้าง ${due.toLocaleString()} บาท`,
        });
      }
    }
  }

  // Borrowed equipment past its return date: in-app only (borrowers have no LINE id).
  const lateLoans = await prisma.assetLoan.findMany({
    where: { Asset: { TenantId: T }, ReturnedAt: null, DueAt: { lt: today } },
    include: { Asset: { select: { Name: true } } },
  });
  for (const l of lateLoans)
    reminders.push({ key: `loan|${l.AssetLoanId}`, title: "ยืมสินทรัพย์", plate: "", lineUserId: null, text: `${l.Asset.Name} ที่ ${l.BorrowerName} ยืมไป เลยกำหนดคืน (${day(l.DueAt!)})` });

  // In-app notifications for every active user. One row per (user, key): a
  // repeat reminder refreshes that row and marks it unread again, so the list
  // shows each issue once instead of growing by a copy every day.
  const users = await prisma.customer.findMany({
    where: { TenantId: T, Status: "active" },
    select: { CustomerId: true },
  });
  for (const u of users) {
    for (const r of reminders) {
      await prisma.notification.upsert({
        where: { CustomerId_Key: { CustomerId: u.CustomerId, Key: r.key } },
        create: { CustomerId: u.CustomerId, Key: r.key, Title: r.title, Message: r.text },
        update: r.once ? {} : { Title: r.title, Message: r.text, IsRead: false, CreatedTime: now },
      });
    }
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
