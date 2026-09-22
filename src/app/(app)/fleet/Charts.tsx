"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui";
import { compact, num } from "@/lib/format";

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

export function FuelTrendChart({
  data,
}: {
  data: { label: string; amount: number; liters: number; avgPrice: number }[];
}) {
  return (
    <Card>
      <div className="font-medium mb-2">ค่าน้ำมันรายเดือน</div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis yAxisId="baht" tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
          <YAxis yAxisId="liters" orientation="right" tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: unknown, name: unknown) => [num(Number(v), 2), String(name)]}
          />
          <Legend />
          <Bar yAxisId="baht" dataKey="amount" name="บาท" fill="#38bdf8" radius={[4, 4, 0, 0]} />
          <Line yAxisId="liters" type="monotone" dataKey="liters" name="ลิตร" stroke="#fbbf24" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function FuelVehicleChart({ data }: { data: { plate: string; amount: number }[] }) {
  return (
    <Card>
      <div className="font-medium mb-2">ค่าน้ำมันสูงสุด 15 อันดับ</div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 26 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis type="category" dataKey="plate" tick={{ fontSize: 11, fill: "#cbd5e1" }} width={96} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [num(Number(v), 2), "บาท"]} />
          <Bar dataKey="amount" fill="#38bdf8" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ExpiryChart({ data }: { data: { label: string; ins: number; cmi: number; tax: number }[] }) {
  return (
    <Card>
      <div className="font-medium mb-2">จำนวนที่จะหมดอายุ 12 เดือนข้างหน้า</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} width={32} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="ins" name="ประกันภัย" stackId="a" fill="#38bdf8" />
          <Bar dataKey="cmi" name="พ.ร.บ." stackId="a" fill="#a78bfa" />
          <Bar dataKey="tax" name="ภาษี" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
