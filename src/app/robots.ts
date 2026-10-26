import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /api/og is the social preview renderer — crawlers must be able to fetch it
        allow: ["/", "/api/og"],
        // /go/ = sponsored redirects; /m$ = QR menus (data lives in the link; "$" so /manifest… stays crawlable)
        disallow: ["/admin", "/api/", "/go/", "/m$"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
