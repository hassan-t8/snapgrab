import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Downloader from "@/components/Downloader";
import AdSlot from "@/components/AdSlot";
import {
  Aurora,
  FAQ,
  Features,
  PlatformGrid,
  PlatformMarquee,
  SectionHead,
  StatsStrip,
  Steps,
  Testimonials,
} from "@/components/sections";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";
import { getEnabledPlatforms, getEnabledTools } from "@/lib/services";
import { jsonLd, faqJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HOME_FAQ = [
  {
    q: "Is SnapGrab free to use?",
    a: "Yes. Every downloader on the site is free and there is no account to create. The site is supported by unobtrusive advertising, which is why you will see one or two ad slots on the page.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. SnapGrab runs entirely in your browser — desktop or mobile. There is no extension, no APK and no desktop client, and anyone offering one in our name is not us.",
  },
  {
    q: "Which platforms are supported?",
    a: "YouTube, Instagram, Facebook, TikTok, X (Twitter), Pinterest, Snapchat, LinkedIn, Reddit, Vimeo, Dailymotion, SoundCloud, Threads and Twitch. More are added based on what people ask for.",
  },
  {
    q: "Can I download private or paid content?",
    a: "No. SnapGrab only processes links that are publicly accessible without logging in. Private accounts, subscriber-only videos and paid courses are out of scope by design.",
  },
  {
    q: "Where do my downloads go?",
    a: "Wherever your browser normally saves files — the Downloads folder on desktop, and Files or Photos on mobile depending on your browser.",
  },
  {
    q: "Is it legal to download these videos?",
    a: "Downloading for personal, offline viewing is broadly accepted; redistributing someone else's work is not. You are responsible for having the right to keep whatever you download.",
  },
  {
    q: "Why did my link fail?",
    a: "The most common reasons are a private or deleted post, a region-locked video, or a link that was copied incompletely. Try opening the link in a private browser window first — if you cannot see it there, neither can we.",
  },
  {
    q: "Do you keep the files I download?",
    a: "Never. Media streams from the source directly through to your device. We log which platform and format were used for analytics, but the file itself is never stored.",
  },
];

async function getStats() {
  try {
    const [downloads, visitors, posts] = await Promise.all([
      prisma.download.count({ where: { status: { not: "failed" } } }),
      prisma.visitor.count(),
      prisma.blogPost.count({ where: { published: true } }),
    ]);
    return { downloads, visitors, posts };
  } catch {
    return { downloads: 0, visitors: 0, posts: 0 };
  }
}

export default async function HomePage() {
  const [s, TOOLS, livePlatforms] = await Promise.all([getStats(), getEnabledTools(), getEnabledPlatforms()]);

  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              {livePlatforms.length} platforms · auto link detection · no signup
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              Download any video.
              <br />
              <span className="gradient-text">Just paste the link.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-lg">
              SnapGrab pulls videos, reels, stories and audio from YouTube, Instagram, Facebook, TikTok and ten more
              platforms — in original quality, without watermarks, straight in your browser.
            </p>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
              {["Free forever", "No installation", "Watermark free", "Works on mobile"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-400" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <Downloader />
        </div>

        <div className="mx-auto mt-10 max-w-5xl">
          <PlatformMarquee platforms={livePlatforms} />
        </div>
      </section>

      {/* ------------------------------- stats ------------------------------- */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <StatsStrip
            stats={[
              { label: "Downloads served", value: s.downloads, suffix: "+" },
              { label: "Visitors tracked", value: s.visitors, suffix: "+" },
              { label: "Platforms supported", value: livePlatforms.length },
              { label: "Guides published", value: s.posts },
            ]}
          />
        </div>
      </section>

      <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      {/* ------------------------------- platforms ------------------------------- */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Every platform"
            title="Pick your downloader"
            sub="Each platform has a dedicated page with the formats it supports, its own guide and its own FAQ."
          />
          <div className="mt-12">
            <PlatformGrid platforms={livePlatforms} />
          </div>
        </div>
      </section>

      {/* ------------------------------- tools ------------------------------- */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="More than downloads"
            title={`${TOOLS.length} free tools that run in your browser`}
            sub="Convert and compress images, merge and split PDFs, format JSON, generate QR codes and passwords — none of it uploaded anywhere."
          />
          <StaggerGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.slice(0, 6).map((t) => (
              <StaggerItem key={t.slug}>
                <Link href={`/tools/${t.slug}`} className="group block h-full">
                  <div className="relative h-full overflow-hidden rounded-2xl surface p-6 transition-all hover:-translate-y-1.5 hover:border-brand-400/40">
                    <div
                      className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
                      style={{ background: t.color }}
                    />
                    <span className="h-1.5 w-10 rounded-full" style={{ background: t.color, display: "block" }} />
                    <h3 className="mt-4 font-bold">{t.name}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.tagline}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
                      Open tool <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
          <div className="mt-10 text-center">
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 rounded-2xl surface px-6 py-3 font-bold transition-colors hover:border-brand-400/60"
            >
              See all {TOOLS.length} tools <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------- how it works ------------------------------- */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-72 -translate-y-1/2 bg-brand-500/5 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="How it works"
            title="Four steps, about eight seconds"
            sub="No account, no software, no queue. The slowest part is deciding which quality you want."
          />
          <div className="mt-12">
            <Steps />
          </div>
        </div>
      </section>

      {/* ------------------------------- features ------------------------------- */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Why SnapGrab"
            title="Built the way a downloader should be"
            sub="Fast, honest about its limits, and designed for the phone you are probably reading this on."
          />
          <div className="mt-12">
            <Features />
          </div>
        </div>
      </section>

      {/* ------------------------------- testimonials ------------------------------- */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="People use this daily" title="What our visitors say" />
          <div className="mt-12">
            <Testimonials />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      {/* ------------------------------- faq ------------------------------- */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Questions"
            title="Everything people ask us"
            sub="Still stuck? The contact form reaches a human, usually within a business day."
          />
          <div className="mt-12">
            <FAQ items={HOME_FAQ} />
          </div>
        </div>
      </section>

      {/* ------------------------------- cta ------------------------------- */}
      <section className="px-4 pb-8 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 p-10 text-center text-white sm:p-14">
            <div className="pointer-events-none absolute -left-10 -top-10 h-52 w-52 animate-float rounded-full bg-white/15 blur-2xl" />
            <div
              className="pointer-events-none absolute -bottom-14 -right-6 h-60 w-60 animate-float rounded-full bg-white/10 blur-2xl"
              style={{ animationDelay: "-3s" }}
            />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Ready when you are</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">
              Copy a link from any supported app, come back, and it will already be waiting in the box.
            </p>
            <Link
              href="/#downloader"
              className="relative mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-bold text-brand-700 shadow-xl transition-transform hover:scale-105 active:scale-95"
            >
              Start downloading <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationJsonLd(), websiteJsonLd(), faqJsonLd(HOME_FAQ))}
      />
    </>
  );
}
