"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, Moon, PartyPopper, Timer } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import ShareSheet from "@/components/ShareSheet";
import { trackEvent } from "@/lib/track-event";

/* ------------------------------------------------------------------ *
 * shared helpers (same look as CalculatorStudio)
 * ------------------------------------------------------------------ */

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-transform hover:-translate-y-0.5";
const secondary = "inline-flex items-center gap-2 rounded-xl surface px-4 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60";

/** Records one anonymous use per page view, once a countdown is on screen. */
function useTrackOnce(slug: string, ready: boolean) {
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ tool: slug, files: 1 }),
    }).catch(() => {});
  }, [slug, ready]);
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            value === o.value
              ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
              : "surface text-muted hover:text-[var(--fg)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hijri (Umm al-Qura) helpers — copied from CalculatorStudio
 * ------------------------------------------------------------------ */

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
  "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah",
];

const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

/** Hijri day/month/year of a UTC calendar date. */
function toHijri(d: Date) {
  const parts = Object.fromEntries(hijriFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { day: Number(parts.day), month: Number(parts.month), year: Number(String(parts.year).replace(/\D/g, "")) };
}

const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Gregorian (UTC) date for a Hijri date (searches around the arithmetic estimate). */
function fromHijri(y: number, m: number, day: number): Date | null {
  const approx = Math.round((y - 1) * 354.36707 + (m - 1) * 29.530589 + day) - 492_148;
  const base = new Date(approx * 86_400_000);
  for (let off = -40; off <= 40; off++) {
    const g = addDays(base, off);
    const h = toHijri(g);
    if (h.year === y && h.month === m && h.day === day) return g;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * events
 * ------------------------------------------------------------------ */

type EventDef = {
  id: string;
  name: string;
  short: string;
  group: "Islamic" | "Pakistan";
  /** Hijri month/day, or Gregorian month (1–12)/day */
  hijri?: [number, number];
  greg?: [number, number];
  /** a night that begins at Maghrib on the evening before the date */
  night?: boolean;
  /** shown while the day (or night) is here */
  arrived: string;
  note: string;
};

const EVENTS: EventDef[] = [
  {
    id: "ramadan",
    name: "Ramadan 1st Roza",
    short: "Ramadan",
    group: "Islamic",
    hijri: [9, 1],
    arrived: "Ramadan Mubarak!",
    note: "Counts down to the first fast (1 Ramadan). The first Taraweeh is prayed the night before.",
  },
  {
    id: "shab-e-qadr",
    name: "Shab-e-Qadr (27th night)",
    short: "Shab-e-Qadr",
    group: "Islamic",
    hijri: [9, 27],
    night: true,
    arrived: "Shab-e-Qadr is tonight",
    note: "Laylat al-Qadr is sought in the odd nights of the last ten of Ramadan; the 27th night is widely observed in Pakistan. It begins at Maghrib on the evening of 26 Ramadan.",
  },
  {
    id: "eid-ul-fitr",
    name: "Eid ul Fitr",
    short: "Eid ul Fitr",
    group: "Islamic",
    hijri: [10, 1],
    arrived: "Eid Mubarak!",
    note: "1 Shawwal, the day after Ramadan ends. Chaand Raat is the evening before.",
  },
  {
    id: "eid-ul-adha",
    name: "Eid ul Adha (Bakra Eid)",
    short: "Eid ul Adha",
    group: "Islamic",
    hijri: [12, 10],
    arrived: "Eid ul Adha Mubarak!",
    note: "10 Dhul Hijjah, the day after the Day of Arafah. Qurbani continues for the following days.",
  },
  {
    id: "islamic-new-year",
    name: "Islamic New Year (1 Muharram)",
    short: "Islamic New Year",
    group: "Islamic",
    hijri: [1, 1],
    arrived: "A new Hijri year has begun",
    note: "1 Muharram, the first day of the Hijri calendar year.",
  },
  {
    id: "ashura",
    name: "Ashura (10 Muharram)",
    short: "Ashura",
    group: "Islamic",
    hijri: [1, 10],
    arrived: "Today is Ashura, 10 Muharram",
    note: "A day of fasting and remembrance, including of the martyrdom of Imam Husain (RA) at Karbala.",
  },
  {
    id: "12-rabi-ul-awwal",
    name: "12 Rabi ul Awwal",
    short: "12 Rabi ul Awwal",
    group: "Islamic",
    hijri: [3, 12],
    arrived: "Today is 12 Rabi ul Awwal",
    note: "Observed in Pakistan as Eid Milad-un-Nabi ﷺ, a public holiday.",
  },
  {
    id: "shab-e-barat",
    name: "Shab-e-Barat (15 Shaban night)",
    short: "Shab-e-Barat",
    group: "Islamic",
    hijri: [8, 15],
    night: true,
    arrived: "Shab-e-Barat is tonight",
    note: "The night before 15 Shaban; it begins at Maghrib on the evening of 14 Shaban.",
  },
  {
    id: "14-august",
    name: "Independence Day (14 August)",
    short: "14 August",
    group: "Pakistan",
    greg: [8, 14],
    arrived: "Happy Independence Day — Pakistan Zindabad!",
    note: "Pakistan's Independence Day, 14 August 1947.",
  },
  {
    id: "23-march",
    name: "Pakistan Day (23 March)",
    short: "23 March",
    group: "Pakistan",
    greg: [3, 23],
    arrived: "Happy Pakistan Day!",
    note: "Marks the Lahore Resolution of 23 March 1940 and the 1956 constitution.",
  },
  {
    id: "quaid-day",
    name: "Quaid-e-Azam Day (25 December)",
    short: "Quaid Day",
    group: "Pakistan",
    greg: [12, 25],
    arrived: "Today is Quaid-e-Azam Day",
    note: "The birthday of Quaid-e-Azam Muhammad Ali Jinnah (born 25 December 1876).",
  },
  {
    id: "iqbal-day",
    name: "Iqbal Day (9 November)",
    short: "Iqbal Day",
    group: "Pakistan",
    greg: [11, 9],
    arrived: "Today is Iqbal Day",
    note: "The birthday of Allama Muhammad Iqbal (born 9 November 1877).",
  },
  {
    id: "new-year",
    name: "New Year (1 January)",
    short: "New Year",
    group: "Pakistan",
    greg: [1, 1],
    arrived: "Happy New Year!",
    note: "Midnight on 1 January in your time zone.",
  },
];

type Occurrence = { start: Date; end: Date; prev: Date | null; hijriYear?: number };

/** Every occurrence of an event from last year to two years ahead, in the visitor's time zone. */
function occurrences(ev: EventDef, today: Date, shift: number): Occurrence[] {
  const list: { start: Date; end: Date; hijriYear?: number }[] = [];
  if (ev.hijri) {
    const [hm, hd] = ev.hijri;
    const hy = toHijri(utcDay(today.getFullYear(), today.getMonth(), today.getDate())).year;
    for (let y = hy - 2; y <= hy + 2; y++) {
      const g = fromHijri(y, hm, hd);
      if (!g) continue;
      const day = new Date(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate() + shift);
      list.push(spanOf(day, !!ev.night, y));
    }
  } else if (ev.greg) {
    const [gm, gd] = ev.greg;
    for (let y = today.getFullYear() - 1; y <= today.getFullYear() + 2; y++) list.push(spanOf(new Date(y, gm - 1, gd), false));
  }
  list.sort((a, b) => a.start.getTime() - b.start.getTime());
  return list.map((o, i) => ({ ...o, prev: i > 0 ? list[i - 1].start : null }));
}

/** A day runs midnight to midnight; a night runs from about Maghrib (6 pm) the evening before until Fajr. */
function spanOf(day: Date, night: boolean, hijriYear?: number) {
  if (night) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 18, 0, 0);
    return { start, end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 5, 0, 0), hijriYear };
  }
  return { start: day, end: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), hijriYear };
}

