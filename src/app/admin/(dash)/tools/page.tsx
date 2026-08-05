import { format } from "date-fns";
import { FileImage, HardDrive, Layers, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import Pagination from "@/components/admin/Pagination";
import { TOOL_MAP } from "@/lib/tools";
import { daysAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;

function bytes(n?: number | null) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export default async function AdminTools({ searchParams }: PageProps<"/admin/tools">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const d30 = daysAgo(30);

  const [rows, total, runs30, byTool, totals] = await Promise.all([
    prisma.toolUsage.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.toolUsage.count(),
    prisma.toolUsage.count({ where: { createdAt: { gte: d30 } } }),
    prisma.toolUsage.groupBy({
      by: ["tool"],
      _count: { _all: true },
      _sum: { files: true, bytesIn: true, bytesOut: true },
      orderBy: { _count: { tool: "desc" } },
    }),
    prisma.toolUsage.aggregate({ _sum: { files: true, bytesIn: true, bytesOut: true } }),
  ]);

  const filesTotal = totals._sum.files ?? 0;
  const inTotal = totals._sum.bytesIn ?? 0;
  const outTotal = totals._sum.bytesOut ?? 0;
  const saved = inTotal > 0 ? Math.round(((inTotal - outTotal) / inTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tool runs (all time)" value={total.toLocaleString()} icon={<Wrench />} sub={`${runs30} in the last 30 days`} />
        <StatCard label="Files processed" value={filesTotal.toLocaleString()} icon={<Layers />} tone="accent" sub="Across every tool" delay={0.05} />
        <StatCard label="Bytes in / out" value={`${bytes(inTotal)} → ${bytes(outTotal)}`} icon={<HardDrive />} tone="amber" sub="Reported by the browser" delay={0.1} />
        <StatCard label="Average saving" value={`${saved}%`} icon={<FileImage />} tone={saved > 0 ? "accent" : "brand"} sub="Size reduction on processed files" delay={0.15} />
      </div>

      <Panel title="Usage by tool">
        <div className="space-y-3 p-5">
          {byTool.length === 0 && <p className="py-8 text-center text-sm text-muted">No tool runs recorded yet.</p>}
          {byTool.map((t) => {
            const max = Math.max(...byTool.map((x) => x._count._all));
            return (
              <div key={t.tool}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{TOOL_MAP[t.tool]?.name ?? t.tool}</span>
                  <span className="text-xs text-muted">
                    {t._count._all.toLocaleString()} runs · {(t._sum.files ?? 0).toLocaleString()} files ·{" "}
                    {bytes(t._sum.bytesIn)} → {bytes(t._sum.bytesOut)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                    style={{ width: `${Math.max(4, (t._count._all / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title={`${total.toLocaleString()} recorded runs`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">Tool</th>
                <th className="px-5 py-3 font-semibold">Conversion</th>
                <th className="px-5 py-3 font-semibold">Files</th>
                <th className="px-5 py-3 font-semibold">Size</th>
                <th className="px-5 py-3 font-semibold">IP / country</th>
                <th className="px-5 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={6} message="Nothing yet — run a conversion on the live site." />}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                  <td className="px-5 py-3 font-semibold">{TOOL_MAP[r.tool]?.name ?? r.tool}</td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {(r.inputType ?? "?").replace("image/", "")} → {(r.outputType ?? "?").replace("image/", "")}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <Badge>{r.files}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                    {bytes(r.bytesIn)} → {bytes(r.bytesOut)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs">
                    <span className="font-mono">{r.ip ?? "—"}</span>
                    {r.country && <span className="mt-0.5 block text-muted">{r.country}</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{format(r.createdAt, "d MMM, HH:mm")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} perPage={PER_PAGE} makeHref={(p) => `/admin/tools?page=${p}`} />
      </Panel>
    </div>
  );
}
