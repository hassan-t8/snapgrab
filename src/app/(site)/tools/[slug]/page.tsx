import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, ShieldCheck } from "lucide-react";
import ImageStudio from "@/components/tools/ImageStudio";
import Downloader from "@/components/Downloader";
import AdSlot from "@/components/AdSlot";
import { Aurora, FAQ, SectionHead } from "@/components/sections";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";
import { TOOLS, TOOL_MAP, relatedTools } from "@/lib/tools";
import { breadcrumbJsonLd, faqJsonLd, howToJsonLd, jsonLd, ogImage, softwareAppJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOL_MAP[slug];
  if (!tool) return { title: "Tool not found", robots: { index: false, follow: false } };

  const image = ogImage({ title: tool.name, subtitle: tool.tagline, badge: `${tool.category} tool` });

  return {
    title: tool.headline,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      type: "website",
      title: tool.headline,
      description: tool.description,
      url: `/tools/${tool.slug}`,
      images: [{ url: image, width: 1200, height: 630, alt: tool.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: tool.headline,
      description: tool.tagline,
      images: [image],
    },
  };
}

export default async function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const tool = TOOL_MAP[slug];
  if (!tool) notFound();

  const related = relatedTools(tool);

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <Aurora />

        <nav aria-label="Breadcrumb" className="mx-auto mb-8 max-w-4xl">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
            <li>
              <Link href="/" className="hover:text-brand-400">
                Home
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" />
            <li>
              <Link href="/tools" className="hover:text-brand-400">
                Tools
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" />
            <li aria-current="page" className="font-semibold text-[var(--fg)]">
              {tool.name}
            </li>
          </ol>
        </nav>

        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ background: `${tool.color}1f`, color: tool.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: tool.color }} />
              {tool.category} tool · free
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">{tool.headline}</h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-lg">{tool.description}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {tool.inputs.slice(0, 6).map((f) => (
                <span key={f} className="rounded-lg surface px-3 py-1.5 text-xs font-semibold">
                  {f}
                </span>
              ))}
              <ArrowRight className="h-4 w-4 text-muted" />
              {tool.outputs.map((f) => (
                <span
                  key={f}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                  style={{ background: tool.color }}
                >
                  {f}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          {tool.engine === "image" ? (
            <ImageStudio tool={tool} />
          ) : (
            <Downloader
              only={tool.engine === "link-audio" ? "audio" : undefined}
              placeholder={
                tool.engine === "link-audio"
                  ? "Paste a video or track link — we extract the audio"
                  : "Paste any video link — we detect the platform automatically"
              }
              cta={tool.engine === "link-audio" ? "Get audio" : "Download"}
            />
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Step by step" title={`How to use the ${tool.name.toLowerCase()}`} />
          <StaggerGroup className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {tool.steps.map((s, i) => (
              <StaggerItem key={s.title}>
                <div className="h-full rounded-2xl surface p-6">
                  <span className="text-4xl font-black leading-none text-brand-500/25">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {tool.engine === "image" && (
        <section className="px-4 pb-6 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-4xl">
            <div className="flex items-start gap-3 rounded-2xl border border-accent-500/30 bg-accent-500/5 p-6">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
              <p className="text-sm leading-relaxed text-muted">
                <strong className="text-[var(--fg)]">Your files stay on your device.</strong> This tool uses the browser&apos;s
                own Canvas API, so images are decoded, processed and re-encoded locally. Nothing is uploaded, nothing is
                stored, and it keeps working even if your connection drops mid-batch.
              </p>
            </div>
          </Reveal>
        </section>
      )}

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Questions" title={`${tool.name} FAQ`} />
          <div className="mt-10">
            <FAQ items={tool.faqs} />
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <SectionHead eyebrow="More tools" title="You might also need" center={false} />
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/tools/${r.slug}`}
                  className="group flex items-center gap-3 rounded-2xl surface p-4 transition-all hover:-translate-y-1 hover:border-brand-400/40"
                >
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.tagline}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-400" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          softwareAppJsonLd({
            name: tool.name,
            description: tool.description,
            url: `/tools/${tool.slug}`,
            category: tool.category === "Image" ? "DesignApplication" : "MultimediaApplication",
          }),
          howToJsonLd(`How to use the ${tool.name}`, tool.steps),
          faqJsonLd(tool.faqs),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: tool.name, path: `/tools/${tool.slug}` },
          ]),
        )}
      />
    </>
  );
}
