import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";
import { Aurora, FAQ, SectionHead } from "@/components/sections";
import { Reveal } from "@/components/motion";
import AdSlot from "@/components/AdSlot";

export const metadata: Metadata = {
  title: "FAQ — everything about downloading with SnapGrab",
  description:
    "Answers on supported platforms, formats, quality, privacy, failed links, mobile downloads and the legal side of saving video.",
  alternates: { canonical: "/faq" },
};

const GROUPS = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I download a video?",
        a: "Copy the link from the app or browser, open SnapGrab, and paste it into the box. Detection is automatic — you do not need to pick a platform first. Then choose a quality and the file saves straight away.",
      },
      {
        q: "Do I need an account?",
        a: "No. There is no signup, no email verification and no login for using any downloader on the site.",
      },
      {
        q: "Does it work on iPhone and Android?",
        a: "Yes. On Android the file lands in Downloads. On iOS, Safari saves to Files (and video into Photos if you share it there afterwards). No app install is required on either.",
      },
      {
        q: "What does auto-detection actually do?",
        a: "When you focus the input box, the browser may offer us clipboard access. If it does and your clipboard holds a supported link, we fill the field and start resolving immediately. If your browser blocks clipboard reads, pasting manually triggers exactly the same thing.",
      },
    ],
  },
  {
    title: "Formats and quality",
    items: [
      {
        q: "Which qualities can I get?",
        a: "Whatever the source published — commonly 2160p, 1440p, 1080p, 720p, 480p and 360p for video, plus audio-only options up to 320kbps. If a resolution is missing, the uploader never rendered it.",
      },
      {
        q: "Why is one 1080p file bigger than another?",
        a: "Bitrate. Resolution tells you the pixel grid; bitrate tells you how much detail survived compression. When two rows share a resolution, the larger file generally looks better.",
      },
      {
        q: "Can I get audio only?",
        a: "Yes, wherever the source exposes an audio track. It appears as a separate MP3 or M4A row in the results list.",
      },
      {
        q: "Some videos say 'no audio'. Why?",
        a: "A few platforms publish high-resolution video and audio as separate streams. We label the silent ones honestly rather than letting you download a mute file by surprise.",
      },
    ],
  },
  {
    title: "When things fail",
    items: [
      {
        q: "My link returned an error.",
        a: "Nine times out of ten the post is private, deleted, age-gated or region-locked. Open the link in a private browsing window — if you cannot see it while logged out, neither can we.",
      },
      {
        q: "The download button says the media expired.",
        a: "CDN links from these platforms are signed and short-lived. Resolve the original link again and the fresh URL will work.",
      },
      {
        q: "I keep getting rate limited.",
        a: "There is a fair-use cap per IP per minute to keep bots out. Wait sixty seconds and it clears on its own.",
      },
      {
        q: "A platform stopped working entirely.",
        a: "Platforms change their systems without notice. Tell us through the contact form and we will usually have it back within a day or two.",
      },
    ],
  },
  {
    title: "Privacy and legality",
    items: [
      {
        q: "Do you store the videos I download?",
        a: "No. Media streams from the source CDN through our proxy directly to your device. Nothing is written to our disk.",
      },
      {
        q: "What do you log?",
        a: "An anonymous cookie id, your IP, browser and country, which pages you visited, and which platform and format you downloaded. It is used for abuse prevention and aggregate analytics. Full details are in the privacy policy.",
      },
      {
        q: "Is downloading legal?",
        a: "Saving public content for personal offline viewing is broadly accepted in most jurisdictions. Redistributing, monetising or re-uploading someone else's work is a copyright matter and your responsibility. When money is involved, get advice from a lawyer in your country.",
      },
      {
        q: "Can I download private posts?",
        a: "No, and we will not add it. SnapGrab only processes content that is publicly visible without logging in.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-300">
              <HelpCircle className="h-3.5 w-3.5" /> Help centre
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Frequently asked <span className="gradient-text">questions</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-lg">
              Grouped by what people actually ask. If your question is not here, the contact form reaches us directly.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      {GROUPS.map((g, i) => (
        <section key={g.title} className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionHead eyebrow={`Part ${i + 1}`} title={g.title} />
            <div className="mt-8">
              <FAQ items={g.items} />
            </div>
          </div>
        </section>
      ))}

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-4xl">
          <div className="rounded-[26px] bg-gradient-to-br from-brand-600 to-accent-500 p-8 text-center text-white sm:p-12">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Still stuck?</h2>
            <p className="mx-auto mt-3 max-w-md text-white/85">
              Send us the link you tried and what you saw. We answer within a business day.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-bold text-brand-700 transition-transform hover:scale-105"
            >
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: GROUPS.flatMap((g) =>
              g.items.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            ),
          }),
        }}
      />
    </>
  );
}
