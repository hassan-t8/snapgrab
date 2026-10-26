"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { stroke: "var(--fg-muted)", fontSize: 11 };

/** Small price-history chart for the public rate pages. */
export default function RateChart({ data, color = "#7048f0", label }: { data: { date: string; value: number }[]; color?: string; label: string }) {
  if (data.length < 2) return null;
  const id = `rate-${label.replace(/\W+/g, "")}`;
  return (
    <div className="h-56 w-full" role="img" aria-label={`${label} price history`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5).replace("-", "/")} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString("en-PK")} />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, color: "var(--fg)" }}
            formatter={(v) => [`Rs ${Number(v).toLocaleString("en-PK")}`, label]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
