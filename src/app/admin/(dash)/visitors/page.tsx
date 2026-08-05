import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Globe, Monitor, Smartphone, Tablet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import Pagination from "@/components/admin/Pagination";
import { Users, Eye, Download as DownloadIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;

function DeviceIcon({ device }: { device: string | null }) {
  const Icon = device === "mobile" ? Smartphone : device === "tablet" ? Tablet : Monitor;
  return <Icon className="h-3.5 w-3.5" />;
}

export default async function AdminVisitors({ searchParams }: PageProps<"/admin/visitors">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = q ? { OR: [{ ip: { contains: q } }, { country: { contains: q } }, { city: { contains: q } }] } : {};

  const [rows, total, totals] = await Promise.all([
    prisma.visitor.findMany({
      where,
      orderBy: { lastSeen: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { downloads: true, pageViews: true } } },
    }),
    prisma.visitor.count({ where }),
    Promise.all([prisma.visitor.count(), prisma.pageView.count(), prisma.download.count()]),
  ]);

  const [allVisitors, allViews, allDownloads] = totals;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unique visitors" value={allVisitors.toLocaleString()} icon={<Users />} />
        <StatCard label="Page views" value={allViews.toLocaleString()} icon={<Eye />} tone="accent" delay={0.05} />
        <StatCard label="Download events" value={allDownloads.toLocaleString()} icon={<DownloadIcon />} tone="amber" delay={0.1} />
      </div>

      <Panel
        title={`${total.toLocaleString()} visitors`}
        action={
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search IP, country, city"
              className="w-52 rounded-lg surface px-3 py-1.5 text-xs outline-none focus:border-brand-400"
            />
            <button className="rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-1.5 text-xs font-bold text-white">
              Search
            </button>
          </form>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">IP address</th>
                <th className="px-5 py-3 font-semibold">Location</th>
                <th className="px-5 py-3 font-semibold">Device / browser</th>
                <th className="px-5 py-3 font-semibold">Activity</th>
                <th className="px-5 py-3 font-semibold">First seen</th>
                <th className="px-5 py-3 font-semibold">Last seen</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={7} message="No visitors recorded yet." />}
              {rows.map((v) => (
                <tr key={v.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs font-semibold">{v.ip}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted">{v.anonId.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted" />
                      {v.country ?? "Unknown"}
                    </span>
                    {v.city && <span className="mt-0.5 block text-muted">{v.city}</span>}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span className="flex items-center gap-1.5 capitalize">
                      <DeviceIcon device={v.device} />
                      {v.device ?? "desktop"}
                    </span>
                    <span className="mt-0.5 block text-muted">
                      {v.browser ?? "?"} · {v.os ?? "?"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{v.visits} visits</Badge>
                      <Badge tone="muted">{v._count.pageViews} views</Badge>
                      <Badge tone={v._count.downloads ? "ok" : "muted"}>{v._count.downloads} downloads</Badge>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{format(v.firstSeen, "d MMM yy")}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                    {formatDistanceToNow(v.lastSeen, { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/visitors/${v.id}`}
                      className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-brand-400 hover:underline"
                    >
                      Footsteps <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          total={total}
          perPage={PER_PAGE}
          makeHref={(p) => `/admin/visitors?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
        />
      </Panel>
    </div>
  );
}
