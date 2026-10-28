import { APPROVAL_LABEL, DOC_STAT_LABEL, type ApprovalKey, type R3State } from "@/lib/po/purchase-orders";

const DOC_STYLE: Record<string, string> = {
  N: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  M: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  C: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};
const APPROVAL_STYLE: Record<ApprovalKey, string> = {
  pending: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  auto: "bg-emerald-500/10 text-emerald-300/80 border-emerald-500/20",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  none: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const pill = "inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-xs";

// Receiving status as Express reports it.
export function DocStatBadge({ stat, missing }: { stat: string; missing?: boolean }) {
  if (missing) return <span className={`${pill} bg-rose-500/15 text-rose-300 border-rose-500/30`}>ถูกลบใน Express</span>;
  return <span className={`${pill} ${DOC_STYLE[stat] ?? DOC_STYLE.C}`}>{DOC_STAT_LABEL[stat] ?? stat}</span>;
}

// PK only: where its R3 (ตั้งหนี้บัตรเครดิต) in Express stands.
export function R3Badge({ r3 }: { r3: R3State }) {
  if (!r3) return null;
  if (r3.state === "opened") return <span className={`${pill} bg-emerald-500/15 text-emerald-300 border-emerald-500/30`}>R3: {r3.docNo}</span>;
  if (r3.state === "error") return <span className={`${pill} bg-rose-500/15 text-rose-300 border-rose-500/30`} title={r3.error}>สร้าง R3 ไม่สำเร็จ</span>;
  if (r3.state === "waiting") return <span className={`${pill} bg-amber-500/15 text-amber-300 border-amber-500/30`}>รอ H3 ใน Express</span>;
  return <span className={`${pill} bg-sky-500/15 text-sky-300 border-sky-500/30`}>กำลังสร้าง R3</span>;
}

// Effective approval (see effectiveApproval): our decision, or "auto" when
// Express shows the goods fully received.
export function ApprovalBadge({ k }: { k: ApprovalKey }) {
  return <span className={`${pill} ${APPROVAL_STYLE[k]}`}>{APPROVAL_LABEL[k]}</span>;
}
