import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getOilIntervalKm, getTireIntervals, setOilIntervalKm, setTireIntervals, setVehicleOilInterval } from "@/lib/fleet/maintenance";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Admin: oil-change interval.
//   {"intervalKm": 10000}                       default for every vehicle
//   {"vehicleId": "...", "interval": 250|null}  one vehicle (its meter unit); null = default
//   {"tireMonths": 24, "tireKm": 50000}         tire change limits
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(s)) return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const b = (await req.json().catch(() => null)) ?? {};

  if (typeof b.vehicleId === "string" && b.vehicleId) {
    const interval = b.interval == null || b.interval === "" ? null : Number(b.interval);
    if (interval != null && (!Number.isInteger(interval) || interval < 50 || interval > 100000)) {
      return NextResponse.json({ error: "ระยะต้องเป็นจำนวนเต็ม 50 - 100,000" }, { status: 400 });
    }
    await setVehicleOilInterval(b.vehicleId, interval);
    await audit("vehicle", b.vehicleId, "update", s.username, null, { OilInterval: interval });
    return NextResponse.json({ ok: true });
  }

  if (b.tireMonths !== undefined) {
    const months = Number(b.tireMonths);
    const tireKm = Number(b.tireKm);
    if (!Number.isInteger(months) || months < 1 || months > 120 || !Number.isInteger(tireKm) || tireKm < 1000 || tireKm > 500000) {
      return NextResponse.json({ error: "อายุ 1 - 120 เดือน, ระยะ 1,000 - 500,000 กม." }, { status: 400 });
    }
    const before = await getTireIntervals();
    await setTireIntervals(months, tireKm);
    await audit("setting", "tire_interval", "update", s.username, before, { months, km: tireKm });
    return NextResponse.json({ ok: true });
  }

  const km = Number(b.intervalKm);
  if (!Number.isInteger(km) || km < 1000 || km > 100000) {
    return NextResponse.json({ error: "ระยะต้องอยู่ระหว่าง 1,000 - 100,000 กม." }, { status: 400 });
  }
  const before = await getOilIntervalKm();
  await setOilIntervalKm(km);
  await audit("setting", "oil_interval_km", "update", s.username, { km: before }, { km });
  return NextResponse.json({ ok: true });
}
