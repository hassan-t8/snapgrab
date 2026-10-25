import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, ShieldCheck } from "lucide-react";
import ImageStudio from "@/components/tools/ImageStudio";
import PdfStudio from "@/components/tools/PdfStudio";
import TextStudio from "@/components/tools/TextStudio";
import GeneratorStudio from "@/components/tools/GeneratorStudio";
import CalculatorStudio from "@/components/tools/CalculatorStudio";
import PassportPhotoStudio from "@/components/tools/PassportPhotoStudio";
import PdfPagesStudio from "@/components/tools/PdfPagesStudio";
import InvoiceStudio from "@/components/tools/InvoiceStudio";
import CvStudio from "@/components/tools/CvStudio";
import IdCardPrintStudio from "@/components/tools/IdCardPrintStudio";
import PhotoPrintStudio from "@/components/tools/PhotoPrintStudio";
import OcrStudio from "@/components/tools/OcrStudio";
import BgRemoveStudio from "@/components/tools/BgRemoveStudio";
import SignatureStudio from "@/components/tools/SignatureStudio";
import CropStudio from "@/components/tools/CropStudio";
import UtilityStudio from "@/components/tools/UtilityStudio";
import Downloader from "@/components/Downloader";
import AdSlot from "@/components/AdSlot";
import { Aurora, FAQ, SectionHead } from "@/components/sections";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";
import { TOOLS, TOOL_CATEGORIES, TOOL_MAP, relatedTools } from "@/lib/tools";
import { ToolIcon } from "@/lib/tool-icons";
import { ToolSearchBox } from "@/components/ToolSearch";
import ShareSheet from "@/components/ShareSheet";
import { siteUrl, breadcrumbJsonLd, faqJsonLd, howToJsonLd, jsonLd, ogImage, softwareAppJsonLd } from "@/lib/seo";
import { getEnabledTools, getServiceState } from "@/lib/services";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import QuotaPaused from "@/components/QuotaPaused";
import { getQuotaState } from "@/lib/quota";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOL_MAP[slug];
  if (!tool) return { title: "Tool not found", robots: { index: false, follow: false } };

  // a disabled tool must not stay in the index
  if (!(await getServiceState("tool", tool.slug)).enabled) {
    return { title: `${tool.name} — temporarily unavailable`, robots: { index: false, follow: true } };
  }

  const image = ogImage({ title: tool.name, subtitle: tool.tagline, badge: `${tool.category} tool` });

  return {
    title: tool.title ?? tool.headline,
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

  const state = await getServiceState("tool", tool.slug);
  if (!state.enabled) {
    const live = (await getEnabledTools()).filter((t) => t.category === tool.category || tool.related.includes(t.slug));
    return (
      <ServiceUnavailable
        name={tool.name}
        note={state.note}
        alternatives={live.slice(0, 4).map((t) => ({
          href: `/tools/${t.slug}`,
          label: t.name,
          sub: t.tagline,
          color: t.color,
        }))}
      />
    );
  }

  const enabledTools = await getEnabledTools();
  const enabledSlugs = new Set(enabledTools.map((t) => t.slug));
  // hand-picked related tools first, topped up from the same category so there are always a few
  const related = [
    ...relatedTools(tool).filter((r) => enabledSlugs.has(r.slug)),
    ...enabledTools.filter((t) => t.category === tool.category && t.slug !== tool.slug && !tool.related.includes(t.slug)),
  ].slice(0, 8);
  const others = TOOL_CATEGORIES.map((c) => ({
    category: c,
    tools: enabledTools.filter((t) => t.category === c && t.slug !== tool.slug && !related.some((r) => r.slug === t.slug)),
  })).filter((g) => g.tools.length);

  // the API behind this tool has used its allowance: keep the page, pause the tool
  const quota = tool.provider ? await getQuotaState(tool.provider) : null;
  const paused = quota && !quota.available ? quota : null;

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
              className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl text-white"
              style={{ background: tool.color, boxShadow: `0 14px 36px -12px ${tool.color}` }}
              aria-hidden
            >
              <ToolIcon tool={tool} className="h-8 w-8" />
            </span>
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
          <Reveal delay={0.24}>
            <div className="mt-5 flex justify-center">
              <ShareSheet title={tool.title ?? tool.headline} text={`${tool.name} — ${tool.tagline}. Free on SnapGrab`} url={`${siteUrl()}/tools/${tool.slug}`} label="Share this tool" />
            </div>
          </Reveal>
        </div>

        <div id="tool-app" className="mx-auto mt-10 max-w-3xl scroll-mt-24">
          {paused ? (
            <QuotaPaused
              name={tool.name}
              resetsAt={paused.resetsAt}
              alternatives={enabledTools
                .filter((t) => t.slug !== tool.slug && !t.provider)
                .filter((t) => tool.related.includes(t.slug) || t.category === tool.category)
                .slice(0, 4)
                .map((t) => ({ href: `/tools/${t.slug}`, label: t.name, sub: t.tagline, color: t.color }))}
            />
          ) : tool.engine === "image" ? (
            <ImageStudio tool={tool} />
          ) : tool.engine === "photo" ? (
            <PassportPhotoStudio tool={tool} />
          ) : tool.engine === "print" ? (
            tool.mode === "id-card-print" ? <IdCardPrintStudio tool={tool} /> : <PhotoPrintStudio tool={tool} />
          ) : tool.engine === "image-ai" ? (
            tool.mode === "ocr" ? (
              <OcrStudio tool={tool} />
            ) : tool.mode === "remove-bg" ? (
              <BgRemoveStudio tool={tool} />
            ) : tool.mode === "signature" ? (
              <SignatureStudio tool={tool} />
            ) : (
              <CropStudio tool={tool} />
            )
          ) : tool.engine === "utility" ? (
            <UtilityStudio tool={tool} />
          ) : tool.engine === "pdf-pages" ? (
            <PdfPagesStudio tool={tool} />
          ) : tool.engine === "doc" ? (
            tool.mode === "cv" ? <CvStudio tool={tool} /> : <InvoiceStudio tool={tool} />
          ) : tool.engine === "pdf" ? (
            <PdfStudio tool={tool} />
          ) : tool.engine === "text" ? (
            <TextStudio tool={tool} />
          ) : tool.engine === "generate" ? (
            <GeneratorStudio tool={tool} />
          ) : tool.engine === "calc" ? (
            <CalculatorStudio tool={tool} />
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
          <StaggerGroup className={`mt-12 grid gap-5 md:grid-cols-2 ${tool.steps.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
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

      {/* voice typing goes through the browser's speech service, so it is not "nothing leaves your device" */}
      {!tool.provider && !tool.engine.startsWith("link-") && tool.mode !== "voice-typing" && (
        <section className="px-4 pb-6 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-4xl">
            <div className="flex items-start gap-3 rounded-2xl border border-accent-500/30 bg-accent-500/5 p-6">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
              <p className="text-sm leading-relaxed text-muted">
                <strong className="text-[var(--fg)]">Your data stays on your device.</strong> This tool runs entirely in
                your browser — nothing is uploaded and nothing is stored on our servers.{" "}
                {tool.engine === "image-ai" && (tool.mode === "ocr" || tool.mode === "remove-bg")
                  ? "The first time, it downloads its AI model or language data once; after that it is cached."
                  : "It keeps working even if your connection drops mid-way."}{" "}
                We record only an anonymous count of how many times the tool ran.
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
            <SectionHead eyebrow="Similar tools" title="You might also need" center={false} />
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                
                  <Link
                    key={r.slug}
                    href={`/tools/${r.slug}`}
                    className="group flex min-w-0 items-center gap-3 rounded-2xl surface p-4 transition-all hover:-translate-y-1 hover:border-brand-400/40"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: r.color }}>
                      <ToolIcon tool={r} className="h-5 w-5" />
                    </span>
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

      {others.length > 0 && (
        <section className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-3xl surface p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-400">More free tools</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Everything else on SnapGrab</h2>
              </div>
              <ToolSearchBox className="w-full sm:max-w-xs" placeholder="Search tools…" />
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((g) => (
                <div key={g.category}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{g.category}</h3>
                  <ul className="mt-2 space-y-0.5">
                    {g.tools.map((t) => (
                        <li key={t.slug}>
                          <Link
                            href={`/tools/${t.slug}`}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-brand-500/10 hover:text-brand-400"
                          >
                            <ToolIcon tool={t} className="h-4 w-4 shrink-0" style={{ color: t.color }} />
                            {t.name}
                          </Link>
                        </li>
                    ))}
                  </ul>
                </div>
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
            category:
              tool.category === "Image"
                ? "DesignApplication"
                : tool.category === "Calculators"
                  ? "FinanceApplication"
                  : tool.category === "Audio" || tool.category === "Video"
                    ? "MultimediaApplication"
                    : "UtilitiesApplication",
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
