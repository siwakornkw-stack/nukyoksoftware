"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { baht, thDate, STATUS_STYLE } from "@/lib/format";
import { STATUS_LIST, type DebtRecord, type DebtStatus } from "@/lib/debt/types";
import { DebtPanel } from "./DebtPanel";

const PAGE_SIZE = 50;

export default function RecordsView({ admin }: { admin: boolean }) {
  const [records, setRecords] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [stmtCustomer, setStmtCustomer] = useState("");
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  const load = () =>
    fetch("/api/debt/records")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      return (
        r.docNo.toLowerCase().includes(term) ||
        r.customer.toLowerCase().includes(term) ||
        r.salesperson.toLowerCase().includes(term)
      );
    });
  }, [records, q, statusFilter]);

  const customers = useMemo(() => [...new Set(records.map((r) => r.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [records]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function changeStatus(docNo: string, status: DebtStatus) {
    const previous = records.find((r) => r.docNo === docNo)?.status;
    setErr("");
    setRecords((prev) => prev.map((r) => (r.docNo === docNo ? { ...r, status } : r)));
    const res = await fetch("/api/debt/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docNo, status }),
    });
    if (!res.ok) {
      // The row was updated ahead of the server; put it back so the screen does
      // not claim a status the database never accepted.
      if (previous) {
        setRecords((prev) => prev.map((r) => (r.docNo === docNo ? { ...r, status: previous } : r)));
      }
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "เปลี่ยนสถานะไม่สำเร็จ");
    }
  }

  return (
    <div className="max-w-7xl">
      <PageHeader
        title="รายการหนี้"
        subtitle={`${filtered.length} รายการ`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* One customer's open items, e.g. to attach to a collection letter. */}
            <select className="field py-1 text-sm max-w-56" value={stmtCustomer} onChange={(e) => setStmtCustomer(e.target.value)}>
              <option value="">- statement ลูกค้า -</option>
              {customers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {stmtCustomer && (
              <a href={`/api/export/debt-statement?customer=${encodeURIComponent(stmtCustomer)}`} className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
                ดาวน์โหลด statement
              </a>
            )}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page */}
            <a href="/api/export/debt" className="rounded-lg px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/60">
              ส่งออก Excel
            </a>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="field max-w-xs"
            placeholder="ค้นหา เลขที่เอกสาร / ลูกค้า / พนักงานขาย"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="field max-w-[180px]"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกสถานะ</option>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        {err && <div className="mb-3 text-sm text-rose-400">{err}</div>}
        {loading ? (
          <div className="text-slate-400 py-8 text-center">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3">เลขที่เอกสาร</th>
                  <th className="py-2 pr-3">ลูกค้า</th>
                  <th className="py-2 pr-3">วันที่</th>
                  <th className="py-2 pr-3">ครบกำหนด</th>
                  <th className="py-2 pr-3 text-right">ยอดรวม</th>
                  <th className="py-2 pr-3 text-right">คงค้าง</th>
                  <th className="py-2 pr-3">พนักงานขาย</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3 font-mono text-xs">{r.docNo}</td>
                    <td className="py-2 pr-3 max-w-[220px] truncate">{r.customer}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{thDate(r.date)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{thDate(r.dueDate)}</td>
                    <td className="py-2 pr-3 text-right">{baht(r.total)}</td>
                    <td className={`py-2 pr-3 text-right ${r.paid > 0 ? "text-amber-300" : "text-slate-400"}`}>
                      {r.status === "ยกเลิก" ? "-" : baht(Math.max(0, r.total - r.paid))}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{r.salesperson || "-"}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={r.status}
                        onChange={(e) => changeStatus(r.docNo, e.target.value as DebtStatus)}
                        className={`rounded-md border px-2 py-1 text-xs bg-transparent ${STATUS_STYLE[r.status] ?? ""}`}
                      >
                        {STATUS_LIST.map((s) => (
                          <option key={s} value={s} className="bg-slate-900 text-slate-200">
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenDoc(r.docNo)}
                        className="whitespace-nowrap rounded-lg bg-slate-800/60 px-2.5 py-1 text-xs hover:bg-slate-700/60"
                      >
                        รับชำระ / ติดตาม
                      </button>
                    </td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      ไม่พบรายการ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <button
              className="rounded-lg px-3 py-1.5 bg-slate-800/60 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ก่อนหน้า
            </button>
            <span className="text-slate-400">
              หน้า {page} / {pageCount}
            </span>
            <button
              className="rounded-lg px-3 py-1.5 bg-slate-800/60 disabled:opacity-40"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              ถัดไป
            </button>
          </div>
        )}
      </Card>

      {openDoc && <DebtPanel docNo={openDoc} admin={admin} onClose={() => setOpenDoc(null)} onChanged={load} />}
    </div>
  );
}
