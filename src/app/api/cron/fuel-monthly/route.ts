import { NextResponse } from "next/server";
import { put } from "@/lib/storage";
import { billsInMonth } from "@/lib/fuel/db";
import { textReport, buildCsv } from "@/lib/fuel/report";
import { alertAdmin } from "@/lib/fuel/line";
import { getLineAdminId } from "@/lib/fuel/settings";

export const dynamic = "force-dynamic";

// Runs on the 1st: report the PREVIOUS month.
function prevBkkMonth(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  let y = Number(parts.year);
  let m = Number(parts.month) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ym = prevBkkMonth();
  const bills = await billsInMonth(ym);
  const report = textReport(ym, bills);

  let csvUrl: string | null = null;
  if (bills.length) {
    const csv = "﻿" + buildCsv(bills);
    const { url } = await put(`fuel/reports/${ym}.csv`, csv);
    csvUrl = url;
  }

  const admins = await getLineAdminId();
  if (admins) {
    const base = process.env.APP_BASE_URL || "";
    const link = csvUrl ? `\n\nดาวน์โหลด CSV: ${base}${csvUrl}` : "";
    await alertAdmin(admins, `${report}${link}`);
  }

  return NextResponse.json({ ok: true, month: ym, bills: bills.length, csvUrl });
}