function nextOf(list: Occurrence[], now: Date) {
  return list.find((o) => o.end.getTime() > now.getTime()) ?? null;
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86_400), h: Math.floor((s % 86_400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeOf = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/* ------------------------------------------------------------------ *
 * calendar file
 * ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");
const icsDay = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsLocal = (d: Date) => `${icsDay(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

function downloadIcs(opts: { title: string; start: Date; end: Date; allDay: boolean; description: string; slug: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SnapGrab//Countdown//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${opts.start.getTime()}-${Math.random().toString(36).slice(2)}@snapgrab`,
    `DTSTAMP:${icsUtc(new Date())}`,
    opts.allDay ? `DTSTART;VALUE=DATE:${icsDay(opts.start)}` : `DTSTART:${icsLocal(opts.start)}`,
    opts.allDay ? `DTEND;VALUE=DATE:${icsDay(opts.end)}` : `DTEND:${icsLocal(opts.end)}`,
    `SUMMARY:${icsText(opts.title)}`,
    `DESCRIPTION:${icsText(opts.description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`${opts.title} is tomorrow`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "countdown"}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  trackEvent("download", opts.slug);
  notify.success("Calendar file downloaded", "Open it to add the date to your phone or computer calendar.");
}

/* ------------------------------------------------------------------ *
 * presentational pieces
 * ------------------------------------------------------------------ */

function Digit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  // three-digit day counts get a smaller size so they fit a quarter of a 360 px screen
  const size = text.length >= 3 ? "text-[clamp(1.5rem,7vw,4rem)]" : "text-[clamp(2rem,10vw,4.5rem)]";
  return (
    <div className="flex flex-col justify-center rounded-2xl surface px-1 py-3 text-center sm:py-5">
      <span className={`block font-extrabold leading-none tabular-nums gradient-text ${size}`}>{text}</span>
      <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted sm:text-xs">{label}</span>
    </div>
  );
}

function Clock({ ms }: { ms: number }) {
  const t = split(ms);
  return (
    <div
      role="timer"
      aria-label={`${t.d} days, ${t.h} hours, ${t.m} minutes and ${t.s} seconds left`}
      className="grid grid-cols-4 gap-2 sm:gap-3"
    >
      <Digit value={t.d} label={t.d === 1 ? "Day" : "Days"} />
      <Digit value={t.h} label="Hours" />
      <Digit value={t.m} label="Minutes" />
      <Digit value={t.s} label="Seconds" />
    </div>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs font-semibold text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--line)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * custom countdowns from the URL: ?title=…&date=2027-01-01T09:00
 * ------------------------------------------------------------------ */

type Custom = { title: string; date: string; from?: string };

function parseLocal(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

function customUrl(base: string, c: Custom) {
  const p = new URLSearchParams({ title: c.title, date: c.date });
  if (c.from) p.set("from", c.from);
  return `${base}?${p.toString()}`;
}

/* ------------------------------------------------------------------ *
 * the studio
 * ------------------------------------------------------------------ */

const MOON_KEY = "sg-countdown-moon";

function Countdowns({ slug, focus }: { slug: string; focus: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  const [shift, setShift] = useState<"0" | "1">("1");
  const [selected, setSelected] = useState<string | null>(focus);
  const [custom, setCustom] = useState<Custom | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  useTrackOnce(slug, !!now);

  // the clock, the saved moon setting and a ?title=&date= link all live in the browser only
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
    };
    const id = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(MOON_KEY);
        if (saved === "0" || saved === "1") setShift(saved);
      } catch {}
      const p = new URLSearchParams(window.location.search);
      const date = p.get("date");
      if (date && parseLocal(date)) {
        const c = { title: (p.get("title") || "My countdown").slice(0, 80), date, from: p.get("from") ?? undefined };
        setCustom(c);
        setDraftTitle(c.title);
        setDraftDate(date.slice(0, 10));
        setDraftTime(date.length >= 16 ? date.slice(11, 16) : "");
        setSelected("custom");
      }
      setPageUrl(window.location.origin + window.location.pathname);
      tick();
    });
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
  }, []);

  const dayKey = now ? `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}` : "";
  // the schedule only changes when the date or the moon setting changes
  const schedule = useMemo(() => {
    if (!dayKey) return null;
    const [y, m, d] = dayKey.split("-").map(Number);
    const today = new Date(y, m, d);
    return EVENTS.map((ev) => ({ ev, list: occurrences(ev, today, ev.hijri ? Number(shift) : 0) }));
  }, [dayKey, shift]);

  const upcoming = useMemo(() => {
    if (!schedule || !now) return [];
    return schedule
      .map(({ ev, list }) => ({ ev, occ: nextOf(list, now) }))
      .filter((x): x is { ev: EventDef; occ: Occurrence } => !!x.occ)
      .sort((a, b) => a.occ.start.getTime() - b.occ.start.getTime());
  }, [schedule, now]);

  const activeId = selected ?? upcoming[0]?.ev.id ?? null;
  const active = activeId === "custom" ? null : (upcoming.find((x) => x.ev.id === activeId) ?? upcoming[0] ?? null);

  const customTarget = custom ? parseLocal(custom.date) : null;
  const customFrom = custom?.from ? parseLocal(custom.from) : null;

  function chooseShift(v: "0" | "1") {
    setShift(v);
    try {
      localStorage.setItem(MOON_KEY, v);
    } catch {}
  }

  function select(id: string) {
    setSelected(id);
    requestAnimationFrame(() => document.getElementById("tool")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function startCustom(e: FormEvent) {
    e.preventDefault();
    const title = draftTitle.trim() || "My countdown";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) {
      notify.warning("Pick a date", "Choose the day you are counting down to.");
      return;
    }
    const date = draftTime ? `${draftDate}T${draftTime}` : draftDate;
    const target = parseLocal(date);
    if (!target || target.getTime() <= Date.now()) {
      notify.warning("Pick a future date", "The countdown needs a date and time that has not passed yet.");
      return;
    }
    const n = new Date();
    const from = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
    const c = { title: title.slice(0, 80), date, from };
    setCustom(c);
    setSelected("custom");
    trackEvent("generate", slug);
    try {
      window.history.replaceState(null, "", customUrl(window.location.pathname, c));
    } catch {}
    requestAnimationFrame(() => document.getElementById("tool")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  if (!now || !schedule) {
    return (
      <div aria-busy="true" aria-label="Loading countdown">
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl surface sm:h-32" />
          ))}
        </div>
        <div className="mt-5 h-2.5 animate-pulse rounded-full bg-[var(--line)]" />
      </div>
    );
  }

  const todayHijri = toHijri(addDays(utcDay(now.getFullYear(), now.getMonth(), now.getDate()), -Number(shift)));
  const moonLabel = shift === "1" ? "Pakistan estimate (+1 day)" : "Saudi / Umm al-Qura";

  /* ---- the big countdown ---- */
  let hero: ReactNode = null;
  if (activeId === "custom" && custom && customTarget) {
    const left = customTarget.getTime() - now.getTime();
    const shareUrl = pageUrl ? customUrl(pageUrl, custom) : undefined;
    hero = (
      <section aria-labelledby="cd-title">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Your countdown</p>
        <h2 id="cd-title" className="mt-1 break-words text-2xl font-extrabold sm:text-3xl">
          {custom.title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {longDate(customTarget)}
          {custom.date.length >= 16 ? ` at ${timeOf(customTarget)}` : ""} · your time zone
        </p>
        <div className="mt-5">
          {left > 0 ? (
            <Clock ms={left} />
          ) : (
            <Arrived text={`${custom.title} — the moment has arrived!`} sub={`Reached on ${longDate(customTarget)}`} />
          )}
        </div>
        {customFrom && left > 0 && customTarget > customFrom && (
          <Progress value={(now.getTime() - customFrom.getTime()) / (customTarget.getTime() - customFrom.getTime())} label="Time passed since you started" />
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondary}
            onClick={() =>
              downloadIcs({
                title: custom.title,
                start: customTarget,
                end: custom.date.length >= 16 ? new Date(customTarget.getTime() + 3_600_000) : new Date(customTarget.getFullYear(), customTarget.getMonth(), customTarget.getDate() + 1),
                allDay: custom.date.length < 16,
                description: `Countdown made with SnapGrab${shareUrl ? `: ${shareUrl}` : ""}`,
                slug,
              })
            }
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add to calendar
          </button>
          <ShareSheet
            title={`Countdown: ${custom.title}`}
            text={`${split(Math.max(0, left)).d} days to go until ${custom.title} (${shortDate(customTarget)})`}
            url={shareUrl}
            label="Share countdown"
            className="ml-auto"
          />
        </div>
      </section>
    );
  } else if (active) {
    const { ev, occ } = active;
    const left = occ.start.getTime() - now.getTime();
    const here = left <= 0;
    const gregDay = ev.night ? new Date(occ.start.getFullYear(), occ.start.getMonth(), occ.start.getDate() + 1) : occ.start;
    const hijriLabel = ev.hijri && occ.hijriYear ? `${ev.hijri[1]} ${HIJRI_MONTHS[ev.hijri[0] - 1]} ${occ.hijriYear} AH` : null;
    hero = (
      <section aria-labelledby="cd-title">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          {ev.group === "Islamic" ? <Moon className="h-3.5 w-3.5" aria-hidden /> : <Timer className="h-3.5 w-3.5" aria-hidden />}
          {here ? "It's here" : "Countdown to"}
        </p>
        <h2 id="cd-title" className="mt-1 text-2xl font-extrabold sm:text-3xl">
          {ev.name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {ev.night ? `Night of ${shortDate(occ.start)} → ${shortDate(gregDay)}` : longDate(occ.start)}
          {hijriLabel ? ` · ${hijriLabel}` : ""}
          {ev.hijri ? ` · ${moonLabel}` : ""}
        </p>
        <div className="mt-5">{here ? <Arrived text={ev.arrived} sub={ev.note} /> : <Clock ms={left} />}</div>
        {!here && occ.prev && (
          <Progress
            value={(now.getTime() - occ.prev.getTime()) / (occ.start.getTime() - occ.prev.getTime())}
            label={`Since last ${ev.short} (${shortDate(occ.prev)})`}
          />
        )}
        {!here && <p className="mt-4 text-sm text-muted">{ev.note}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondary}
            onClick={() =>
              downloadIcs({
                title: ev.name,
                start: occ.start,
                end: ev.night ? occ.end : new Date(occ.start.getFullYear(), occ.start.getMonth(), occ.start.getDate() + 1),
                allDay: !ev.night,
                description: ev.hijri
                  ? `${hijriLabel ?? ""} (${moonLabel}). The actual date depends on the official moon sighting announcement. ${ev.note}`
                  : ev.note,
                slug,
              })
            }
          >
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add to calendar
          </button>
          <ShareSheet
            title={`${ev.short} countdown`}
            text={
              here
                ? ev.arrived
                : `${split(left).d} days to go until ${ev.short} (${ev.night ? `night of ${shortDate(occ.start)}` : shortDate(occ.start)})`
            }
            label="Share countdown"
            className="ml-auto"
          />
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Today: <span className="font-semibold text-[var(--fg)]">{longDate(now)}</span> ·{" "}
          <span className="font-semibold text-[var(--fg)]">
            {todayHijri.day} {HIJRI_MONTHS[todayHijri.month - 1]} {todayHijri.year} AH
          </span>
        </p>
        <div className="sm:w-80">
          <Toggle
            label="Moon sighting for Islamic dates"
            value={shift}
            onChange={chooseShift}
            options={[
              { value: "1", label: "Pakistan (+1)" },
              { value: "0", label: "Saudi" },
            ]}
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl p-1">{hero}</div>

      <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
        Islamic dates are calculated from the Umm al-Qura calendar. In Pakistan the Ruet-e-Hilal Committee announces each
        month after the moon is sighted, which is often one day after Saudi Arabia — so the real date can differ by a day.
        Countdowns run to midnight in your time zone; nights (Shab-e-Barat, Shab-e-Qadr) count to about 6 pm, near Maghrib.
      </p>

      {/* all events */}
      <h3 className="mt-7 text-lg font-extrabold">{focus ? "More countdowns" : "Choose a countdown"}</h3>
      {(["Islamic", "Pakistan"] as const).map((group) => (
        <div key={group} className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{group === "Islamic" ? "Islamic dates" : "Pakistan & New Year"}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {upcoming
              .filter((x) => x.ev.group === group)
              .map(({ ev, occ }) => {
                const left = occ.start.getTime() - now.getTime();
                const t = split(left);
                const isActive = activeId === ev.id;
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => select(ev.id)}
                      aria-pressed={isActive}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 sm:p-4 ${
                        isActive ? "bg-brand-500/10 ring-2 ring-brand-400/60" : "surface hover:border-brand-400/60"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{ev.short}</span>
                        <span className="block truncate text-xs text-muted">
                          {ev.night ? `Night of ${shortDate(occ.start)}` : shortDate(occ.start)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {left <= 0 ? (
                          <span className="text-sm font-extrabold text-accent-600 dark:text-accent-400">Today</span>
                        ) : (
                          <>
                            <span className="block text-xl font-extrabold tabular-nums">{t.d}</span>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">{t.d === 1 ? "day" : "days"}</span>
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      {/* custom */}
      <form onSubmit={startCustom} className="mt-7 rounded-2xl surface p-4 sm:p-5">
        <h3 className="text-lg font-extrabold">Make your own countdown</h3>
        <p className="mt-1 text-sm text-muted">A wedding, exam, birthday or trip — get a link you can share on WhatsApp.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr_0.8fr]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Name</span>
            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={80} placeholder="e.g. Ali's wedding" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Date</span>
            <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} className={field} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Time (optional)</span>
            <input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className={field} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={primary}>
            <Timer className="h-4 w-4" aria-hidden /> Start countdown
          </button>
          {custom && activeId !== "custom" && (
            <button type="button" onClick={() => select("custom")} className="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">
              Show “{custom.title}”
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Arrived({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 p-6 text-center text-white shadow-xl shadow-brand-500/25 sm:p-8">
      <PartyPopper className="mx-auto h-8 w-8" aria-hidden />
      <p className="mt-3 text-2xl font-extrabold sm:text-3xl" aria-live="polite">
        {text}
      </p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-white/85">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function CountdownStudio({ tool }: { tool: Tool }) {
  const mode = tool.mode ?? "countdown";
  const focus = mode.startsWith("countdown:") ? mode.slice("countdown:".length) : null;
  const valid = focus && EVENTS.some((e) => e.id === focus) ? focus : null;
  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <Countdowns slug={tool.slug} focus={valid} />
        </div>
      </motion.div>
    </div>
  );
}
