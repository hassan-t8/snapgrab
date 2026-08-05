import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Downloader from "@/components/Downloader";
import AdSlot from "@/components/AdSlot";
import { Aurora, FAQ, Features, SectionHead, Steps } from "@/components/sections";
import { Reveal } from "@/components/motion";
import { PLATFORMS } from "@/lib/platforms";
import { breadcrumbJsonLd, faqJsonLd, howToJsonLd, jsonLd, ogImage, softwareAppJsonLd } from "@/lib/seo";
import { getEnabledPlatforms, getServiceState } from "@/lib/services";
import ServiceUnavailable from "@/components/ServiceUnavailable";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return PLATFORMS.map((p) => ({ platform: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/download/[platform]">): Promise<Metadata> {
  const { platform } = await params;
  const p = PLATFORMS.find((x) => x.slug === platform);
  if (!p) return { title: "Downloader not found" };
  if (!(await getServiceState("platform", p.id)).enabled) {
    return { title: `${p.name} downloader — temporarily unavailable`, robots: { index: false, follow: true } };
  }

  return {
    title: `${p.headline} — Free, Fast, No Watermark`,
    description: p.description,
    keywords: [`${p.name.toLowerCase()} downloader`, `download ${p.name.toLowerCase()} video`, ...p.formats],
    alternates: { canonical: `/download/${p.slug}` },
    openGraph: {
      title: p.headline,
      description: p.description,
      url: `/download/${p.slug}`,
      images: [
        {
          url: ogImage({ title: p.headline, subtitle: p.blurb, badge: `${p.name} downloader` }),
          width: 1200,
          height: 630,
          alt: p.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: p.headline,
      description: p.blurb,
      images: [ogImage({ title: p.headline, subtitle: p.blurb, badge: `${p.name} downloader` })],
    },
  };
}

export default async function PlatformPage({ params }: PageProps<"/download/[platform]">) {
  const { platform } = await params;
  const p = PLATFORMS.find((x) => x.slug === platform);
  if (!p) notFound();

  const state = await getServiceState("platform", p.id);
  const live = await getEnabledPlatforms();

  if (!state.enabled) {
    return (
      <ServiceUnavailable
        name={`The ${p.name} downloader`}
        note={state.note}
        alternatives={live.slice(0, 4).map((o) => ({
          href: `/download/${o.slug}`,
          label: o.name,
          sub: o.blurb,
          color: o.color,
        }))}
      />
    );
  }

  const others = live.filter((x) => x.id !== p.id).slice(0, 6);

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-14 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ background: `${p.color}1f`, color: p.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name} downloader
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{p.headline}</h1>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-lg">{p.description}</p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {p.formats.map((f) => (
                <span key={f} className="rounded-lg surface px-3 py-1.5 text-xs font-semibold">
                  {f}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <Downloader presetPlatform={p.id} />
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Step by step"
            title={`How to download from ${p.name}`}
            sub="It is the same four steps on desktop and mobile."
          />
          <div className="mt-12">
            <Steps />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="What you get" title={`Why use SnapGrab for ${p.name}`} />
          <div className="mt-12">
            <Features />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Questions" title={`${p.name} downloader FAQ`} />
          <div className="mt-10">
            <FAQ
              items={[
                ...p.faqs,
                {
                  q: "Does this cost anything?",
                  a: "No. Every downloader on SnapGrab is free, with no account and no daily limit beyond basic anti-bot rate limiting.",
                },
                {
                  q: "Is my activity private?",
                  a: "We log the platform, format and an anonymous visitor id for analytics and abuse prevention. The media file itself is never stored on our servers.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="rounded-2xl surface p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
                <p className="text-sm leading-relaxed text-muted">
                  <strong className="text-[var(--fg)]">Use it responsibly.</strong> SnapGrab is not affiliated with{" "}
                  {p.name}. Only download content you created, content licensed for reuse, or content you have explicit
                  permission to save. Redistributing someone else&apos;s work without permission is a copyright matter and
                  is your responsibility, not ours.
                </p>
              </div>
            </div>
          </Reveal>

          <SectionHead eyebrow="More tools" title="Other downloaders" center={false} />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <Link
                key={o.id}
                href={`/download/${o.slug}`}
                className="group flex items-center gap-3 rounded-2xl surface p-4 transition-all hover:-translate-y-1 hover:border-brand-400/40"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black text-white"
                  style={{ background: o.color }}
                >
                  {o.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{o.name}</span>
                  <span className="block truncate text-xs text-muted">{o.blurb}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          softwareAppJsonLd({ name: p.headline, description: p.description, url: `/download/${p.slug}` }),
          howToJsonLd(`How to download from ${p.name}`, [
            { title: "Copy the link", body: `Use the Share or Copy link button in ${p.name}.` },
            { title: "Paste it into SnapGrab", body: "The platform is detected automatically as soon as you paste." },
            { title: "Pick a quality", body: "Every stream the source published is listed, best first." },
            { title: "Save the file", body: "The download starts immediately, with no software to install." },
          ]),
          faqJsonLd(p.faqs),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: `${p.name} downloader`, path: `/download/${p.slug}` },
          ]),
        )}
      />
    </>
  );
}
