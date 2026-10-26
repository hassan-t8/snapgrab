import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import RatesManager from "@/components/admin/RatesManager";
import { RATE_DEFS, RATE_KEYS, RATE_PAGES, rateDay } from "@/lib/rates";

export const dynamic = "force-dynamic";

export default async function AdminRates() {
  const recent = await prisma.rateEntry.findMany({ orderBy: [{ date: "desc" }, { key: "asc" }], take: 60 }).catch(() => []);
  const latest = new Map<string, number>();
  for (const r of recent) if (!latest.has(r.key)) latest.set(r.key, r.value);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {Object.values(RATE_PAGES).map((p) => (
          <Link key={p.slug} href={`/rates/${p.slug}`} target="_blank" className="flex items-center gap-1.5 rounded-xl surface px-4 py-2 text-sm font-bold hover:border-brand-400/60">
            {p.h1.replace(" in Pakistan today", "")} page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
      <RatesManager
        today={rateDay().toISOString().slice(0, 10)}
        defs={RATE_KEYS.map((k) => ({ key: k, label: RATE_DEFS[k].label, unit: RATE_DEFS[k].unit, latest: latest.get(k) ?? null }))}
        recent={recent.map((r) => ({
          id: r.id,
          key: r.key,
          label: RATE_DEFS[r.key as keyof typeof RATE_DEFS]?.label ?? r.key,
          value: r.value,
          date: r.date.toISOString().slice(0, 10),
        }))}
      />
      <p className="text-xs text-muted">The dollar interbank rate updates by itself; open-market dollar, gold, silver, petrol, diesel and LPG come from here.</p>
    </div>
  );
}
