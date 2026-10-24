import { CheckCircle2, EyeOff, Layers, Power } from "lucide-react";
import { Panel, StatCard } from "@/components/admin/ui";
import ServiceManager, { type ServiceRow } from "@/components/admin/ServiceManager";
import { getServiceCounts, getServiceStates } from "@/lib/services";
import { TOOLS, toolCostTier } from "@/lib/tools";
import QuotaManager, { type QuotaCard } from "@/components/admin/QuotaManager";
import { getQuotaStates } from "@/lib/quota";
import { QUOTA_PROVIDERS, type ProviderId } from "@/lib/quota-providers";
import { PLATFORMS } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const [states, counts, toolUsage, downloads, quotas] = await Promise.all([
    getServiceStates(),
    getServiceCounts(),
    prisma.toolUsage.groupBy({ by: ["tool"], _count: { _all: true } }).catch(() => []),
    prisma.download.groupBy({ by: ["platform"], _count: { _all: true } }).catch(() => []),
    getQuotaStates(),
  ]);

  const downloaderPaused = !quotas["rapidapi-downloader"].available;

  const toolUses = Object.fromEntries(toolUsage.map((t) => [t.tool, t._count._all]));
  const platformUses = Object.fromEntries(downloads.map((d) => [d.platform, d._count._all]));

  const rows: ServiceRow[] = [
    ...TOOLS.map((t) => ({
      kind: "tool" as const,
      key: t.slug,
      name: t.name,
      group: `${t.category} tools`,
      href: `/tools/${t.slug}`,
      color: t.color,
      tagline: t.tagline,
      uses: toolUses[t.slug] ?? 0,
      enabled: states[`tool:${t.slug}`]?.enabled ?? true,
      note: states[`tool:${t.slug}`]?.note ?? "",
      tier: toolCostTier(t),
      paused: t.provider ? !quotas[t.provider].available : false,
    })),
    ...PLATFORMS.map((p) => ({
      kind: "platform" as const,
      key: p.id,
      name: p.name,
      group: "Downloaders",
      href: `/download/${p.slug}`,
      color: p.color,
      tagline: p.blurb,
      uses: platformUses[p.id] ?? 0,
      enabled: states[`platform:${p.id}`]?.enabled ?? true,
      note: states[`platform:${p.id}`]?.note ?? "",
      tier: "paid" as const,
      paused: downloaderPaused,
    })),
  ];

  const quotaCards: QuotaCard[] = (Object.keys(QUOTA_PROVIDERS) as ProviderId[]).map((id) => {
    const q = quotas[id];
    const meta = QUOTA_PROVIDERS[id];
    return {
      id,
      label: q.label,
      tier: q.tier,
      purpose: meta.purpose,
      note: meta.note,
      dashboardUrl: meta.dashboardUrl,
      keyEnv: "integration" in meta ? "Integrations → RapidAPI" : null,
      configured: q.configured,
      limit: q.limit,
      used: q.used,
      remaining: q.remaining,
      period: q.period,
      resetsAt: q.resetsAt.toISOString(),
      exhausted: q.exhausted,
      forceEnabled: q.forceEnabled,
      available: q.available,
      lastError: q.lastError,
      lastCallAt: q.lastCallAt?.toISOString() ?? null,
      tools: [
        ...TOOLS.filter((t) => t.provider === id).map((t) => t.name),
        ...(id === "rapidapi-downloader" ? [`${PLATFORMS.length} platform downloaders`] : []),
      ],
    };
  });

  const totalDisabled = counts.disabledTools + counts.disabledPlatforms;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Services live"
          value={`${counts.enabledTools + counts.enabledPlatforms} / ${counts.totalTools + counts.totalPlatforms}`}
          icon={<CheckCircle2 />}
          tone="accent"
          sub="Visible to visitors right now"
        />
        <StatCard
          label="Currently hidden"
          value={totalDisabled}
          icon={<EyeOff />}
          tone={totalDisabled ? "red" : "brand"}
          sub={totalDisabled ? "Removed from nav, pages and sitemap" : "Everything is switched on"}
          delay={0.05}
        />
        <StatCard
          label="Tools"
          value={`${counts.enabledTools} / ${counts.totalTools}`}
          icon={<Layers />}
          sub={`${counts.disabledTools} hidden`}
          delay={0.1}
        />
        <StatCard
          label="Downloaders"
          value={`${counts.enabledPlatforms} / ${counts.totalPlatforms}`}
          icon={<Power />}
          tone="amber"
          sub={`${counts.disabledPlatforms} hidden`}
          delay={0.15}
        />
      </div>

      <Panel title="What switching a service off does">
        <ul className="grid gap-3 p-5 text-sm text-muted sm:grid-cols-2">
          {[
            "Removed from the navbar, footer, home page and the tools index",
            "Its page stops rendering the tool and returns a noindex notice instead",
            "Dropped from sitemap.xml so search engines stop crawling it",
            "The API refuses requests for it, so a saved link cannot bypass the switch",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
              {line}
            </li>
          ))}
        </ul>
      </Panel>

      <QuotaManager quotas={quotaCards} />

      <ServiceManager rows={rows} />
    </div>
  );
}
