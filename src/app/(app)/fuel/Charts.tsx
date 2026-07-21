"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui";
import { compact } from "@/lib/format";

const tooltipStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8 };

export function FuelCharts({
  daily,
  byEmployee,
  monthly,
}: {
  daily: { day: string; baht: number }[];
  byEmployee: { employee: string; baht: number }[];
  monthly: { ym: string; baht: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <div className="font-medium mb-2">ยอดต่อวัน (ในช่วงที่เลือก)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 10, fill: "#94a3b8" }} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => compact(Number(v))} />
            <Bar dataKey="baht" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="font-medium mb-2">ยอดต่อพนักงาน</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byEmployee} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis type="category" dataKey="employee" width={80} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => compact(Number(v))} />
            <Bar dataKey="baht" fill="#38bdf8" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="font-medium mb-2">เทียบรายเดือน (ทั้งหมด)</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="ym" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 10, fill: "#94a3b8" }} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => compact(Number(v))} />
            <Line type="monotone" dataKey="baht" stroke="#a78bfa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
