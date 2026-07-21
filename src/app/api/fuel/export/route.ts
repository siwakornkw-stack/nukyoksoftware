import { getSession } from "@/lib/auth";
import { queryBills } from "@/lib/fuel/db";
import { buildCsv } from "@/lib/fuel/report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getSession())) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const bills = await queryBills({
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    employee: url.searchParams.get("employee") || undefined,
    status: url.searchParams.get("status") || undefined,
  });
  const csv = "﻿" + buildCsv(bills); // UTF-8 BOM for Excel
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fuel-bills.csv"`,
    },
  });
}
