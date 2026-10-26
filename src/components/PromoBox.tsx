import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";

/**
 * Sponsored / affiliate recommendations (Admin → Sponsored & affiliate) for a tool category.
 * Clearly labelled, and links are rel="sponsored nofollow" as Google requires for paid links.
 */
export default async function PromoBox({ category }: { category: string }) {
  const promos = await prisma.promo.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []);
  const matching = promos
    .filter((p) => !p.categories || p.categories.split(",").includes(category))
    .slice(0, 2);
  if (!matching.length) return null;

  return (
    <section className="px-4 pb-10 sm:px-6 lg:px-8" aria-label="Sponsored">
      <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2">
        {matching.map((p) => (
          <a
            key={p.id}
            href={`/go/${p.id}`}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="group flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 transition-colors hover:border-amber-400/50"
          >
            <span className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Sponsored</span>
              <span className="mt-0.5 block font-bold">{p.title}</span>
              {p.body && <span className="mt-0.5 block text-sm text-muted">{p.body}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-300">
              {p.cta} <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
