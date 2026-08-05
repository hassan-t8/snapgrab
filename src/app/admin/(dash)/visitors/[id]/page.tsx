import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Clock, Download, Eye, Globe, MapPin, Monitor, MousePointerClick } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, Panel, StatCard } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function VisitorDetail({ params }: PageProps<"/admin/visitors/[id]">) {
  const { id } = await params;

  const visitor = await prisma.visitor
    .findUnique({
      where: { id },
      include: {
        pageViews: { orderBy: { createdAt: "desc" }, take: 200 },
        downloads: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    })
    .catch(() => null);

  if (!visitor) notFound();

  const facts = [
    { icon: Globe, label: "IP address", value: visitor.ip },
    { icon: MapPin, label: "Location", value: [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") || "Unknown" },
    { icon: Monitor, label: "Device", value: `${visitor.device ?? "desktop"} · ${visitor.browser ?? "?"} on ${visitor.os ?? "?"}` },
    { icon: MousePointerClick, label: "Landed on", value: visitor.landingPath ?? "—" },
    { icon: Clock, label: "First seen", value: format(visitor.firstSeen, "d MMM yyyy, HH:mm") },
    { icon: Clock, label: "Last seen", value: `${format(visitor.lastSeen, "d MMM yyyy, HH:mm")} (${formatDistanceToNow(visitor.lastSeen, { addSuffix: true })})` },
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/visitors" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-400">
        <ArrowLeft className="h-4 w-4" /> All visitors
      </Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total visits" value={visitor.visits} icon={<Eye />} />
        <StatCard label="Page views" value={visitor.pageViews.length} icon={<MousePointerClick />} tone="accent" delay={0.05} />
        <StatCard label="Downloads" value={visitor.downloads.length} icon={<Download />} tone="amber" delay={0.1} />
      </div>

      <Panel title="Visitor profile">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
                <f.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{f.label}</p>
                <p className="mt-0.5 break-words text-sm font-medium">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--line)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">User agent</p>
          <p className="mt-1 break-all font-mono text-xs text-muted">{visitor.userAgent}</p>
          {visitor.referrer && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Referrer</p>
              <p className="mt-1 break-all font-mono text-xs text-muted">{visitor.referrer}</p>
            </>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Footsteps — ${visitor.pageViews.length} page views`}>
          <div className="max-h-[520px] overflow-y-auto p-5">
            {visitor.pageViews.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No page views recorded.</p>
            ) : (
              <ol className="relative space-y-4 pl-6">
                <span className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-brand-500 via-accent-500 to-transparent" />
                {visitor.pageViews.map((pv) => (
                  <li key={pv.id} className="relative">
                    <span className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 ring-4 ring-[var(--card)]" />
                    <p className="text-sm font-semibold">{pv.path}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {format(pv.createdAt, "d MMM yyyy, HH:mm:ss")}
                      {pv.referrer ? ` · from ${new URL(pv.referrer).hostname}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Panel>

        <Panel title={`Downloads — ${visitor.downloads.length}`}>
          <div className="max-h-[520px] overflow-y-auto">
            {visitor.downloads.length === 0 ? (
              <p className="py-14 text-center text-sm text-muted">This visitor has not downloaded anything.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {visitor.downloads.map((d) => (
                    <tr key={d.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold capitalize">{d.platform}</span>
                          <Badge tone={d.status === "failed" ? "bad" : d.status === "downloaded" ? "ok" : "muted"}>
                            {d.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">{d.title ?? d.sourceUrl}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {[d.quality, d.ext?.toUpperCase()].filter(Boolean).join(" · ")}
                          {d.quality || d.ext ? " · " : ""}
                          {format(d.createdAt, "d MMM, HH:mm")}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
