"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, KeyRound, Loader2, RotateCcw, ShieldAlert, Zap } from "lucide-react";
import { Badge, Panel } from "./ui";
import { notify } from "@/components/Toaster";

export type QuotaCard = {
  id: string;
  label: string;
  tier: "free-api" | "paid";
  purpose: string;
  note: string;
  dashboardUrl: string;
  keyEnv: string | null;
  configured: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  period: "day" | "month";
  resetsAt: string;
  exhausted: boolean;
  forceEnabled: boolean;
  available: boolean;
  lastError: string | null;
  lastCallAt: string | null;
  tools: string[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Card({ q }: { q: QuotaCard }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState(q.limit == null ? "" : String(q.limit));
  const [renews, setRenews] = useState(q.resetsAt.slice(0, 10));

  const pct = q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
  const bar = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-gradient-to-r from-brand-500 to-accent-500";

  async function patch(action: string, body: Record<string, unknown>, success: string) {
    setBusy(action);
    try {
      const res = await fetch("/api/admin/quotas", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: q.id, ...body }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      notify.success(success);
      router.refresh();
    } catch (err) {
      notify.error("Could not save", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const status = !q.configured ? (
    <Badge tone="warn">Key missing{q.keyEnv ? ` · add it in ${q.keyEnv}` : ""}</Badge>
  ) : q.exhausted && q.forceEnabled ? (
    <Badge tone="warn">Limit reached · force-enabled</Badge>
  ) : q.exhausted ? (
    <Badge tone="bad">Paused · limit reached</Badge>
  ) : (
    <Badge tone="ok">Live</Badge>
  );

  return (
    <div className="rounded-2xl border border-[var(--line)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{q.label}</h3>
            <Badge tone={q.tier === "paid" ? "warn" : "muted"}>{q.tier === "paid" ? "Paid API" : "Free API"}</Badge>
            {status}
          </div>
          <p className="mt-1 text-xs text-muted">
            {q.purpose} · used by {q.tools.join(", ") || "—"}
          </p>
        </div>
        <a
          href={q.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-bold text-muted hover:text-brand-400"
        >
          Provider plan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            {q.used.toLocaleString()} {q.limit != null ? `/ ${q.limit.toLocaleString()}` : ""} calls this {q.period}
          </span>
          <span className="text-xs text-muted">
            {q.remaining != null ? `${q.remaining.toLocaleString()} left` : "no limit set — only counting"}
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${q.limit ? Math.max(pct, 2) : 0}%` }} />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> Renews {when(q.resetsAt)}
          </span>
          {q.lastCallAt && <span>Last call {when(q.lastCallAt)}</span>}
          {q.lastError && <span className="text-red-400">Last error: {q.lastError}</span>}
        </p>
      </div>

      {q.exhausted && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {q.forceEnabled
            ? "The limit is reached but you forced it on. Calls may fail or be billed as overage until the plan renews."
            : `Visitors see “limit reached, back on ${when(q.resetsAt)}”. It switches back on by itself when the period renews.`}
        </p>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl surface p-3">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Limit per {q.period}</span>
          <div className="mt-2 flex gap-2">
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="No limit"
              inputMode="numeric"
              className="w-full min-w-0 rounded-lg bg-[var(--bg-soft)] px-3 py-1.5 text-sm outline-none ring-1 ring-[var(--line)] focus:ring-brand-400"
            />
            <select
              defaultValue={q.period}
              onChange={(e) => patch("period", { period: e.target.value }, "Period updated")}
              className="rounded-lg bg-[var(--bg-soft)] px-2 text-xs ring-1 ring-[var(--line)]"
            >
              <option value="day">/ day</option>
              <option value="month">/ month</option>
            </select>
            <button
              onClick={() => patch("limit", { limit: limit ? Number(limit) : null }, "Limit saved")}
              disabled={!!busy}
              className="rounded-lg bg-brand-500 px-3 text-xs font-bold text-white disabled:opacity-60"
            >
              {busy === "limit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
        </div>

        <div className="rounded-xl surface p-3">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Next renewal date</span>
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={renews}
              onChange={(e) => setRenews(e.target.value)}
              className="w-full min-w-0 rounded-lg bg-[var(--bg-soft)] px-3 py-1.5 text-sm outline-none ring-1 ring-[var(--line)] focus:ring-brand-400"
            />
            <button
              onClick={() => renews && patch("renews", { renewsAt: new Date(`${renews}T00:00:00Z`).toISOString() }, "Renewal date saved")}
              disabled={!!busy}
              className="rounded-lg bg-brand-500 px-3 text-xs font-bold text-white disabled:opacity-60"
            >
              {busy === "renews" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl surface p-3">
          <button
            onClick={() => patch("force", { forceEnabled: !q.forceEnabled }, q.forceEnabled ? "Back to automatic" : "Force-enabled")}
            disabled={!!busy}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
              q.forceEnabled ? "bg-amber-500/20 text-amber-300" : "bg-[var(--bg-soft)] ring-1 ring-[var(--line)]"
            }`}
          >
            {busy === "force" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {q.forceEnabled ? "Forced on — switch to automatic" : "Force enable even if limit reached"}
          </button>
          <button
            onClick={() => {
              if (window.confirm("Mark the plan as renewed now? The counter goes back to 0 and the tools switch on.")) {
                patch("reset", { reset: true }, "Plan renewed — counter reset");
              }
            }}
            disabled={!!busy}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-soft)] px-3 py-1.5 text-xs font-bold ring-1 ring-[var(--line)] disabled:opacity-60"
          >
            {busy === "reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Plan renewed — reset counter
          </button>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {q.note}
      </p>
    </div>
  );
}

export default function QuotaManager({ quotas }: { quotas: QuotaCard[] }) {
  return (
    <Panel title="API limits — auto-pause and auto-renew">
      <div className="space-y-4 p-5">
        {quotas.map((q) => (
          <Card key={`${q.id}:${q.resetsAt}:${q.limit}:${q.forceEnabled}`} q={q} />
        ))}
      </div>
    </Panel>
  );
}
