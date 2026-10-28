"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { thDate, thDateTime } from "@/lib/format";
import { samePayee } from "@/lib/po/pz-match";
import { CopyButton } from "../CopyButton";

interface Bank {
  code: string;
  name: string;
  accountName: string;
}
interface Payment {
  status: string; // queued | done | error
  pzNo: string;
  slipUrl: string;
  amount: number;
  date: string;
  payType: string;
  ref: string;
  error: string;
  by: string;
  at: string;
}
interface Slip {
  slipUrl: string;
  preview: string; // object URL of an image slip, "" for a PDF
  readError: string;
  isSlip: boolean;
  toName: string;
  fromAccount: string;
}

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;

// PK only, once its R3 is in Express: the admin uploads the transfer slip that
// pays the R3 back to the card owner, and the office PC opens the PZ
// (PZ-จ่ายชำระหนี้-น้ำมัน) in Express from it.
export function PayPanel({
  poNo,
  r3,
  payment,
  banks,
  creditor,
  canPay,
  writer,
}: {
  poNo: string;
  r3: { docNo: string; date: string | null; amount: number };
  payment: Payment | null;
  banks: Bank[];
  creditor: string;
  canPay: boolean;
  writer: boolean; // the office PC writes PZs (EXPRESS_PZ_MODE=live)
}) {
  const router = useRouter();
  const failed = payment?.status === "error";
  const [slip, setSlip] = useState<Slip | null>(failed ? { slipUrl: payment.slipUrl, preview: "", readError: "", isSlip: true, toName: "", fromAccount: "" } : null);
  const [amount, setAmount] = useState(failed ? String(payment.amount) : "");
  const [date, setDate] = useState(failed ? payment.date : "");
  const [payType, setPayType] = useState(failed ? payment.payType : "");
  const [ref, setRef] = useState(failed ? payment.ref : "");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const bankName = (code: string) => banks.find((b) => b.code === code)?.name ?? code;

  async function upload(file: File) {
    setErr("");
    setBusy("กำลังอ่านสลิป...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/po/pz-slip", { method: "POST", body: fd }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy("");
    if (!res?.ok) return setErr(d.error || "อัปโหลดสลิปไม่สำเร็จ");
    if (slip?.preview) URL.revokeObjectURL(slip.preview);
    setSlip({
      slipUrl: d.slipUrl,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      readError: d.readError ?? "",
      isSlip: d.isSlip ?? true,
      toName: d.toName ?? "",
      fromAccount: d.fromAccount ?? "",
    });
    if (d.amount) setAmount(String(d.amount));
    if (d.date) setDate(d.date);
    if (d.payType) setPayType(d.payType);
    if (d.ref) setRef(d.ref);
  }

  async function submit() {
    if (!slip) return;
    if (!confirm(`เปิด PZ จ่ายคืน ${r3.docNo} ยอด ${money(Number(amount))} บาท จาก ${bankName(payType)} ใน Express?`)) return;
    setErr("");
    setBusy("กำลังบันทึก...");
    const res = await fetch("/api/po/pz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poNo, slipUrl: slip.slipUrl, amount: Number(amount), date, payType, ref }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy("");
    if (!res?.ok) return setErr(d.error || "บันทึกไม่สำเร็จ");
    router.refresh();
  }

  const amountOk = Number(amount) > 0 && r2(Number(amount)) === r2(r3.amount);
  const ready = !!slip && amountOk && !!date && !!payType;
  const slipLink = (url: string) => (
    <a href={url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
      {url.endsWith(".pdf") ? "📄 เปิดสลิป (PDF)" : "🧾 เปิดสลิป"}
    </a>
  );

  return (
    <Card className="mt-4">
      <div className="mb-2 font-semibold">จ่ายคืน R3 (PZ-จ่ายชำระหนี้-น้ำมัน)</div>
      <div className="mb-3 text-sm text-slate-400">
        {r3.docNo} · ยอด <span className="text-slate-200">{money(r3.amount)}</span> บาท · จ่ายคืน {creditor || "เจ้าหนี้บัตรเครดิต"}
      </div>

      {payment?.status === "done" ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          ✅ จ่ายแล้ว: <span className="font-semibold">{payment.pzNo || "PZ"}</span> {payment.pzNo && <CopyButton value={payment.pzNo} label="คัดลอกเลข PZ" />}
          <div className="mt-1 text-slate-300">
            โอน {thDate(payment.date)} · {money(payment.amount)} บาท · {bankName(payment.payType)}
            {payment.ref && <> · อ้างอิง {payment.ref}</>} · {slipLink(payment.slipUrl)}
          </div>
          <div className="mt-1 text-xs text-slate-500">บันทึกโดย {payment.by} · {thDateTime(payment.at)}</div>
        </div>
      ) : payment?.status === "queued" ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-300">
          ⏳ กำลังเปิด PZ ใน Express (ประมาณ 1-2 นาที) · โอน {thDate(payment.date)} · {money(payment.amount)} บาท · {slipLink(payment.slipUrl)}
        </div>
      ) : !canPay ? (
        <div className="text-sm text-slate-400">รอผู้ดูแลระบบ (admin) อัปโหลดสลิปโอนคืน</div>
      ) : !writer && !failed ? (
        <div className="text-sm text-slate-500">การเปิด PZ จากสลิปยังไม่เปิดใช้</div>
      ) : (
        <>
          {failed && (
            <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
              <div className="font-medium text-rose-300">⛔ เปิด PZ ไม่สำเร็จ</div>
              <div className="mt-1 text-slate-300">{payment.error}</div>
              <div className="mt-1 text-xs text-slate-400">แก้ข้อมูลหรืออัปโหลดสลิปใหม่ แล้วกดยืนยันอีกครั้ง</div>
            </div>
          )}
          <label className="inline-block cursor-pointer rounded-lg px-3 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60">
            📎 {slip ? "เปลี่ยนสลิป" : "อัปโหลดสลิปโอนเงิน (รูป หรือ PDF)"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
          {busy && <span className="ml-3 text-sm text-sky-400">{busy}</span>}

          {slip && (
            <div className="mt-3 grid gap-4 md:grid-cols-[12rem_1fr]">
              <div>
                {slip.preview ? (
                  <a href={slip.preview} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not an optimisable asset */}
                    <img src={slip.preview} alt="สลิป" className="h-48 w-48 rounded-lg bg-slate-900 object-contain" />
                  </a>
                ) : (
                  <div className="text-sm">{slipLink(slip.slipUrl)}</div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {slip.readError && <div className="text-amber-300">⚠ {slip.readError}</div>}
                {!slip.readError && !slip.isSlip && <div className="text-amber-300">ไฟล์นี้อาจไม่ใช่สลิปโอนเงิน ตรวจก่อนยืนยัน</div>}
                {slip.toName && !samePayee(slip.toName, creditor) && (
                  <div className="text-amber-300">
                    ผู้รับเงินในสลิป: {slip.toName} ไม่ตรงกับ {creditor} ตรวจว่าเป็นสลิปที่ถูกต้อง
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-slate-400">ยอดเงินที่โอน</span>
                    <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field w-full" />
                    {amount && (
                      <span className={`mt-1 block text-xs ${amountOk ? "text-emerald-300" : "text-rose-300"}`}>
                        {amountOk ? `✓ ตรงกับยอด ${r3.docNo}` : `ต้องเท่ากับยอด ${r3.docNo} (${money(r3.amount)})`}
                      </span>
                    )}
                  </label>
                  <label>
                    <span className="mb-1 block text-slate-400">วันที่โอน</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field w-full" />
                  </label>
                  <label>
                    <span className="mb-1 block text-slate-400">บัญชีที่โอนออก</span>
                    <select value={payType} onChange={(e) => setPayType(e.target.value)} className="field w-full">
                      <option value="">- เลือกบัญชี -</option>
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} {b.name} ({b.accountName})
                        </option>
                      ))}
                    </select>
                    {slip.fromAccount && <span className="mt-1 block text-xs text-slate-500">ในสลิป: {slip.fromAccount}</span>}
                  </label>
                  <label>
                    <span className="mb-1 block text-slate-400">
                      เลขที่รายการ / อ้างอิง <span className="text-slate-600">(ไม่บังคับ)</span>
                    </span>
                    <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={40} className="field w-full" />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!ready || !!busy}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50"
                >
                  ยืนยันเปิด PZ ใน Express
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {err && <div className="mt-2 text-sm text-rose-400">{err}</div>}
    </Card>
  );
}
