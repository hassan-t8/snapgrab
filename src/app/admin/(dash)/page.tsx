import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  Gauge,
  Mail,
  Users,
  Zap,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getCountryBreakdown,
  getDeviceBreakdown,
  getOverview,
  getPlatformBreakdown,
  getTimeSeries,
  getTopPages,
} from "@/lib/stats";
import { Badge, EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import { DonutChart, PlatformChart, TrafficChart } from "@/components/admin/Charts";
import { isDemoMode } from "@/lib/provider";
import { mailerConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [o, series, platforms, countries, devices, pages, recent] = await Promise.all([
    getOverview(),
    getTimeSeries(14),
    getPlatformBreakdown(),
    getCountryBreakdown(),
    getDeviceBreakdown(),
    getTopPages(),
    prisma.download.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
  ]);

  const health = [
    { label: "RapidAPI key", ok: !isDemoMode(), note: isDemoMode() ? "Demo mode — add RAPIDAPI_KEY" : "Configured" },
    { label: "SMTP mailer", ok: mailerConfigured(), note: mailerConfigured() ? "Configured" : "Contact form saves only" },
    {
      label: "AdSense",
      ok: Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT),
      note: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? "Live" : "Placeholder slots",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Downloads (7d)"
          value={o.downloads7d.toLocaleString()}
          icon={<Download />}
          delta={o.growth}
          sub={`${o.totalDownloads.toLocaleString()} all time · ${o.downloads24h} today`}
          delay={0}
        />
        <StatCard
          label="Visitors (7d)"
          value={o.visitors7d.toLocaleString()}
          icon={<Users />}
          tone="accent"
          sub={`${o.totalVisitors.toLocaleString()} unique all time · ${o.visitors24h} today`}
          delay={0.05}
        />
        <StatCard
          label="Page views (7d)"
          value={o.pageViews7d.toLocaleString()}
          icon={<Eye />}
          tone="amber"
          sub="Every route change is recorded"
          delay={0.1}
        />
        <StatCard
          label="Success rate (7d)"
          value={`${o.successRate}%`}
          icon={<CheckCircle2 />}
          tone={o.successRate >= 90 ? "accent" : "red"}
          sub="Resolved vs failed attempts"
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Traffic & downloads — last 14 days" className="self-start lg:col-span-2">
          <TrafficChart data={series} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Provider health">
            <div className="space-y-3 p-5">
              {health.map((h) => (
                <div key={h.label} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{h.label}</p>
                    <p className="truncate text-xs text-muted">{h.note}</p>
                  </div>
                  <Badge tone={h.ok ? "ok" : "warn"}>{h.ok ? "OK" : "Setup"}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            <StatCard label="API calls (30d)" value={o.apiCalls30d.toLocaleString()} icon={<Activity />} sub={`${o.apiFailed30d} failed`} />
            <StatCard label="Cache hit rate" value={`${o.cacheHitRate}%`} icon={<Zap />} tone="accent" sub="Saved API quota" />
            <StatCard label="Avg latency" value={`${o.avgLatency}ms`} icon={<Gauge />} tone="amber" sub="Upstream only" />
            <StatCard label="Unread messages" value={o.unhandled} icon={<Mail />} tone={o.unhandled ? "red" : "brand"} sub={`${o.messages} total`} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Downloads by platform">
          {platforms.length ? (
            <PlatformChart data={platforms} />
          ) : (
            <p className="p-14 text-center text-sm text-muted">No downloads recorded yet.</p>
          )}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title="Top countries">
            {countries.length ? (
              <DonutChart data={countries} nameKey="country" />
            ) : (
              <p className="p-10 text-center text-sm text-muted">No geo data yet.</p>
            )}
          </Panel>
          <Panel title="Devices">
            {devices.length ? (
              <DonutChart data={devices} nameKey="device" />
            ) : (
              <p className="p-10 text-center text-sm text-muted">No device data yet.</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Latest download activity"
          action={
            <Link href="/admin/downloads" className="flex items-center gap-1 text-xs font-bold text-brand-400">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-semibold">Platform</th>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && <EmptyRow colSpan={4} message="Nothing yet — try a download on the live site." />}
                {recent.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                    <td className="px-5 py-3 font-semibold capitalize">{d.platform}</td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-muted">{d.title ?? d.sourceUrl}</td>
                    <td className="px-5 py-3">
                      <Badge tone={d.status === "failed" ? "bad" : d.status === "downloaded" ? "ok" : "muted"}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {formatDistanceToNow(d.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Most visited pages">
          <div className="space-y-3 p-5">
            {pages.length === 0 && <p className="py-8 text-center text-sm text-muted">No page views recorded yet.</p>}
            {pages.map((p) => {
              const max = pages[0]?.count || 1;
              return (
                <div key={p.path}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{p.path}</span>
                    <span className="shrink-0 text-muted">{p.count.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                      style={{ width: `${Math.max(4, (p.count / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
