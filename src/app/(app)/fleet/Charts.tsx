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
  Legend,
} from "recharts";
import { Card } from "@/components/ui";
import { compact } from "@/lib/format";

const tooltipStyle = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8 };

export function FleetAgingChart({ data }: { data: { bucket: string; amount: number }[] }) {
  return (
    <Card>
      <div className="font-medium mb-2">อายุหนี้ค่างวด (เกินกำหนด)</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => compact(Number(v))} />
          <Bar dataKey="amount" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function FinanceChart({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  return (
    <Card>
      <div className="font-medium mb-2">รายรับ vs ค่าใช้จ่าย รายเดือน</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => compact(Number(v))} />
          <Legend />
          <Line type="monotone" dataKey="income" name="รายรับ" stroke="#34d399" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="expense" name="ค่าใช้จ่าย" stroke="#f43f5e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
