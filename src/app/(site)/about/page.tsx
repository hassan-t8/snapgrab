import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cpu, Heart, Rocket, Scale, Server, Users } from "lucide-react";
import { Aurora, SectionHead, StatsStrip } from "@/components/sections";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "About us — who builds SnapGrab and why",
  description:
    "SnapGrab is a small independent team building a fast, honest media downloader. Here is what we believe, how the product works and where the limits are.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    icon: Rocket,
    title: "Speed is the feature",
    body: "Most downloaders make you click through three interstitials before anything happens. We resolve on paste and cache aggressively so repeat links are instant.",
  },
  {
    icon: Scale,
    title: "Honest about the rules",
    body: "We only process public content, we publish a real DMCA process, and we never pretend that downloading gives you rights you do not have.",
  },
  {
    icon: Server,
    title: "Nothing is hoarded",
    body: "Media streams straight from the source CDN through our proxy to your device. No copy is written to disk, so there is no library of other people's videos here.",
  },
  {
    icon: Heart,
    title: "Ads that stay out of the way",
    body: "One or two clearly-marked slots keep the lights on. No pop-ups, no fake download buttons, no redirect chains.",
  },
];

const TIMELINE = [
  { year: "2024", title: "The annoyance", body: "We got tired of downloader sites that hid the real button behind five fake ones." },
  { year: "2025", title: "First build", body: "A single-page tool for YouTube and Instagram, shared with about forty people." },
  { year: "2026", title: "Fourteen platforms", body: "Rebuilt around one normalisation layer so a new platform is a config change, not a rewrite." },
  { year: "Next", title: "Batch and playlists", body: "Queued multi-link downloads and playlist support are the two most requested features." },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-300">
              <Users className="h-3.5 w-3.5" /> About us
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              A downloader that <span className="gradient-text">respects your time</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 text-[15px] leading-relaxed text-muted sm:text-lg">
              SnapGrab is built by a small independent team who wanted one tool that handles every platform, works on a
              phone, and does not treat visitors as ad inventory to be farmed.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <StatsStrip
            stats={[
              { label: "Platforms supported", value: 14 },
              { label: "Formats normalised", value: 40, suffix: "+" },
              { label: "Avg. resolve time (ms)", value: 900 },
              { label: "Files stored on our disk", value: 0 },
            ]}
          />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="What we believe" title="Four rules we build against" />
          <StaggerGroup className="mt-12 grid gap-4 sm:grid-cols-2">
            {VALUES.map((v) => (
              <StaggerItem key={v.title}>
                <div className="h-full rounded-2xl surface p-6 transition-all hover:-translate-y-1 hover:border-brand-400/40">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-bold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SectionHead eyebrow="How it works" title="What happens when you press Download" center={false} />
          <div className="prose-article mt-8">
            <p>
              Your link goes to our API, which normalises it, works out which platform it belongs to and checks a short
              lived cache. If someone already resolved that exact link recently, you get the answer immediately and no
              upstream request is made at all.
            </p>
            <p>
              Otherwise we call our media provider, receive a list of streams and run it through a normaliser that turns
              fourteen different response shapes into one predictable format list, sorted best-first.
            </p>
            <p>
              When you pick a quality, the file streams through our proxy so the download works in every browser and
              arrives with a sensible filename. We log the platform, the format and an anonymous visitor id — never the
              file.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SectionHead eyebrow="Timeline" title="How we got here" />
          <div className="relative mt-12 space-y-6 pl-8">
            <span className="absolute left-2 top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-brand-500 via-accent-500 to-transparent" />
            {TIMELINE.map((t, i) => (
              <Reveal key={t.year} delay={i * 0.06}>
                <div className="relative rounded-2xl surface p-5">
                  <span className="absolute -left-[26px] top-6 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 ring-4 ring-[var(--bg)]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400">{t.year}</span>
                  <h3 className="mt-1 font-bold">{t.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-4xl">
          <div className="rounded-2xl surface p-7">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400">
              <Cpu className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold">Want a platform we do not support?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Tell us which one and roughly how often you would use it. Requests with real use cases go to the front of
              the queue.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
            >
              Send us a request <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
