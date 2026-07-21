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
  VehicleDriverId: string | null;
  VehicleDriver: { Name: string } | null;
}

const JOB_STATUS: Record<string, string> = {
  pending: "รอมอบหมาย",
  assigned: "มอบหมายแล้ว",
  cancelled: "ยกเลิก",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newDriver, setNewDriver] = useState({ name: "", mobileNo: "", licenseNo: "", lineUserId: "" });
  const [newJob, setNewJob] = useState({ origin: "", destination: "", scheduledAt: "", vehicleDriverId: "", note: "" });

  const load = useCallback(() => {
    fetch("/api/fleet/drivers")
      .then((r) => r.json())
      .then((d) => setDrivers(d.drivers ?? []));
    fetch("/api/fleet/driver-jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []));
  }, []);

  useEffect(load, [load]);

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/fleet/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDriver),
    });
    if (res.ok) {
      setNewDriver({ name: "", mobileNo: "", licenseNo: "", lineUserId: "" });
      load();
    }
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/fleet/driver-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...newJob }),
    });
    if (res.ok) {
      setNewJob({ origin: "", destination: "", scheduledAt: "", vehicleDriverId: "", note: "" });
      load();
    }
  }

  async function jobAction(action: string, jobId: string, vehicleDriverId?: string) {
    await fetch("/api/fleet/driver-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId, vehicleDriverId }),
    });
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
            <button className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              สร้างงาน
            </button>
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
                    {j.Status === "cancelled" ? (
                      "-"
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
                  <td className="py-2 pr-3">
                    <span className="text-xs text-slate-300">{JOB_STATUS[j.Status] ?? j.Status}</span>
                  </td>
                  <td className="py-2">
                    {j.Status !== "cancelled" && (
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
                  <td colSpan={6} className="py-8 text-center text-slate-500">
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
