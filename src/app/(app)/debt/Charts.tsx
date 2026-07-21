"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Card } from "@/components/ui";
import { compact } from "@/lib/format";

const COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#64748b"];

type StatusSlice = { status: string; count: number; amount: number };
type MonthPoint = { month: string; amount: number; count: number };
type Bucket = { bucket: string; amount: number; count: number };
type Sales = { name: string; amount: number; count: number };

export function DebtCharts({
  byStatus,
  monthly,
  agingBuckets,
  bySalesperson,
}: {
  byStatus: StatusSlice[];
  monthly: MonthPoint[];
  agingBuckets: Bucket[];
  bySalesperson: Sales[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="font-medium mb-2">สัดส่วนตามสถานะ</div>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={byStatus} dataKey="amount" nameKey="status" outerRadius={90} label>
              {byStatus.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              formatter={(v: unknown) => compact(Number(v))}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="font-medium mb-2">มูลค่ารายเดือน</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              formatter={(v: unknown) => compact(Number(v))}
            />
            <Area type="monotone" dataKey="amount" stroke="#38bdf8" fill="rgba(56,189,248,0.15)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="font-medium mb-2">อายุหนี้เกินกำหนด</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={agingBuckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              formatter={(v: unknown) => compact(Number(v))}
            />
            <Bar dataKey="amount" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="font-medium mb-2">ยอดค้างตามพนักงานขาย</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bySalesperson} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              formatter={(v: unknown) => compact(Number(v))}
            />
            <Bar dataKey="amount" fill="#a78bfa" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
