import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PLATFORMS } from "@/lib/platforms";
import { TOOLS } from "@/lib/tools";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.blogPost
    .findMany({ where: { published: true }, select: { slug: true, updatedAt: true } })
    .catch(() => []);

  const staticPages = ["", "/tools", "/about", "/contact", "/blog", "/faq", "/privacy", "/terms", "/dmca"].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    changeFrequency: (p === "" ? "daily" : "monthly") as "daily" | "monthly",
    priority: p === "" ? 1 : 0.6,
  }));

  return [
    ...staticPages,
    ...TOOLS.map((t) => ({
      url: `${SITE}/tools/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...PLATFORMS.map((p) => ({
      url: `${SITE}/download/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
