"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  ChevronDown,
  Gauge,
  Globe2,
  HeartHandshake,
  Infinity as InfinityIcon,
  Lock,
  MonitorSmartphone,
  Quote,
  ShieldCheck,
  Star,
  Wand2,
} from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";
import { Reveal, StaggerGroup, StaggerItem } from "./motion";

/* ---------------------------------- hero background ---------------------------------- */

export function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute -left-24 top-0 h-[30rem] w-[30rem] animate-blob rounded-full bg-brand-500/25 blur-[110px]" />
      <div
        className="absolute -right-20 top-24 h-[26rem] w-[26rem] animate-blob rounded-full bg-accent-500/20 blur-[110px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute left-1/3 top-40 h-[22rem] w-[22rem] animate-blob rounded-full bg-brand-300/20 blur-[110px]"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}

/* ---------------------------------- counters ---------------------------------- */

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

export function StatsStrip({
  stats,
}: {
  stats: { label: string; value: number; suffix?: string }[];
}) {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <StaggerItem key={s.label}>
          <div className="surface rounded-2xl p-5 text-center transition-transform hover:-translate-y-1">
            <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              <span className="gradient-text">
                <Counter to={s.value} suffix={s.suffix} />
              </span>
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">{s.label}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

/* ---------------------------------- platform marquee ---------------------------------- */

export function PlatformMarquee() {
  const row = [...PLATFORMS, ...PLATFORMS];
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-3">
        {row.map((p, i) => (
          <span
            key={`${p.id}-${i}`}
            className="flex items-center gap-2 whitespace-nowrap rounded-full surface px-4 py-2 text-sm font-semibold"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- platform grid ---------------------------------- */

export function PlatformGrid() {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {PLATFORMS.map((p) => (
        <StaggerItem key={p.id}>
          <Link href={`/download/${p.slug}`} className="group block h-full">
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="relative h-full overflow-hidden rounded-2xl surface p-5"
            >
              <div
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
                style={{ background: p.color }}
              />
              <span
                className="grid h-11 w-11 place-items-center rounded-xl text-sm font-black text-white"
                style={{ background: p.color, boxShadow: `0 8px 24px -8px ${p.color}` }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <h3 className="mt-4 font-bold">{p.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{p.blurb}</p>
              <p className="mt-3 text-xs font-semibold text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
                Open downloader →
              </p>
            </motion.div>
          </Link>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

/* ---------------------------------- features ---------------------------------- */

const FEATURES = [
  {
    icon: Wand2,
    title: "Auto link detection",
    body: "Paste and stop. SnapGrab reads the clipboard, works out which platform the link belongs to and starts resolving before you reach for the button.",
  },
  {
    icon: Gauge,
    title: "Resolved in about a second",
    body: "Repeat links are served from a warm cache, so the second person to want that clip waits almost no time at all.",
  },
  {
    icon: ShieldCheck,
    title: "No watermarks, no re-encoding",
    body: "You get the original stream the platform published — same bitrate, same colours, no burnt-in logo.",
  },
  {
    icon: MonitorSmartphone,
    title: "Built for the phone first",
    body: "One-handed layout, big tap targets, and downloads that land straight in your device's Files or Photos app.",
  },
  {
    icon: Lock,
    title: "Nothing is stored",
    body: "Media streams from the source CDN through the proxy to you. The file is never written to our disk.",
  },
  {
    icon: InfinityIcon,
    title: "No daily cap",
    body: "No account, no credits, no ten-per-day paywall. Fair-use rate limits only exist to stop bots.",
  },
  {
    icon: Globe2,
    title: "14 platforms and counting",
    body: "YouTube, Instagram, Facebook, TikTok, X, Pinterest, Reddit, Snapchat, LinkedIn, Vimeo and more.",
  },
  {
    icon: HeartHandshake,
    title: "Honest about the rules",
    body: "We only touch public content, we respect DMCA notices, and we say plainly what we log and why.",
  },
];

export function Features() {
  return (
    <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((f) => (
        <StaggerItem key={f.title}>
          <div className="group h-full rounded-2xl surface p-6 transition-all hover:-translate-y-1 hover:border-brand-400/40">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400 transition-transform group-hover:scale-110">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

/* ---------------------------------- steps ---------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Copy the link",
    body: "Use the Share or Copy link button in any app — YouTube, Instagram, TikTok, Facebook, anywhere.",
  },
  {
    n: "02",
    title: "Paste it here",
    body: "Tap the box. If your clipboard holds a supported link, SnapGrab picks it up and starts on its own.",
  },
  {
    n: "03",
    title: "Pick your quality",
    body: "Every stream the source published is listed — 4K down to 360p, plus audio-only MP3 where available.",
  },
  {
    n: "04",
    title: "Save the file",
    body: "The download starts immediately and lands in your normal downloads folder. No installer, ever.",
  },
];

export function Steps() {
  return (
    <div className="relative">
      <div className="absolute left-[27px] top-6 hidden h-[calc(100%-3rem)] w-px bg-gradient-to-b from-brand-500 via-accent-500 to-transparent lg:left-1/2 lg:block" />
      <StaggerGroup className="grid gap-5 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <StaggerItem key={s.n}>
            <div className="relative h-full rounded-2xl surface p-6">
              <span className="text-4xl font-black leading-none text-brand-500/25">{s.n}</span>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              {i < STEPS.length - 1 && (
                <span className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white lg:grid">
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                </span>
              )}
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}

/* ---------------------------------- testimonials ---------------------------------- */

const REVIEWS = [
  {
    name: "Ayesha K.",
    role: "Content editor",
    text: "I pull twenty reels a week for client mood boards. The clipboard detection alone saves me an hour every month.",
  },
  {
    name: "Marco D.",
    role: "Football coach",
    text: "I download match clips from Facebook to review with the team offline. Quality options are exactly what the upload had.",
  },
  {
    name: "Priya S.",
    role: "Student",
    text: "Lectures on YouTube turn into MP3s for the bus ride. It works on my phone browser without installing anything.",
  },
  {
    name: "Tom H.",
    role: "Podcast producer",
    text: "SoundCloud to 320kbps in two taps, with the artwork intact. Replaced three sketchy sites I used before.",
  },
  {
    name: "Fatima R.",
    role: "Small business owner",
    text: "I repost my own TikToks to Instagram and the watermark-free file makes them look native. No re-recording.",
  },
  {
    name: "Daniel O.",
    role: "Archivist",
    text: "Reddit videos with the audio actually merged in. That sounds small until you have tried every other tool.",
  },
];

export function Testimonials() {
  return (
    <StaggerGroup className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {REVIEWS.map((r) => (
        <StaggerItem key={r.name}>
          <figure className="h-full rounded-2xl surface p-6">
            <Quote className="h-6 w-6 text-brand-500/40" />
            <blockquote className="mt-3 text-sm leading-relaxed text-muted">{r.text}</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
                {r.name[0]}
              </span>
              <span>
                <span className="block text-sm font-bold">{r.name}</span>
                <span className="block text-xs text-muted">{r.role}</span>
              </span>
              <span className="ml-auto flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                ))}
              </span>
            </figcaption>
          </figure>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

/* ---------------------------------- FAQ ---------------------------------- */

export function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((item, i) => (
        <Reveal key={item.q} delay={i * 0.04}>
          <div className="overflow-hidden rounded-2xl surface">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
              aria-expanded={open === i}
            >
              <span className="font-semibold">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-brand-400 transition-transform duration-300 ${
                  open === i ? "rotate-180" : ""
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ---------------------------------- section heading ---------------------------------- */

export function SectionHead({
  eyebrow,
  title,
  sub,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-400">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>}
    </Reveal>
  );
}
