import { prisma } from "@/lib/prisma";
import PromoManager from "@/components/admin/PromoManager";
import { TOOL_CATEGORIES } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function AdminPromos() {
  const promos = await prisma.promo.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []);
  return (
    <PromoManager
      categories={[...TOOL_CATEGORIES]}
      promos={promos.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body ?? "",
        url: p.url,
        cta: p.cta,
        categories: p.categories ? p.categories.split(",") : [],
        active: p.active,
        clicks: p.clicks,
      }))}
    />
  );
}
