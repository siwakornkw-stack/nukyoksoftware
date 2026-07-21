import type { ReactNode } from "react";

// Shared presentational primitives used by all three modules to keep a
// consistent dark look without each module re-inventing layout.

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = "sky",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "sky" | "violet" | "emerald" | "amber" | "rose";
}) {
  const ring: Record<string, string> = {
    sky: "text-sky-300",
    violet: "text-violet-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };
  return (
    <Card>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${ring[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}
