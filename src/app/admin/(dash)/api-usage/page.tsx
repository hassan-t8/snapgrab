import { format } from "date-fns";
import { Activity, AlertTriangle, Gauge, Server, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import Pagination from "@/components/admin/Pagination";
import { isDemoMode } from "@/lib/provider";
import { daysAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;

export default async function ApiUsagePage({ searchParams }: PageProps<"/admin/api-usage">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const d30 = daysAgo(30);
  const d1 = daysAgo(1);

  const [rows, total, calls30, calls24, failed30, cached30, latency, byProvider, byPlatform, cache, quota] = await Promise.all([
    prisma.apiCall.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.apiCall.count(),
    prisma.apiCall.count({ where: { createdAt: { gte: d30 } } }),
    prisma.apiCall.count({ where: { createdAt: { gte: d1 } } }),
    prisma.apiCall.count({ where: { createdAt: { gte: d30 }, ok: false } }),
    prisma.apiCall.count({ where: { createdAt: { gte: d30 }, cached: true } }),
    prisma.apiCall.aggregate({ where: { createdAt: { gte: d30 }, cached: false }, _avg: { latencyMs: true }, _max: { latencyMs: true } }),
    prisma.apiCall.groupBy({ by: ["provider"], _count: { _all: true } }),
    prisma.apiCall.groupBy({ by: ["platform"], _count: { _all: true }, orderBy: { _count: { platform: "desc" } }, take: 8 }),
    prisma.resolveCache.aggregate({ _count: { _all: true }, _sum: { hits: true } }),
    // the newest reading of the provider's own rate-limit headers
    prisma.apiCall.findFirst({
      where: { quotaRemaining: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { quotaRemaining: true, quotaLimit: true, createdAt: true, provider: true },
    }),
  ]);

  const billable = calls30 - cached30;

  return (
    <div className="space-y-5">
      {(await isDemoMode()) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-400">Demo mode is active</p>
            <p className="mt-0.5 text-sm text-muted">
              No RapidAPI key is set, so resolves return sample media and are logged with the provider{" "}
              <code className="font-mono">demo</code>. Add your key in{" "}
              <a href="/admin/integrations" className="font-semibold text-brand-400 underline">
                Integrations
              </a>{" "}
              to go live.
            </p>
          </div>
        </div>
      )}

      {quota?.quotaRemaining != null && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${
            quota.quotaRemaining <= 20
              ? "border-red-500/30 bg-red-500/10"
              : quota.quotaRemaining <= 100
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-accent-500/30 bg-accent-500/10"
          }`}
        >
          <Gauge
            className={`h-5 w-5 shrink-0 ${
              quota.quotaRemaining <= 20 ? "text-red-400" : quota.quotaRemaining <= 100 ? "text-amber-400" : "text-accent-400"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              Provider plan: {quota.quotaRemaining.toLocaleString()}
              {quota.quotaLimit ? ` of ${quota.quotaLimit.toLocaleString()}` : ""} calls left this period
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Reported by {quota.provider} · read {format(quota.createdAt, "d MMM, HH:mm")}. Cached resolves do not
              count against it.
            </p>
          </div>
          {quota.quotaLimit ? (
            <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--bg-soft)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                style={{ width: `${Math.max(2, (quota.quotaRemaining / quota.quotaLimit) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Calls (30d)" value={calls30.toLocaleString()} icon={<Activity />} sub={`${calls24} in the last 24h`} />
        <StatCard
          label="Billable upstream calls"
          value={billable.toLocaleString()}
          icon={<Server />}
          tone="amber"
          sub={`${cached30.toLocaleString()} served from cache`}
          delay={0.05}
        />
        <StatCard
          label="Cache hit rate"
          value={`${calls30 ? Math.round((cached30 / calls30) * 100) : 0}%`}
          icon={<Zap />}
          tone="accent"
          sub={`${cache._count._all} cached links · ${cache._sum.hits ?? 0} reuses`}
          delay={0.1}
        />
        <StatCard
          label="Avg / max latency"
          value={`${Math.round(latency._avg.latencyMs ?? 0)}ms`}
          icon={<Gauge />}
          tone={failed30 > 0 ? "red" : "brand"}
          sub={`Peak ${latency._max.latencyMs ?? 0}ms · ${failed30} failures`}
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Calls by provider">
          <div className="space-y-3 p-5">
            {byProvider.length === 0 && <p className="py-8 text-center text-sm text-muted">No API calls logged yet.</p>}
            {byProvider.map((p) => {
              const max = Math.max(...byProvider.map((x) => x._count._all));
              return (
                <div key={p.provider}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-mono text-xs">{p.provider}</span>
                    <span className="shrink-0 text-muted">{p._count._all.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                      style={{ width: `${Math.max(4, (p._count._all / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Calls by platform">
          <div className="space-y-3 p-5">
            {byPlatform.length === 0 && <p className="py-8 text-center text-sm text-muted">Nothing yet.</p>}
            {byPlatform.map((p) => {
              const max = Math.max(...byPlatform.map((x) => x._count._all));
              return (
                <div key={p.platform ?? "unknown"}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="capitalize">{p.platform ?? "unknown"}</span>
                    <span className="text-muted">{p._count._all.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-500 to-brand-500"
                      style={{ width: `${Math.max(4, (p._count._all / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title={`${total.toLocaleString()} logged API calls`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">Provider</th>
                <th className="px-5 py-3 font-semibold">Platform</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Latency</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={6} message="No API calls logged yet." />}
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                  <td className="max-w-[240px] truncate px-5 py-3 font-mono text-xs">{c.provider}</td>
                  <td className="px-5 py-3 text-xs capitalize">{c.platform ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={c.ok ? "ok" : "bad"}>{c.ok ? `${c.status || 200} OK` : `${c.status || "ERR"}`}</Badge>
                    {c.errorMsg && <p className="mt-1 max-w-[240px] truncate text-xs text-red-400">{c.errorMsg}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{c.latencyMs}ms</td>
                  <td className="px-5 py-3">
                    <Badge tone={c.cached ? "ok" : "muted"}>{c.cached ? "cache" : "upstream"}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{format(c.createdAt, "d MMM, HH:mm:ss")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} perPage={PER_PAGE} makeHref={(p) => `/admin/api-usage?page=${p}`} />
      </Panel>
    </div>
  );
}
