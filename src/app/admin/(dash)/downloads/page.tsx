import Link from "next/link";
import { format } from "date-fns";
import { Download, Filter, Globe } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel } from "@/components/admin/ui";
import { PLATFORMS } from "@/lib/platforms";
import Pagination from "@/components/admin/Pagination";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;

export default async function AdminDownloads({ searchParams }: PageProps<"/admin/downloads">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const platform = typeof sp.platform === "string" ? sp.platform : "";
  const status = typeof sp.status === "string" ? sp.status : "";

  const where = {
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.download.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.download.count({ where }),
  ]);

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(platform ? { platform } : {}), ...(status ? { status } : {}), ...over });
    return `/admin/downloads?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <Panel
        title={`${total.toLocaleString()} download events`}
        action={
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Filter className="h-3.5 w-3.5" /> Filters
          </span>
        }
      >
        <div className="flex flex-wrap gap-2 border-b border-[var(--line)] p-4">
          <FilterPill href={qs({ platform: "", page: "1" })} active={!platform} label="All platforms" />
          {PLATFORMS.map((p) => (
            <FilterPill
              key={p.id}
              href={qs({ platform: p.id, page: "1" })}
              active={platform === p.id}
              label={p.name}
              color={p.color}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--line)] p-4">
          <FilterPill href={qs({ status: "", page: "1" })} active={!status} label="Any status" />
          {["resolved", "downloaded", "failed"].map((s) => (
            <FilterPill key={s} href={qs({ status: s, page: "1" })} active={status === s} label={s} />
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">Platform</th>
                <th className="px-5 py-3 font-semibold">Content</th>
                <th className="px-5 py-3 font-semibold">Format</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">IP / country</th>
                <th className="px-5 py-3 font-semibold">Visitor</th>
                <th className="px-5 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={7} message="No download events match these filters." />}
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-[var(--line)] last:border-0 align-top hover:bg-brand-500/5">
                  <td className="px-5 py-3 font-semibold capitalize">{d.platform}</td>
                  <td className="max-w-[280px] px-5 py-3">
                    <p className="truncate font-medium">{d.title ?? "—"}</p>
                    <a
                      href={d.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate text-xs text-muted hover:text-brand-400"
                    >
                      {d.sourceUrl}
                    </a>
                    {d.errorMsg && <p className="mt-1 text-xs text-red-400">{d.errorMsg}</p>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                    {d.quality ? `${d.quality} · ` : ""}
                    {d.ext?.toUpperCase() ?? "—"}
                    {d.sizeBytes ? ` · ${(d.sizeBytes / 1048576).toFixed(1)} MB` : ""}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={d.status === "failed" ? "bad" : d.status === "downloaded" ? "ok" : "muted"}>
                      {d.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs">
                    <span className="font-mono">{d.ip ?? "—"}</span>
                    {d.country && (
                      <span className="mt-0.5 flex items-center gap-1 text-muted">
                        <Globe className="h-3 w-3" /> {d.country}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {d.visitorId ? (
                      <Link href={`/admin/visitors/${d.visitorId}`} className="font-mono text-brand-400 hover:underline">
                        {d.visitorId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                    {format(d.createdAt, "d MMM, HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} perPage={PER_PAGE} makeHref={(p) => qs({ page: String(p) })} />
      </Panel>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Download className="h-3.5 w-3.5" />
        Every resolve and every file transfer is logged here, including the exact source link and the format chosen.
      </p>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
        active ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {color && !active && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} />
      )}
      {label}
    </Link>
  );
}
