import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Music, ShieldCheck, Video, Wrench, Zap } from "lucide-react";
import { Aurora, FAQ, SectionHead } from "@/components/sections";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";
import AdSlot from "@/components/AdSlot";
import { TOOLS, TOOL_CATEGORIES, toolsByCategory } from "@/lib/tools";
import { siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free Online Tools — converters, compressors and downloaders",
  description:
    "A growing set of free browser tools: image converter, compressor and resizer, PNG to JPG, WEBP converter, video to MP3 and the all-in-one video downloader. No signup, no upload.",
  keywords: [
    "free online tools",
    "image converter",
    "image compressor",
    "png to jpg",
    "webp converter",
    "video to mp3",
    "online file converter",
  ],
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free Online Tools — SnapGrab",
    description: "Image converter, compressor, resizer, video to MP3 and more. Everything runs in your browser.",
    url: "/tools",
  },
};

const CATEGORY_ICON = { Image: ImageIcon, Audio: Music, Video } as const;

const TOOLS_FAQ = [
  {
    q: "Are these tools really free?",
    a: "Yes — every tool on this page is free with no account, no watermark and no daily cap. The site is funded by the ad slots you can see, nothing else.",
  },
  {
    q: "Do you upload my files?",
    a: "The image tools never upload anything. Conversion, compression and resizing all happen inside your browser using the Canvas API, so the file stays on your device. The link-based tools only send the URL you paste, never a file.",
  },
  {
    q: "Which image formats are supported?",
    a: "Anything your browser can decode goes in — JPG, PNG, WEBP, GIF, BMP, AVIF and often HEIC. Output is JPG, PNG or WEBP, which covers everything the modern web and common software need.",
  },
  {
    q: "Can I convert many files at once?",
    a: "Yes. Every image tool takes a batch — drop in as many files as you like, apply one set of settings, and save them individually or all at once.",
  },
  {
    q: "Is there a file size limit?",
    a: "No server limit, because nothing is uploaded. Your device's memory is the only ceiling.",
  },
  {
    q: "Will you add more tools?",
    a: "Yes. PDF handling and local audio/video conversion are the two most requested, and both are on the roadmap. Tell us through the contact form what you need most.",
  },
];

export default function ToolsIndex() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-300">
              <Wrench className="h-3.5 w-3.5" /> {TOOLS.length} free tools
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Every tool you need, <span className="gradient-text">none of the nonsense</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 text-[15px] leading-relaxed text-muted sm:text-lg">
              Convert, compress and resize images without uploading them anywhere. Pull audio out of any video link.
              Download from fourteen platforms. All free, all in the browser.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-accent-400" /> Files never leave your device
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-accent-400" /> No upload wait
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4 text-accent-400" /> Batch supported
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      {TOOL_CATEGORIES.map((cat, ci) => {
        const Icon = CATEGORY_ICON[cat];
        const tools = toolsByCategory(cat);
        if (!tools.length) return null;
        return (
          <section key={cat} className="px-4 py-14 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Reveal>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">{cat} tools</h2>
                    <p className="text-sm text-muted">
                      {tools.length} tool{tools.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </Reveal>

              <StaggerGroup className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((t) => (
                  <StaggerItem key={t.slug}>
                    <Link href={`/tools/${t.slug}`} className="group block h-full">
                      <article className="relative h-full overflow-hidden rounded-2xl surface p-6 transition-all hover:-translate-y-1.5 hover:border-brand-400/40">
                        <div
                          className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
                          style={{ background: t.color }}
                        />
                        <span
                          className="grid h-11 w-11 place-items-center rounded-xl text-white"
                          style={{ background: t.color, boxShadow: `0 8px 24px -8px ${t.color}` }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <h3 className="mt-4 font-bold">{t.name}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.tagline}</p>
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {t.outputs.map((o) => (
                            <span
                              key={o}
                              className="rounded-md bg-[var(--bg-soft)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted"
                            >
                              {o}
                            </span>
                          ))}
                        </div>
                        <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
                          Open tool <ArrowRight className="h-4 w-4" />
                        </span>
                      </article>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGroup>

              {ci === 0 && (
                <div className="mt-12">
                  <AdSlot className="h-[90px]" />
                </div>
              )}
            </div>
          </section>
        );
      })}

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Questions" title="About the tools" />
          <div className="mt-10">
            <FAQ items={TOOLS_FAQ} />
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Free Online Tools",
            url: `${siteUrl()}/tools`,
            description:
              "Free browser-based image converter, compressor, resizer and media downloaders. Nothing is uploaded.",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: TOOLS.map((t, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: t.name,
                url: `${siteUrl()}/tools/${t.slug}`,
              })),
            },
          }),
        }}
      />
    </>
  );
}
