"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDate, thDateTime } from "@/lib/format";

interface Asset {
  AssetId: string;
  Name: string;
  Category: string;
  Code: string | null;
  DefaultLocation: string | null;
  Inactive: boolean;
  Loans: { AssetLoanId: string; BorrowerName: string; Location: string; BorrowedAt: string }[];
}
interface Loan {
  AssetLoanId: string;
  AssetId: string;
  Asset: { Name: string; Category: string };
  BorrowerName: string;
  Location: string;
  BorrowedAt: string;
  DueAt: string | null;
  ReturnedAt: string | null;
}

const EMPTY_ASSET = { name: "", category: "", code: "", defaultLocation: "" };
const EMPTY_BORROW = { assetId: "", borrowerName: "", location: "", dueAt: "" };
const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [form, setForm] = useState(EMPTY_ASSET);
  const [editing, setEditing] = useState<string | null>(null); // AssetId being edited
  const [borrow, setBorrow] = useState(EMPTY_BORROW);
  const [historyOf, setHistoryOf] = useState<Asset | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [assetErr, setAssetErr] = useState("");
  const [borrowErr, setBorrowErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? []));
    fetch(`/api/assets/loans${historyOf ? `?assetId=${historyOf.AssetId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setLoans(d.loans ?? []));
  }, [historyOf]);

  useEffect(load, [load]);

  const categories = useMemo(
    () => Array.from(new Set(assets.map((a) => a.Category).filter(Boolean))),
    [assets]
  );
  const inUse = useMemo(() => assets.filter((a) => !a.Inactive), [assets]);
  const available = useMemo(() => inUse.filter((a) => !a.Loans.length), [inUse]);
  const listed = showRetired ? assets : inUse;

  // The API answers failures with { error }. Without surfacing it the button
  // just does nothing and the user has no idea why.
  async function errorOf(res: Response, fallback: string): Promise<string> {
    const d = await res.json().catch(() => ({}));
    return d.error || fallback;
  }

  function startEdit(a: Asset) {
    setEditing(a.AssetId);
    setForm({ name: a.Name, category: a.Category, code: a.Code ?? "", defaultLocation: a.DefaultLocation ?? "" });
    setAssetErr("");
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_ASSET);
    setAssetErr("");
  }

  async function saveAsset(e: React.FormEvent) {
    e.preventDefault();
    setAssetErr("");
    const res = await fetch(editing ? `/api/assets/${editing}` : "/api/assets", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      cancelEdit();
      load();
    } else {
      setAssetErr(await errorOf(res, "บันทึกสินทรัพย์ไม่สำเร็จ"));
    }
  }

  async function setRetired(a: Asset, inactive: boolean) {
    if (inactive && !confirm(`ปลดระวาง ${a.Name}?`)) return;
    setAssetErr("");
    const res = await fetch(`/api/assets/${a.AssetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inactive }),
    });
    if (!res.ok) setAssetErr(await errorOf(res, "บันทึกไม่สำเร็จ"));
    load();
  }

  async function doBorrow(e: React.FormEvent) {
    e.preventDefault();
    setBorrowErr("");
    setBusy(true);
    const res = await fetch("/api/assets/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "borrow", ...borrow }),
    }).finally(() => setBusy(false));
    if (res.ok) {
      setBorrow(EMPTY_BORROW);
      load();
    } else {
      setBorrowErr(await errorOf(res, "บันทึกการยืมไม่สำเร็จ"));
    }
  }

  async function doReturn(assetLoanId: string) {
    setBorrowErr("");
    setBusy(true);
    const res = await fetch("/api/assets/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "return", assetLoanId }),
    }).finally(() => setBusy(false));
    if (!res.ok) setBorrowErr(await errorOf(res, "บันทึกการคืนไม่สำเร็จ"));
    load();
  }

  const today = todayISO();
  const overdue = (l: Loan) => !l.ReturnedAt && l.DueAt != null && l.DueAt.slice(0, 10) < today;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="สินทรัพย์"
        subtitle={`${inUse.length} รายการ · ${available.length} ว่าง · ${inUse.length - available.length} ถูกยืม`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="font-medium mb-3">{editing ? "แก้ไขสินทรัพย์" : "ลงทะเบียนสินทรัพย์"}</div>
          <form onSubmit={saveAsset} className="grid grid-cols-2 gap-2">
            <input className="field" placeholder="ชื่อสินทรัพย์ *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="field" list="asset-categories" placeholder="หมวดหมู่ *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
            <datalist id="asset-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input className="field" placeholder="รหัส/เลขครุภัณฑ์" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="field" placeholder="สถานที่เก็บปกติ" value={form.defaultLocation} onChange={(e) => setForm({ ...form, defaultLocation: e.target.value })} />
            <button className={`${editing ? "" : "col-span-2 "}rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium`}>
              {editing ? "บันทึก" : "ลงทะเบียน"}
            </button>
            {editing && (
              <button type="button" onClick={cancelEdit} className="rounded-lg px-3 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">
                ยกเลิก
              </button>
            )}
            {assetErr && <div className="col-span-2 text-sm text-rose-400">{assetErr}</div>}
          </form>

          <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
            แสดงรายการที่ปลดระวางแล้ว
          </label>
          <div className="mt-2 max-h-72 overflow-y-auto">
            {listed.map((a) => (
              <div key={a.AssetId} className={`flex items-center justify-between gap-2 border-b border-slate-800/50 py-1.5 text-sm ${a.Inactive ? "opacity-50" : ""}`}>
                <span className="min-w-0 truncate">
                  {a.Name} <span className="text-slate-500">· {a.Category}{a.Code ? ` · ${a.Code}` : ""}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={a.Inactive ? "text-slate-500" : a.Loans.length ? "text-amber-300" : "text-emerald-300"}>
                    {a.Inactive ? "ปลดระวาง" : a.Loans.length ? `ถูกยืม (${a.Loans[0].BorrowerName})` : "ว่าง"}
                  </span>
                  <button onClick={() => setHistoryOf(a)} className="rounded-md px-1.5 py-0.5 text-xs bg-slate-800/60 hover:bg-slate-700/60">ประวัติ</button>
                  <button onClick={() => startEdit(a)} className="rounded-md px-1.5 py-0.5 text-xs bg-slate-800/60 hover:bg-slate-700/60">แก้ไข</button>
                  <button onClick={() => setRetired(a, !a.Inactive)} className="rounded-md px-1.5 py-0.5 text-xs bg-slate-800/60 hover:bg-slate-700/60">
                    {a.Inactive ? "นำกลับมาใช้" : "ปลดระวาง"}
                  </button>
                </span>
              </div>
            ))}
            {!listed.length && <div className="text-sm text-slate-500 py-3">ยังไม่มีสินทรัพย์</div>}
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-3">ยืมสินทรัพย์</div>
          <form onSubmit={doBorrow} className="grid gap-2">
            <select className="field" value={borrow.assetId} onChange={(e) => setBorrow({ ...borrow, assetId: e.target.value })} required>
              <option value="">- เลือกสินทรัพย์ที่ว่าง -</option>
              {available.map((a) => (
                <option key={a.AssetId} value={a.AssetId}>
                  {a.Name} ({a.Category})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="ชื่อผู้ยืม *" value={borrow.borrowerName} onChange={(e) => setBorrow({ ...borrow, borrowerName: e.target.value })} required />
              <input className="field" placeholder="สถานที่นำไปใช้ *" value={borrow.location} onChange={(e) => setBorrow({ ...borrow, location: e.target.value })} required />
            </div>
            <label className="text-sm">
              <span className="block text-slate-400 mb-1">กำหนดคืน (ไม่บังคับ)</span>
              <input type="date" className="field w-full" min={today} value={borrow.dueAt} onChange={(e) => setBorrow({ ...borrow, dueAt: e.target.value })} />
            </label>
            <button disabled={busy} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50">
              บันทึกการยืม
            </button>
            {borrowErr && <div className="text-sm text-rose-400">{borrowErr}</div>}
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-medium">{historyOf ? `ประวัติการยืม-คืน: ${historyOf.Name}` : "ประวัติการยืม-คืน"}</div>
          {historyOf && (
            <button onClick={() => setHistoryOf(null)} className="rounded-md px-2 py-1 text-xs bg-slate-800/60 hover:bg-slate-700/60">
              ดูทั้งหมด
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">สินทรัพย์</th>
                <th className="py-2 pr-3">ผู้ยืม</th>
                <th className="py-2 pr-3">สถานที่</th>
                <th className="py-2 pr-3">วันที่ยืม</th>
                <th className="py-2 pr-3">กำหนดคืน</th>
                <th className="py-2 pr-3">วันที่คืน</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.AssetLoanId} className="border-b border-slate-800/50">
                  <td className="py-2 pr-3">
                    {l.Asset.Name} <span className="text-slate-500">· {l.Asset.Category}</span>
                  </td>
                  <td className="py-2 pr-3">{l.BorrowerName}</td>
                  <td className="py-2 pr-3 text-slate-400">{l.Location}</td>
                  <td className="py-2 pr-3 text-slate-400">{thDateTime(l.BorrowedAt)}</td>
                  <td className={`py-2 pr-3 ${overdue(l) ? "text-rose-300" : "text-slate-400"}`}>
                    {l.DueAt ? thDate(l.DueAt.slice(0, 10)) : "-"}
                    {overdue(l) && " (เลยกำหนด)"}
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{l.ReturnedAt ? thDateTime(l.ReturnedAt) : "-"}</td>
                  <td className="py-2">
                    {!l.ReturnedAt && (
                      <button
                        onClick={() => doReturn(l.AssetLoanId)}
                        disabled={busy}
                        className="rounded-md px-2 py-1 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        คืน
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loans.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    ยังไม่มีการยืม
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
