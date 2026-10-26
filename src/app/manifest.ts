import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_SITE_NAME ?? "SnapGrab";
  return {
    id: "/",
    name: `${name} — Free Online Tools`,
    short_name: name,
    description:
      "Free tools for photos, PDFs, printing, money, study and daily life — passport photos, ID card printing, Urdu keyboard, prayer times and more. Works offline once opened.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07060f",
    theme_color: "#7048f0",
    lang: "en",
    categories: ["utilities", "productivity", "education", "photo"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "All tools", url: "/tools", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Passport photo", url: "/tools/passport-photo-maker" },
      { name: "Prayer times", url: "/tools/prayer-times" },
      { name: "Currency converter", url: "/tools/currency-converter" },
    ],
  };
}
