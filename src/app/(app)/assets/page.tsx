"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

interface Asset {
  AssetId: string;
  Name: string;
  Category: string;
  Code: string | null;
  DefaultLocation: string | null;
  Loans: { AssetLoanId: string; BorrowerName: string; Location: string; BorrowedAt: string }[];
}
interface Loan {
  AssetLoanId: string;
  AssetId: string;
  Asset: { Name: string; Category: string };
  BorrowerName: string;
  Location: string;
  BorrowedAt: string;
  ReturnedAt: string | null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [newAsset, setNewAsset] = useState({ name: "", category: "", code: "", defaultLocation: "" });
  const [borrow, setBorrow] = useState({ assetId: "", borrowerName: "", location: "" });
  const [assetErr, setAssetErr] = useState("");
  const [borrowErr, setBorrowErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? []));
    fetch("/api/assets/loans")
      .then((r) => r.json())
      .then((d) => setLoans(d.loans ?? []));
  }, []);

  useEffect(load, [load]);

  const categories = useMemo(
    () => Array.from(new Set(assets.map((a) => a.Category).filter(Boolean))),
    [assets]
  );
  const available = useMemo(() => assets.filter((a) => !a.Loans.length), [assets]);

  // The API answers failures with { error }. Without surfacing it the button
  // just does nothing and the user has no idea why.
  async function errorOf(res: Response, fallback: string): Promise<string> {
    const d = await res.json().catch(() => ({}));
    return d.error || fallback;
  }

  async function addAsset(e: React.FormEvent) {
    e.preventDefault();
    setAssetErr("");
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAsset),
    });
    if (res.ok) {
      setNewAsset({ name: "", category: "", code: "", defaultLocation: "" });
      load();
    } else {
      setAssetErr(await errorOf(res, "เพิ่มสินทรัพย์ไม่สำเร็จ"));
    }
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
      setBorrow({ assetId: "", borrowerName: "", location: "" });
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

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="สินทรัพย์"
        subtitle={`${assets.length} รายการ · ${available.length} ว่าง · ${assets.length - available.length} ถูกยืม`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="font-medium mb-3">ลงทะเบียนสินทรัพย์</div>
          <form onSubmit={addAsset} className="grid grid-cols-2 gap-2">
            <input className="field" placeholder="ชื่อสินทรัพย์ *" value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} required />
            <input className="field" list="asset-categories" placeholder="หมวดหมู่ *" value={newAsset.category} onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })} required />
            <datalist id="asset-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input className="field" placeholder="รหัส/เลขครุภัณฑ์" value={newAsset.code} onChange={(e) => setNewAsset({ ...newAsset, code: e.target.value })} />
            <input className="field" placeholder="สถานที่เก็บปกติ" value={newAsset.defaultLocation} onChange={(e) => setNewAsset({ ...newAsset, defaultLocation: e.target.value })} />
            <button className="col-span-2 rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium">
              ลงทะเบียน
            </button>
            {assetErr && <div className="col-span-2 text-sm text-rose-400">{assetErr}</div>}
          </form>

          <div className="mt-4 max-h-64 overflow-y-auto">
            {assets.map((a) => (
              <div key={a.AssetId} className="flex justify-between border-b border-slate-800/50 py-1.5 text-sm">
                <span>
                  {a.Name} <span className="text-slate-500">· {a.Category}</span>
                </span>
                <span className={a.Loans.length ? "text-amber-300" : "text-emerald-300"}>
                  {a.Loans.length ? `ถูกยืม (${a.Loans[0].BorrowerName})` : "ว่าง"}
                </span>
              </div>
            ))}
            {!assets.length && <div className="text-sm text-slate-500 py-3">ยังไม่มีสินทรัพย์</div>}
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
            <button disabled={busy} className="rounded-lg px-3 py-2 text-sm bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50">
              บันทึกการยืม
            </button>
            {borrowErr && <div className="text-sm text-rose-400">{borrowErr}</div>}
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="font-medium mb-3">ประวัติการยืม-คืน</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3">สินทรัพย์</th>
                <th className="py-2 pr-3">ผู้ยืม</th>
                <th className="py-2 pr-3">สถานที่</th>
                <th className="py-2 pr-3">วันที่ยืม</th>
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
                  <td colSpan={6} className="py-8 text-center text-slate-500">
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
