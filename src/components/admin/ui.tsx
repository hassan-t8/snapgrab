"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  tone = "brand",
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** Pass a rendered element, not a component — this is a client boundary. */
  icon: ReactNode;
  delta?: number;
  tone?: "brand" | "accent" | "amber" | "red";
  delay?: number;
}) {
  const tones = {
    brand: "from-brand-500/20 to-brand-500/5 text-brand-400",
    accent: "from-accent-500/20 to-accent-500/5 text-accent-400",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-400",
    red: "from-red-500/20 to-red-500/5 text-red-400",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl surface p-5 transition-transform hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${tones[tone]} [&_svg]:h-[18px] [&_svg]:w-[18px]`}>
          {icon}
        </span>
        {typeof delta === "number" && (
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
              delta >= 0 ? "bg-accent-500/15 text-accent-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </motion.div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-2xl surface ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "ok" | "bad" | "warn" | "muted" }) {
  const tones = {
    ok: "bg-accent-500/15 text-accent-400",
    bad: "bg-red-500/15 text-red-400",
    warn: "bg-amber-500/15 text-amber-400",
    muted: "bg-[var(--bg-soft)] text-muted",
  } as const;
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-14 text-center text-sm text-muted">
        {message}
      </td>
    </tr>
  );
}
