import Link from "next/link";
import { format } from "date-fns";
import { Download, ExternalLink, MousePointerClick, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import Pagination from "@/components/admin/Pagination";
import { TOOL_MAP } from "@/lib/tools";
import { daysAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const RANGES = [1, 7, 30, 90] as const;

function Bars({ rows, empty }: { rows: { key: string; label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-semibold">{r.label}</span>
            <span className="text-xs text-muted">{r.count.toLocaleString()}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
              style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const labelFor = (label: string | null) => (label && TOOL_MAP[label]?.name) || label || "—";

export default async function AdminEvents({ searchParams }: PageProps<"/admin/events">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const days = (RANGES as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 30;
  const name = typeof sp.name === "string" && /^[a-z0-9_-]{1,40}$/.test(sp.name) ? sp.name : undefined;
  const since = daysAgo(days);
  const where = { createdAt: { gte: since }, ...(name ? { name } : {}) };

  const [rows, total, byName, byLabel, outbound, visitors, downloads] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.event.count({ where }),
    prisma.event.groupBy({
      by: ["name"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
    }),
    prisma.event.groupBy({
      by: ["label"],
      where: { ...where, name: name ?? { not: "outbound" } },
      _count: { _all: true },
      orderBy: { _count: { label: "desc" } },
      take: 12,
    }),
    prisma.event.groupBy({
      by: ["label"],
      where: { createdAt: { gte: since }, name: "outbound" },
      _count: { _all: true },
      orderBy: { _count: { label: "desc" } },
      take: 8,
    }),
    prisma.event.findMany({ where, distinct: ["visitorId"], select: { visitorId: true } }).then((v) => v.length),
    prisma.event.count({ where: { createdAt: { gte: since }, name: { in: ["download", "download-all"] } } }),
  ]);

  const href = (q: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { days, name, ...q };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "") p.set(k, String(v));
    });
    return `/admin/events?${p.toString()}`;
  };

  const rangeLabel = days === 1 ? "24 hours" : `${days} days`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((d) => (
          <Link
            key={d}
            href={href({ days: d, page: undefined })}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              days === d ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted"
            }`}
          >
            {d === 1 ? "24 hours" : `${d} days`}
          </Link>
        ))}
        {name && (
          <Link href={href({ name: undefined, page: undefined })} className="ml-auto rounded-lg surface px-3 py-1.5 text-xs font-bold text-muted">
            Clear filter: {name} ✕
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={name ? `${name} events` : "Clicks & events"}
          value={total.toLocaleString()}
          icon={<MousePointerClick />}
          sub={`Last ${rangeLabel}`}
        />
        <StatCard label="People who clicked" value={visitors.toLocaleString()} icon={<Users />} tone="accent" sub="Unique visitors" delay={0.05} />
        <StatCard
          label="Downloads clicked"
          value={downloads.toLocaleString()}
          icon={<Download />}
          tone="amber"
          sub="Files saved from tools & downloader"
          delay={0.1}
        />
        <StatCard
          label="Outbound clicks"
          value={outbound.reduce((n, o) => n + o._count._all, 0).toLocaleString()}
          icon={<ExternalLink />}
          sub="Links to other sites"
          delay={0.15}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="By action">
          <div className="space-y-1 p-5">
            {byName.length === 0 && <p className="py-8 text-center text-sm text-muted">No clicks recorded yet.</p>}
            {byName.map((n) => (
              <Link
                key={n.name}
                href={href({ name: n.name, page: undefined })}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors hover:bg-brand-500/10 ${
                  name === n.name ? "bg-brand-500/10" : ""
                }`}
              >
                <span className="font-semibold">{n.name}</span>
                <Badge>{n._count._all.toLocaleString()}</Badge>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title={name ? `Top tools for ${name}` : "Top tools & pages"}>
          <div className="p-5">
            <Bars
              rows={byLabel.map((l) => ({ key: l.label ?? "none", label: labelFor(l.label), count: l._count._all }))}
              empty="Nothing yet."
            />
          </div>
        </Panel>
        <Panel title="Outbound destinations">
          <div className="p-5">
            <Bars
              rows={outbound.map((o) => ({ key: o.label ?? "none", label: o.label ?? "—", count: o._count._all }))}
              empty="No outbound clicks yet."
            />
          </div>
        </Panel>
      </div>

      <Panel title={`${total.toLocaleString()} events`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">Action</th>
                <th className="px-5 py-3 font-semibold">Label</th>
                <th className="px-5 py-3 font-semibold">Page</th>
                <th className="px-5 py-3 font-semibold">Country</th>
                <th className="px-5 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={5} message="No events in this range." />}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                  <td className="px-5 py-3">
                    <Badge tone={r.name.startsWith("download") ? "ok" : "muted"}>{r.name}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs">{labelFor(r.label)}</td>
                  <td className="max-w-[240px] truncate px-5 py-3 font-mono text-xs text-muted">{r.path ?? "—"}</td>
                  <td className="px-5 py-3 text-xs">{r.country ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{format(r.createdAt, "d MMM, HH:mm")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} perPage={PER_PAGE} makeHref={(p) => href({ page: p })} />
      </Panel>
    </div>
  );
}
