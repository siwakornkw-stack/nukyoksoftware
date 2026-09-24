"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

interface Driver {
  VehicleDriverId: string;
  Name: string;
  MobileNo: string | null;
  LicenseNo: string | null;
  LineUserId: string | null;
}
interface Job {
  DriverJobId: string;
  JobNo: number | null;
  Origin: string;
  Destination: string;
  ScheduledAt: string | null;
  Status: string;
  Price: number | null;
  VehicleDriverId: string | null;
  VehicleDriver: { Name: string } | null;
}

const JOB_STATUS: Record<string, string> = {
  pending: "รอมอบหมาย",
  assigned: "มอบหมายแล้ว",
  accepted: "คนขับรับงานแล้ว",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

const EMPTY_JOB = { origin: "", destination: "", scheduledAt: "", vehicleDriverId: "", vehicleId: "", price: "", note: "" };

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newDriver, setNewDriver] = useState({ name: "", mobileNo: "", licenseNo: "", lineUserId: "" });
  const [newJob, setNewJob] = useState(EMPTY_JOB);
  const [vehicles, setVehicles] = useState<{ VehicleId: string; LicensePlatePrefix: string; LicensePlateSuffix: string; Model: string; Status: string }[]>([]);
  const [driverErr, setDriverErr] = useState("");
  const [jobErr, setJobErr] = useState("");
  const [jobMsg, setJobMsg] = useState("");

  // Assigning a driver pushes the job to their LINE; say whether that happened.
  async function lineNote(res: Response, assigned: boolean) {
    if (!assigned) return setJobMsg("");
    const d = await res.clone().json().catch(() => ({}));
    setJobMsg(d.lineSent ? "ส่งงานให้คนขับทาง LINE แล้ว" : "ไม่ได้ส่ง LINE (คนขับยังไม่มี LINE ID หรือส่งไม่สำเร็จ)");
  }

  const load = useCallback(() => {
    fetch("/api/fleet/drivers")
      .then((r) => r.json())
      .then((d) => setDrivers(d.drivers ?? []));
    fetch("/api/fleet/driver-jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []));
    fetch("/api/fleet/vehicles")
      .then((r) => r.json())
      .then((d) => setVehicles((d.vehicles ?? []).filter((v: { Status: string }) => v.Status === "active")));
  }, []);

  useEffect(load, [load]);

  // The API answers failures with { error }. Without surfacing it the button
  // just does nothing and the user has no idea why.
  async function errorOf(res: Response, fallback: string): Promise<string> {
    const d = await res.json().catch(() => ({}));
    return d.error || fallback;
  }

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    setDriverErr("");
    const res = await fetch("/api/fleet/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDriver),
    });
    if (res.ok) {
      setNewDriver({ name: "", mobileNo: "", licenseNo: "", lineUserId: "" });
      load();
    } else {
      setDriverErr(await errorOf(res, "เพิ่มคนขับไม่สำเร็จ"));
    }
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    setJobErr("");
    const res = await fetch("/api/fleet/driver-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...newJob }),
    });
    if (res.ok) {
      await lineNote(res, Boolean(newJob.vehicleDriverId));
      setNewJob(EMPTY_JOB);
      load();
    } else {
      setJobErr(await errorOf(res, "สร้างงานไม่สำเร็จ"));
    }
  }

  async function jobAction(action: string, jobId: string, vehicleDriverId?: string) {
    setJobErr("");
    const res = await fetch("/api/fleet/driver-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId, vehicleDriverId }),
    });
    if (!res.ok) setJobErr(await errorOf(res, "ทำรายการไม่สำเร็จ"));
    else await lineNote(res, action === "assign" && Boolean(vehicleDriverId));
    load();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="คนขับ & งานวิ่ง" subtitle={`${drivers.length} คนขับ · ${jobs.length} งาน`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="font-medium mb-3">เพิ่มคนขับ</div>
          <form onSubmit={addDriver} className="grid grid-cols-2 gap-2">
            <input className="field" placeholder="ชื่อ *" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} required />
            <input className="field" placeholder="เบอร์โทร" value={newDriver.mobileNo} onChange={(e) => setNewDriver({ ...newDriver, mobileNo: e.target.value })} />
            <input className="field" placeholder="เลขใบขับขี่" value={newDriver.licenseNo} onChange={(e) => setNewDriver({ ...newDriver, licenseNo: e.target.value })} />
            <input className="field" placeholder="LINE userId" value={newDriver.lineUserId} onChange={(e) => setNewDriver({ ...newDriver, lineUserId: e.target.value })} />
            <button className="col-span-2 rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              เพิ่ม
            </button>
            {driverErr && <div className="col-span-2 text-sm text-rose-400">{driverErr}</div>}
          </form>

          <div className="mt-4 max-h-64 overflow-y-auto">
            {drivers.map((d) => (
              <div key={d.VehicleDriverId} className="flex justify-between border-b border-slate-800/50 py-1.5 text-sm">
                <span>{d.Name}</span>
                <span className="text-slate-500">{d.MobileNo || ""}</span>
              </div>
            ))}
            {!drivers.length && <div className="text-sm text-slate-500 py-3">ยังไม่มีคนขับ</div>}
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-3">สั่งงานวิ่ง</div>
          <form onSubmit={addJob} className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="ต้นทาง *" value={newJob.origin} onChange={(e) => setNewJob({ ...newJob, origin: e.target.value })} required />
              <input className="field" placeholder="ปลายทาง *" value={newJob.destination} onChange={(e) => setNewJob({ ...newJob, destination: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="datetime-local" className="field" value={newJob.scheduledAt} onChange={(e) => setNewJob({ ...newJob, scheduledAt: e.target.value })} />
              <select className="field" value={newJob.vehicleDriverId} onChange={(e) => setNewJob({ ...newJob, vehicleDriverId: e.target.value })}>
                <option value="">- ยังไม่มอบหมาย -</option>
                {drivers.map((d) => (
                  <option key={d.VehicleDriverId} value={d.VehicleDriverId}>{d.Name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="field" value={newJob.vehicleId} onChange={(e) => setNewJob({ ...newJob, vehicleId: e.target.value })}>
                <option value="">- รถ (ไม่ระบุ = รถประจำของคนขับ) -</option>
                {vehicles.map((v) => (
                  <option key={v.VehicleId} value={v.VehicleId}>{`${v.LicensePlatePrefix} ${v.LicensePlateSuffix}`.trim() || v.Model}</option>
                ))}
              </select>
              <input type="number" min="0" step="0.01" className="field" placeholder="ค่าจ้าง (บาท) — ลงรายได้เมื่อปิดงาน" value={newJob.price} onChange={(e) => setNewJob({ ...newJob, price: e.target.value })} />
            </div>
            <input
              className="field"
              placeholder="หมายเหตุ"
              value={newJob.note}
              onChange={(e) => setNewJob({ ...newJob, note: e.target.value })}
            />
            <button className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              สร้างงาน
            </button>
            {jobErr && <div className="text-sm text-rose-400">{jobErr}</div>}
            {jobMsg && <div className="text-sm text-slate-300">{jobMsg}</div>}
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="font-medium mb-3">รายการงานวิ่ง</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">เส้นทาง</th>
                <th className="py-2 pr-3">กำหนด</th>
                <th className="py-2 pr-3">คนขับ</th>
                <th className="py-2 pr-3 text-right">ค่าจ้าง</th>
                <th className="py-2 pr-3">สถานะ</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.DriverJobId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3 text-slate-500">{j.JobNo}</td>
                  <td className="py-2 pr-3">
                    {j.Origin} → {j.Destination}
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{j.ScheduledAt ? thDateTime(j.ScheduledAt) : "-"}</td>
                  <td className="py-2 pr-3">
                    {j.Status === "cancelled" || j.Status === "done" ? (
                      j.VehicleDriver?.Name ?? "-"
                    ) : (
                      <select
                        className="field !py-1 text-xs"
                        value={j.VehicleDriverId ?? ""}
                        onChange={(e) => jobAction("assign", j.DriverJobId, e.target.value)}
                      >
                        <option value="">- มอบหมาย -</option>
                        {drivers.map((d) => (
                          <option key={d.VehicleDriverId} value={d.VehicleDriverId}>{d.Name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{j.Price == null ? "-" : j.Price.toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <span className="text-xs text-slate-300">{JOB_STATUS[j.Status] ?? j.Status}</span>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {(j.Status === "assigned" || j.Status === "accepted") && (
                      <button
                        onClick={() => confirm(`ปิดงาน #${j.JobNo}${j.Price ? ` และบันทึกรายได้ ${j.Price.toLocaleString()} บาท` : ""}?`) && jobAction("done", j.DriverJobId)}
                        className="mr-1 rounded-md px-2 py-1 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      >
                        ปิดงาน
                      </button>
                    )}
                    {j.Status !== "cancelled" && j.Status !== "done" && (
                      <button
                        onClick={() => jobAction("cancel", j.DriverJobId)}
                        className="rounded-md px-2 py-1 text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    ยังไม่มีงานวิ่ง
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
