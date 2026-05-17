"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

interface DataPoint {
  label: string;
  count: number;
  percentage: number;
}

interface EeoChartCardProps {
  title: string;
  data: DataPoint[];
}

export function EeoChartCard({ title, data }: EeoChartCardProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, props: any) => [
              `${value}% (${props?.payload?.count ?? 0})`,
              "Share",
            ]}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
            {data.map((_entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
