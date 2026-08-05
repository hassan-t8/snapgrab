"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#7048f0", "#14c8be", "#8f74ff", "#38e0d0", "#b0a1ff", "#0aa39c", "#5a2fd6", "#f59e0b"];

const axis = { stroke: "var(--fg-muted)", fontSize: 11 };

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--fg)",
};

function shortDate(d: string) {
  return d.slice(5).replace("-", "/");
}

export function TrafficChart({
  data,
}: {
  data: { date: string; downloads: number; failed: number; views: number }[];
}) {
  return (
    <div className="h-72 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gDl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7048f0" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#7048f0" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gVw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14c8be" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#14c8be" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Date: ${l}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="views"
            name="Page views"
            stroke="#14c8be"
            strokeWidth={2}
            fill="url(#gVw)"
          />
          <Area
            type="monotone"
            dataKey="downloads"
            name="Downloads"
            stroke="#7048f0"
            strokeWidth={2}
            fill="url(#gDl)"
          />
          <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={1.5} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlatformChart({ data }: { data: { platform: string; count: number }[] }) {
  return (
    <div className="h-80 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 12, left: -18, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="platform" tick={axis} tickLine={false} axisLine={false} interval={0} angle={-30} height={54} textAnchor="end" />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-soft)" }} />
          <Bar dataKey="count" name="Downloads" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, nameKey }: { data: Record<string, unknown>[]; nameKey: string }) {
  return (
    <div className="h-64 w-full py-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey={nameKey}
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
