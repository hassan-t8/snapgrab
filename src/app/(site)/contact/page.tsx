import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, LifeBuoy, Mail, MapPin, MessageSquare, Scale } from "lucide-react";
import ContactForm from "@/components/ContactForm";
import { Aurora, FAQ } from "@/components/sections";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Contact us — questions, requests and DMCA",
  description:
    "Reach the SnapGrab team about a failed link, a platform request, advertising or a copyright notice. We answer within one business day.",
  alternates: { canonical: "/contact" },
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    body: "support@snapgrab.app",
    note: "Best for anything that needs a paper trail.",
  },
  {
    icon: Scale,
    title: "Copyright / DMCA",
    body: "dmca@snapgrab.app",
    note: "Rights holders: see the DMCA page for what to include.",
  },
  {
    icon: Clock3,
    title: "Response time",
    body: "Within one business day",
    note: "Usually much faster on weekdays.",
  },
  {
    icon: MapPin,
    title: "Where we are",
    body: "Remote, distributed team",
    note: "Correspondence address available on request.",
  },
];

const CONTACT_FAQ = [
  {
    q: "A link failed — what should I include?",
    a: "Paste the exact link you tried, tell us which quality you picked, and mention your browser and device. That is almost always enough for us to reproduce it.",
  },
  {
    q: "Can you add support for another site?",
    a: "Often yes. Send the site name and a couple of example public links. Requests that come with a real use case get prioritised.",
  },
  {
    q: "I want my data deleted.",
    a: "Email us from the address you contacted us with, or tell us the approximate time and IP you used. We remove matching visitor, page view and download rows.",
  },
  {
    q: "Do you accept advertising?",
    a: "Yes, in the existing slots only. We do not run pop-ups, interstitials or anything designed to look like a download button.",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-300">
              <MessageSquare className="h-3.5 w-3.5" /> Contact
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Talk to a <span className="gradient-text">real person</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-lg">
              Bug reports, platform requests, copyright notices or partnership questions — this form reaches the team
              directly.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4">
            {CHANNELS.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.06}>
                <div className="flex gap-4 rounded-2xl surface p-5 transition-all hover:-translate-y-1 hover:border-brand-400/40">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{c.title}</h3>
                    <p className="mt-0.5 font-semibold">{c.body}</p>
                    <p className="mt-1 text-sm text-muted">{c.note}</p>
                  </div>
                </div>
              </Reveal>
            ))}

            <Reveal delay={0.28}>
              <div className="rounded-2xl border border-brand-400/30 bg-brand-500/5 p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Before writing in about a failed download, it is worth checking the{" "}
                  <Link href="/faq" className="font-semibold text-brand-400 hover:underline">
                    FAQ
                  </Link>
                  . Private posts, deleted videos and region locks account for most failures and none of them are fixable
                  from our side.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Before you write in</h2>
          <FAQ items={CONTACT_FAQ} />
        </div>
      </section>
    </>
  );
}
