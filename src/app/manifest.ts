import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab";
  return {
    name: `${name} — Video Downloader & Converter`,
    short_name: name,
    description:
      "Download video from 14 platforms and convert, compress or resize images — free, in your browser, no signup.",
    start_url: "/",
    display: "standalone",
    background_color: "#07060f",
    theme_color: "#7048f0",
    categories: ["utilities", "productivity", "multimedia"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
