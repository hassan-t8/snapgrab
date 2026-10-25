"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Bell,
  BellOff,
  Coins,
  Copy,
  CornerDownLeft,
  Delete,
  Dices,
  Download,
  Flag,
  Info,
  Keyboard,
  Languages,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  Trophy,
  Undo2,
  Vibrate,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import ShareSheet from "@/components/ShareSheet";
import { trackEvent } from "@/lib/track-event";

/* ------------------------------------------------------------------ *
 * shared helpers
 * ------------------------------------------------------------------ */

const fieldBase = "w-full rounded-xl surface px-4 py-2.5 outline-none transition-all focus:border-brand-400";
const field = `${fieldBase} text-sm`;
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl surface px-4 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60 hover:text-brand-400 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

/** Parse a user-typed number; commas and spaces are allowed. */
function num(value: string): number {
  const n = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function clampNum(value: string, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Records one anonymous use per page view, once the tool has really been used. */
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

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        className={`${field} disabled:opacity-60`}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${strong ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white" : "surface"}`}>
      <span className={`block text-xs font-bold uppercase tracking-wider ${strong ? "text-white/80" : "text-muted"}`}>
        {label}
      </span>
      <span className="mt-1 block break-words text-xl font-extrabold tabular-nums sm:text-2xl">{value}</span>
    </div>
  );
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
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all sm:px-4 sm:text-sm ${
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

/** A small on/off pill for settings. */
function Chip({
  on,
  onClick,
  children,
  label,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
        on ? "border-brand-400/60 bg-brand-500/15 text-brand-400" : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Two-tap destructive button: the first tap arms it for three seconds. */
function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Tap again to confirm",
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        window.clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3000);
        }
      }}
      className={`${btnGhost} ${armed ? "!border-red-400/60 !text-red-400" : ""}`}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${
        tone === "warn" ? "border-amber-400/40 bg-amber-400/10" : "border-[var(--line)] bg-brand-500/5"
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "warn" ? "text-amber-400" : "text-brand-400"}`} />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

const RM_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const m = window.matchMedia(RM_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}

function isInteractiveTarget(t: EventTarget | null) {
  return t instanceof HTMLElement && !!t.closest("input, textarea, select, button, a, [contenteditable='true']");
}

/** Window-level shortcuts while `active`. Keys: "space", "enter", "backspace" or a lowercase letter. */
function useHotkeys(active: boolean, map: Record<string, () => void>) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isInteractiveTarget(e.target)) return;
      const fn = ref.current[e.code === "Space" ? "space" : e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

function loadJSON<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function buzz(pattern: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {}
}

/** Unbiased random integer in [0, n) from the platform CSPRNG. */
function randInt(n: number) {
  if (n <= 1) return 0;
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return Math.floor(Math.random() * n);
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % n;
}

async function copyText(text: string, what = "Text") {
  if (!text.trim()) {
    notify.info("Nothing to copy yet");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    ta.remove();
  }
  trackEvent("copy");
  notify.success(`${what} copied`, "Paste it anywhere: WhatsApp, Word, Facebook and more.");
}

function downloadText(text: string, name: string) {
  if (!text.trim()) {
    notify.info("Nothing to download yet");
    return;
  }
  // BOM so Notepad and older Word open Urdu/Arabic text as UTF-8
  const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  trackEvent("download");
}

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const countChars = (t: string) => Array.from(t).length;

/* ---- sound (WebAudio, no files to download) ---- */

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur = 0.05, vol = 0.12, delay = 0, type: OscillatorType = "sine", dest?: AudioNode) {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch {}
}

const chime = () => {
  tone(660, 0.2, 0.18);
  tone(990, 0.35, 0.16, 0.16);
};

/** Schedules an alarm for `seconds` up front (keeps ringing in a background tab); returns a stop function. */
function playAlarm(seconds = 10): () => void {
  const ctx = getAudio();
  if (!ctx) return () => {};
  const master = ctx.createGain();
  master.connect(ctx.destination);
  for (let s = 0; s < seconds; s++) {
    for (let k = 0; k < 3; k++) tone(k === 2 ? 1320 : 990, 0.15, 0.3, s + k * 0.2, "triangle", master);
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.disconnect();
    } catch {}
  };
}

async function showNotice(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, icon: "/icon.svg" });
    } catch {
      // Android Chrome only allows notifications through a service worker
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.showNotification(title, { body, icon: "/icon.svg" });
    }
  } catch {}
}

/* ---- Urdu / Arabic fonts ---- */

const SCRIPT_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap";
const NASTALIQ = `"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Urdu Typesetting", serif`;
const NASKH = `"Noto Naskh Arabic", "Jameel Noori Nastaleeq", "Segoe UI", "Traditional Arabic", serif`;

/** Loads the Urdu/Arabic web fonts once, after mount (the only external request in this file). */
function useScriptFonts() {
  useEffect(() => {
    if (document.querySelector("link[data-sg-script-fonts]")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = SCRIPT_FONT_HREF;
    css.dataset.sgScriptFonts = "1";
    document.head.append(pre, css);
  }, []);
}

/* ---- progress ring ---- */

function Ring({
  progress,
  width = "min(260px, 74vw)",
  children,
}: {
  progress: number;
  width?: string;
  children: ReactNode;
}) {
  const gid = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const r = 45;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative grid aspect-square place-items-center" style={{ width }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-accent-400)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="5" style={{ stroke: "var(--line)" }} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <div className="relative flex flex-col items-center text-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Urdu keyboard — Roman Urdu / phonetic typing
 * ------------------------------------------------------------------ *
 *
 * Two input styles share one map:
 *
 * "Phonetic keys" — every English key gives one Urdu letter (the usual Pak phonetic layout):
 *   a ا  A آ  b ب  p پ  t ت  T ٹ  C ث  j ج  c چ  H ح  K خ  d د  D ڈ  X ذ  r ر  R ڑ  z ز  Z ژ
 *   s س  x ش  S ص  J ض  v ط  V ظ  e ع  G غ  f ف  q ق  k ک  g گ  l ل  m م  n ن  N ں  w/o و
 *   h ہ  u ء  y/i ی  Y ے  U ئ  W ؤ  O ۃ
 *   Combos: kh خ, gh غ, sh ش, ch چ, zh ژ; h after ب پ ت ٹ ج چ د ڈ ر ڑ ک گ gives ھ (bh بھ, Th ٹھ);
 *   khh کھ, ghh گھ, chh چھ for the aspirated forms.
 *
 * "Roman Urdu (smart)" — for people who write Urdu in English letters ("mera naam Ali hai"):
 *   the same consonants (case-insensitive for normal capitalisation; mid-word capitals keep
 *   T ٹ D ڈ R ڑ S ص …), vowels by position (a/i/u short and dropped mid-word, aa/ee/oo long,
 *   e → ی mid-word and ے at the end, final -en/-on → ں), plus a dictionary of ~300 everyday
 *   words whose spelling can't be guessed (hai ہے, nahi نہیں, khana کھانا …).
 *
 * Words convert when you finish them (space, punctuation or Enter), which plays nicely with
 * phone keyboards that compose a whole word before committing it.
 */

const PHONETIC: Record<string, string> = {
  a: "ا", A: "آ", b: "ب", B: "ب", c: "چ", C: "ث", d: "د", D: "ڈ", e: "ع", E: "ع", f: "ف", F: "ف",
  g: "گ", G: "غ", h: "ہ", H: "ح", i: "ی", I: "ی", j: "ج", J: "ض", k: "ک", K: "خ", l: "ل", L: "ل",
  m: "م", M: "م", n: "ن", N: "ں", o: "و", O: "ۃ", p: "پ", P: "پ", q: "ق", Q: "ق", r: "ر", R: "ڑ",
  s: "س", S: "ص", t: "ت", T: "ٹ", u: "ء", U: "ئ", v: "ط", V: "ظ", w: "و", W: "ؤ", x: "ش", X: "ذ",
  y: "ی", Y: "ے", z: "ز", Z: "ژ",
};

const ASPIRABLE = new Set(["ب", "پ", "ت", "ٹ", "ج", "چ", "د", "ڈ", "ر", "ڑ", "ک", "گ"]);

const EXACT_DIGRAPHS: [string, string][] = [
  ["khh", "کھ"], ["ghh", "گھ"], ["chh", "چھ"],
  ["kh", "خ"], ["gh", "غ"], ["sh", "ش"], ["ch", "چ"], ["zh", "ژ"],
];

function exactWord(w: string) {
  let out = "";
  for (let i = 0; i < w.length; ) {
    if (w[i] === "'") {
      i++; // separator: k'h → کہ
      continue;
    }
    const rest = w.slice(i);
    const dg = EXACT_DIGRAPHS.find(([k]) => rest.startsWith(k));
    if (dg) {
      out += dg[1];
      i += dg[0].length;
      continue;
    }
    const ch = w[i];
    if (ch === "h" && out && ASPIRABLE.has(out[out.length - 1])) out += "ھ";
    else out += PHONETIC[ch] ?? ch;
    i++;
  }
  return out;
}

const SMART_DIGRAPHS: [string, string][] = [
  ["khh", "کھ"], ["ghh", "گھ"], ["chh", "چھ"],
  ["kh", "خ"], ["gh", "غ"], ["sh", "ش"], ["ch", "چ"], ["zh", "ژ"],
  ["bh", "بھ"], ["ph", "پھ"], ["th", "تھ"], ["Th", "ٹھ"], ["dh", "دھ"], ["Dh", "ڈھ"], ["jh", "جھ"],
  ["rh", "ڑھ"], ["Rh", "ڑھ"],
];

const SMART_LETTERS: Record<string, string> = {
  b: "ب", p: "پ", t: "ت", j: "ج", c: "ک", d: "د", r: "ر", z: "ز", s: "س", f: "ف", q: "ق", k: "ک",
  g: "گ", l: "ل", m: "م", n: "ن", v: "و", w: "و", h: "ہ", y: "ی", x: "ش",
};

const VOWEL_KEYS = ["aa", "ee", "ii", "oo", "ai", "au", "ou", "ei", "a", "e", "i", "o", "u"];
const START_V: Record<string, string> = { a: "ا", aa: "آ", i: "ا", ee: "ای", ii: "ای", e: "ای", ai: "ای", ei: "ای", o: "او", oo: "او", au: "او", ou: "او", u: "ا" };
const MID_V: Record<string, string> = { a: "", aa: "ا", i: "", ee: "ی", ii: "ی", e: "ی", ai: "ی", ei: "ی", o: "و", oo: "و", au: "و", ou: "و", u: "" };
const MID_AFTER_V: Record<string, string> = { a: "ا", aa: "ا", i: "ئ", ee: "ئی", ii: "ئی", e: "ئ", ai: "ئی", ei: "ئی", o: "ؤ", oo: "ؤ", au: "ؤ", ou: "ؤ", u: "ؤ" };
const END_V: Record<string, string> = { a: "ا", aa: "ا", i: "ی", ee: "ی", ii: "ی", e: "ے", ai: "ئی", ei: "ے", o: "و", oo: "و", au: "و", ou: "و", u: "و" };
const END_AFTER_V: Record<string, string> = { a: "ا", aa: "ا", i: "ئی", ee: "ئی", ii: "ئی", e: "ئے", ai: "ئی", ei: "ئے", o: "ؤ", oo: "ؤ", au: "ؤ", ou: "ؤ", u: "ؤ" };

const ROMAN_WORDS: Record<string, string> = Object.fromEntries(
  (
    "hai=ہے|hain=ہیں|hay=ہے|ho=ہو|hoon=ہوں|hun=ہوں|hu=ہوں|hua=ہوا|hui=ہوئی|hue=ہوئے|huay=ہوئے|main=میں|mein=میں|mai=میں|me=میں|" +
    "mujhe=مجھے|mujh=مجھ|mera=میرا|meri=میری|mere=میرے|tera=تیرا|teri=تیری|tere=تیرے|tu=تو|tum=تم|tumhe=تمہیں|tumhen=تمہیں|" +
    "tumhara=تمہارا|tumhari=تمہاری|tumhare=تمہارے|aap=آپ|ap=آپ|apna=اپنا|apni=اپنی|apne=اپنے|hum=ہم|hamein=ہمیں|humein=ہمیں|" +
    "hamara=ہمارا|hamari=ہماری|hamare=ہمارے|wo=وہ|woh=وہ|vo=وہ|voh=وہ|ye=یہ|yeh=یہ|yah=یہ|is=اس|us=اس|in=ان|un=ان|unhon=انہوں|" +
    "inhon=انہوں|ka=کا|ki=کی|ke=کے|ko=کو|se=سے|say=سے|par=پر|pe=پہ|per=پر|aur=اور|or=اور|ya=یا|bhi=بھی|nahi=نہیں|nahin=نہیں|" +
    "nhi=نہیں|na=نہ|mat=مت|kya=کیا|kia=کیا|kyun=کیوں|kyon=کیوں|kyu=کیوں|kiyun=کیوں|kaise=کیسے|kaisa=کیسا|kaisi=کیسی|kab=کب|" +
    "kahan=کہاں|yahan=یہاں|wahan=وہاں|jahan=جہاں|kahin=کہیں|yahin=یہیں|wahin=وہیں|kaun=کون|kon=کون|kitna=کتنا|kitni=کتنی|" +
    "kitne=کتنے|ab=اب|abhi=ابھی|phir=پھر|fir=پھر|sab=سب|kuch=کچھ|kuchh=کچھ|bohat=بہت|bahut=بہت|bohot=بہت|buhat=بہت|acha=اچھا|" +
    "achha=اچھا|accha=اچھا|achi=اچھی|achhi=اچھی|ache=اچھے|achhe=اچھے|achay=اچھے|theek=ٹھیک|thik=ٹھیک|shukriya=شکریہ|shukria=شکریہ|" +
    "salam=سلام|assalam=السلام|assalamualaikum=السلام علیکم|alaikum=علیکم|walaikum=وعلیکم|allah=اللہ|khuda=خدا|nabi=نبی|" +
    "pakistan=پاکستان|pakistani=پاکستانی|lahore=لاہور|karachi=کراچی|islamabad=اسلام آباد|urdu=اردو|angrezi=انگریزی|dil=دل|" +
    "pyar=پیار|pyaar=پیار|ishq=عشق|mohabbat=محبت|muhabbat=محبت|dost=دوست|dosti=دوستی|ghar=گھر|khana=کھانا|khaana=کھانا|" +
    "pani=پانی|paani=پانی|din=دن|raat=رات|rat=رات|aaj=آج|aj=آج|kal=کل|waqt=وقت|saal=سال|mahina=مہینہ|hafta=ہفتہ|log=لوگ|" +
    "logon=لوگوں|insan=انسان|insaan=انسان|zindagi=زندگی|duniya=دنیا|dunya=دنیا|kaam=کام|kam=کم|baat=بات|bat=بات|dekh=دیکھ|" +
    "dekho=دیکھو|dekha=دیکھا|dekhi=دیکھی|dekhna=دیکھنا|dekhte=دیکھتے|dekhiye=دیکھیے|rakh=رکھ|rakho=رکھو|rakhna=رکھنا|likh=لکھ|" +
    "likho=لکھو|likha=لکھا|likhna=لکھنا|khel=کھیل|khelna=کھیلنا|khol=کھول|kholo=کھولو|khula=کھلا|khud=خود|khush=خوش|khushi=خوشی|" +
    "khabar=خبر|khatam=ختم|khoobsurat=خوبصورت|khubsurat=خوبصورت|khwab=خواب|khayal=خیال|khyal=خیال|kar=کر|karo=کرو|karna=کرنا|" +
    "karta=کرتا|karti=کرتی|karte=کرتے|kiya=کیا|gaya=گیا|gayi=گئی|gaye=گئے|tha=تھا|thi=تھی|the=تھے|thay=تھے|jee=جی|ji=جی|" +
    "haan=ہاں|han=ہاں|nam=نام|naam=نام|shaam=شام|subah=صبح|subha=صبح|school=اسکول|inshallah=ان شاء اللہ|mashallah=ماشاء اللہ|" +
    "alhamdulillah=الحمدللہ|subhanallah=سبحان اللہ|bismillah=بسم اللہ|jazakallah=جزاک اللہ|astaghfirullah=استغفراللہ|" +
    "ramzan=رمضان|ramadan=رمضان|eid=عید|namaz=نماز|roza=روزہ|masjid=مسجد|sirf=صرف|sath=ساتھ|saath=ساتھ|liye=لیے|liay=لیے|" +
    "lie=لیے|wala=والا|wali=والی|wale=والے|sakta=سکتا|sakti=سکتی|sakte=سکتے|raha=رہا|rahi=رہی|rahe=رہے|hota=ہوتا|hoti=ہوتی|" +
    "hote=ہوتے|chahiye=چاہیے|chahie=چاہیے|pehle=پہلے|pehla=پہلا|baad=بعد|jab=جب|tab=تب|agar=اگر|magar=مگر|lekin=لیکن|" +
    "kyunke=کیونکہ|kyunki=کیونکہ|kyonke=کیونکہ|kyonki=کیونکہ|sahi=صحیح|galat=غلط|ghalat=غلط|zaroor=ضرور|zarur=ضرور|" +
    "zaroori=ضروری|maaf=معاف|maafi=معافی|ilm=علم|aankh=آنکھ|aankhen=آنکھیں|bhai=بھائی|behan=بہن|ammi=امی|abbu=ابو|ami=امی|" +
    "abu=ابو|beta=بیٹا|beti=بیٹی|larka=لڑکا|larki=لڑکی|ladka=لڑکا|ladki=لڑکی|bara=بڑا|bari=بڑی|bare=بڑے|bada=بڑا|chota=چھوٹا|" +
    "choti=چھوٹی|chote=چھوٹے|chhota=چھوٹا|parh=پڑھ|parho=پڑھو|parhna=پڑھنا|padh=پڑھ|padho=پڑھو|padhna=پڑھنا|mubarak=مبارک|" +
    "salgira=سالگرہ|saalgirah=سالگرہ|jawab=جواب|sawal=سوال|kitab=کتاب|zaban=زبان|zuban=زبان|watan=وطن|qaum=قوم|mulk=ملک|" +
    "shehar=شہر|shehr=شہر|gaon=گاؤں|sadak=سڑک|paisa=پیسہ|paise=پیسے|rupay=روپے|rupee=روپے|naya=نیا|nayi=نئی|naye=نئے|" +
    "purana=پرانا|jaldi=جلدی|ahista=آہستہ|aahista=آہستہ|zyada=زیادہ|ziada=زیادہ|thora=تھوڑا|thoda=تھوڑا|kabhi=کبھی|" +
    "hamesha=ہمیشہ|yaar=یار|yar=یار|jaan=جان|jan=جان|maa=ماں|baap=باپ|bachay=بچے|bache=بچے|bacha=بچہ|bachcha=بچہ|aao=آؤ|" +
    "jao=جاؤ|jana=جانا|aana=آنا|ana=آنا|gana=گانا|suno=سنو|bolo=بولو|bol=بول|samajh=سمجھ|samjho=سمجھو|samjha=سمجھا|pata=پتا|" +
    "matlab=مطلب|shayad=شاید|wapas=واپس|andar=اندر|bahar=باہر|upar=اوپر|neeche=نیچے|niche=نیچے|samne=سامنے|peeche=پیچھے|" +
    "pass=پاس|paas=پاس|door=دور|dur=دور|sach=سچ|jhoot=جھوٹ|mushkil=مشکل|asaan=آسان|aasan=آسان|umeed=امید|ummeed=امید|" +
    "dua=دعا|duaa=دعا|shadi=شادی|shaadi=شادی|mehman=مہمان|hafiz=حافظ|ahmed=احمد|ahmad=احمد|ali=علی|muhammad=محمد|" +
    "mohammad=محمد|fatima=فاطمہ|ayesha=عائشہ|aisha=عائشہ|hassan=حسن|hasan=حسن|hussain=حسین|husain=حسین|umar=عمر|" +
    "usman=عثمان|zainab=زینب|bilal=بلال|imran=عمران|abdullah=عبداللہ|aye=آئے|aaye=آئے|aya=آیا|aaya=آیا|ayi=آئی|aayi=آئی"
  )
    .split("|")
    .map((p) => p.split("=") as [string, string]),
);

type UTok = { vowel: boolean; s: string; raw: string };

function smartWord(input: string): string {
  let w = input;
  // "Mera" (sentence case) or "MERA" are not retroflex letters — only mid-word capitals are
  if (/^[A-Z][a-z']+$/.test(w) || /^[A-Z']{2,}$/.test(w)) w = w.toLowerCase();
  const plain = w.replace(/'/g, "");
  if (w === w.toLowerCase() && ROMAN_WORDS[plain]) return ROMAN_WORDS[plain];

  const toks: UTok[] = [];
  for (let i = 0; i < w.length; ) {
    if (w[i] === "'") {
      toks.push({ vowel: false, s: "", raw: "'" });
      i++;
      continue;
    }
    const rest = w.slice(i);
    const dg = SMART_DIGRAPHS.find(([k]) => rest.startsWith(k));
    if (dg) {
      toks.push({ vowel: false, s: dg[1], raw: dg[0] });
      i += dg[0].length;
      continue;
    }
    const vk = VOWEL_KEYS.find((k) => rest.startsWith(k));
    if (vk) {
      toks.push({ vowel: true, s: vk, raw: vk });
      i += vk.length;
      continue;
    }
    const ch = w[i];
    toks.push({ vowel: false, s: SMART_LETTERS[ch] ?? PHONETIC[ch] ?? ch, raw: ch });
    i++;
  }

  let out = "";
  const last = toks.length - 1;
  toks.forEach((t, k) => {
    const prev = toks[k - 1];
    const next = toks[k + 1];
    if (!t.vowel) {
      if (prev && !prev.vowel && t.s && prev.s === t.s && t.s !== "ن") return; // kutta → کتا
      if (t.raw === "y" && prev?.vowel && next?.vowel && /^(e|ee|i|ii|ei)$/.test(next.s)) {
        out += "ئ"; // aaye → آئے, liye → لئے
        return;
      }
      if (t.raw === "y" && k === last && k > 1 && prev?.vowel && prev.s === "a") {
        out += "ے"; // kay → کے
        return;
      }
      if (t.raw === "n" && k === last && k > 1 && prev?.vowel && /^(e|ei|o)$/.test(prev.s)) {
        out += "ں"; // karen → کریں, logon → لوگوں
        return;
      }
      out += t.s;
      return;
    }
    const afterVowel = prev?.vowel === true;
    if (k === 0) out += START_V[t.s] ?? "";
    else if (k === last) out += (afterVowel ? END_AFTER_V : END_V)[t.s] ?? "";
    else if (afterVowel) out += MID_AFTER_V[t.s] ?? "";
    else if (t.s === "e" && next?.raw === "h") return; // pehla → پہلا
    else if (t.s === "a" && prev?.raw === "y" && toks[k - 2] && !toks[k - 2].vowel) out += "ا"; // pyar → پیار
    else out += MID_V[t.s] ?? "";
  });
  return out;
}

type UrduMode = "smart" | "exact";
type UrduOpts = { mode: UrduMode; digits: boolean; punct: boolean };
const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const URDU_PUNCT: Record<string, string> = { ".": "۔", ",": "،", "?": "؟", ";": "؛" };

const transliterate = (word: string, mode: UrduMode) => (mode === "smart" ? smartWord(word) : exactWord(word));

/**
 * Converts the Latin words the user has just finished typing. `ins` is the range that changed,
 * `pending` the start of the word that was still being typed. The word under the caret stays
 * Latin (shown as a preview) until it is finished, unless `finalize` is set.
 */
function applyUrdu(
  value: string,
  caret: number,
  ins: [number, number],
  pending: number | null,
  o: UrduOpts,
  finalize: boolean,
) {
  let v = value;
  if (ins[1] > ins[0] && (o.digits || o.punct)) {
    let mid = "";
    for (let i = ins[0]; i < ins[1]; i++) {
      const c = v[i];
      const before = i > 0 ? v[i - 1] : "";
      if (o.digits && c >= "0" && c <= "9") mid += URDU_DIGITS[Number(c)];
      else if (o.punct && URDU_PUNCT[c] && !/[0-9۰-۹]/.test(before)) mid += URDU_PUNCT[c];
      else mid += c;
    }
    v = v.slice(0, ins[0]) + mid + v.slice(ins[1]);
  }

  let out = "";
  let last = 0;
  let newCaret = caret;
  let nextPending: number | null = null;
  let preview: { roman: string; urdu: string } | null = null;
  for (const m of v.matchAll(/[A-Za-z']+/g)) {
    const word = m[0];
    const start = m.index ?? 0;
    const end = start + word.length;
    out += v.slice(last, start);
    last = end;
    const fresh = (start < ins[1] && end > ins[0]) || start === pending;
    if (!fresh || !/[A-Za-z]/.test(word)) {
      out += word;
      continue;
    }
    const urdu = transliterate(word, o.mode);
    if (!finalize && caret >= start && caret <= end) {
      nextPending = out.length;
      preview = { roman: word, urdu };
      out += word;
      continue;
    }
    out += urdu;
    if (end <= caret) newCaret += urdu.length - word.length;
  }
  out += v.slice(last);
  return { text: out, caret: newCaret, pending: nextPending, preview };
}

const URDU_KEYS = "ا آ ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن ں و ہ ھ ء ی ے ئ ؤ ۃ".split(" ");
const URDU_MARKS: [string, string][] = [
  ["َ", "Zabar"], ["ِ", "Zer"], ["ُ", "Pesh"], ["ّ", "Shad"], ["ً", "Do zabar"], ["ٰ", "Khari zabar"], ["ٔ", "Hamza"],
];
const URDU_PUNCT_KEYS = ["۔", "،", "؟", "!", "؛", "٪"];

const CHEAT_KEYS = "a A b p t T C j c H K d D X r R z Z s x S J v V e G f q k g l m n N w h u y Y U W O".split(" ");
const CHEAT_COMBOS: [string, string][] = [
  ["kh", "خ"], ["gh", "غ"], ["sh", "ش"], ["ch", "چ"], ["bh", "بھ"], ["ph", "پھ"], ["th", "تھ"], ["Th", "ٹھ"],
  ["dh", "دھ"], ["Dh", "ڈھ"], ["jh", "جھ"], ["khh", "کھ"], ["ghh", "گھ"], ["chh", "چھ"],
];
const SMART_EXAMPLES: [string, string][] = [
  ["mera naam Ali hai", "میرا نام علی ہے"],
  ["aap kaise hain?", "آپ کیسے ہیں؟"],
  ["kitaab, dost, zameen", "کتاب، دوست، زمین"],
  ["laRka, ThanDa", "لڑکا، ٹھنڈا"],
  ["dekhho (khh = کھ)", "دیکھو"],
];

function UrduCheatSheet() {
  return (
    <details className="group mt-5 rounded-2xl surface p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold">
        <span className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-brand-400" /> Typing guide: which key gives which letter
        </span>
        <span className="text-xs text-muted group-open:hidden">Show</span>
        <span className="hidden text-xs text-muted group-open:inline">Hide</span>
      </summary>
      <div className="mt-4 space-y-4 text-sm">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Roman Urdu examples</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SMART_EXAMPLES.map(([r, u]) => (
              <li key={r} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-soft)] px-3 py-2">
                <code className="text-xs">{r}</code>
                <span dir="rtl" lang="ur" className="text-lg" style={{ fontFamily: NASKH }}>
                  {u}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Double long vowels (aa, ee, oo). Capitals give ٹ ڈ ڑ ص (laRka, ThanDa); a single capital at the start of
            a word counts as normal capitalisation. N gives noon ghunna ں. Common words like hai, nahi, khana and bohat
            are spelled from a built-in dictionary.
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Phonetic keys (one key = one letter)</p>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
            {CHEAT_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-[var(--bg-soft)] px-2 py-1.5">
                <code className="text-xs font-bold">{k}</code>
                <span className="text-lg leading-none" style={{ fontFamily: NASKH }}>
                  {PHONETIC[k]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Letter combinations</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {CHEAT_COMBOS.map(([k, u]) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-[var(--bg-soft)] px-2 py-1.5">
                <code className="text-xs font-bold">{k}</code>
                <span className="text-lg leading-none" style={{ fontFamily: NASKH }}>
                  {u}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Punctuation: . , ? ; become ۔ ، ؟ ؛ automatically. Type an apostrophe to stop two letters joining (k&apos;h
            gives کہ).
          </p>
        </div>
      </div>
    </details>
  );
}

const URDU_SIZES = ["text-xl", "text-2xl", "text-3xl"];

type UrduSaved = { text?: string; mode?: UrduMode; font?: "nastaliq" | "naskh"; size?: number; digits?: boolean };

function UrduKeyboard({ slug }: { slug: string }) {
  useScriptFonts();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<UrduMode>("smart");
  const [urduOn, setUrduOn] = useState(true);
  const [digits, setDigits] = useState(false);
  const [punct, setPunct] = useState(true);
  const [font, setFont] = useState<"nastaliq" | "naskh">("nastaliq");
  const [size, setSize] = useState(1);
  const [osk, setOsk] = useState(false);
  const [showMarks, setShowMarks] = useState(false);
  const [preview, setPreview] = useState<{ roman: string; urdu: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef<number | null>(null);
  const caretRef = useRef<number | null>(null);
  const opts: UrduOpts = { mode, digits, punct };

  useTrackOnce(slug, /[؀-ۿ]/.test(text));

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const s = loadJSON<UrduSaved>("sg-urdu-keyboard");
      if (s) {
        if (typeof s.text === "string") setText(s.text);
        if (s.mode === "smart" || s.mode === "exact") setMode(s.mode);
        if (s.font === "nastaliq" || s.font === "naskh") setFont(s.font);
        if (typeof s.size === "number") setSize(Math.min(2, Math.max(0, s.size)));
        if (typeof s.digits === "boolean") setDigits(s.digits);
      }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (loaded) saveJSON("sg-urdu-keyboard", { text, mode, font, size, digits } satisfies UrduSaved);
  }, [loaded, text, mode, font, size, digits]);

  // put the caret back after a word was converted (its length changed)
  useLayoutEffect(() => {
    const c = caretRef.current;
    const el = taRef.current;
    if (c === null || !el) return;
    caretRef.current = null;
    el.setSelectionRange(c, c);
  }, [text]);

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    const value = el.value;
    const caret = el.selectionStart ?? value.length;
    const composing = (e.nativeEvent as InputEvent).isComposing === true;
    if (!urduOn || composing) {
      setText(value);
      return;
    }
    const prev = text;
    const lim = Math.min(prev.length, value.length);
    let a = 0;
    while (a < lim && prev[a] === value[a]) a++;
    let b = 0;
    while (b < lim - a && prev[prev.length - 1 - b] === value[value.length - 1 - b]) b++;
    let pending = pendingRef.current;
    if (pending !== null && a < pending) pending += value.length - prev.length;
    const r = applyUrdu(value, caret, [a, value.length - b], pending, opts, false);
    pendingRef.current = r.pending;
    setPreview(r.preview);
    setText(r.text);
    if (r.text !== value) caretRef.current = r.caret;
  }

  /** Converts the word still being typed (before copying, on blur, before an on-screen key). */
  function finalize(value: string, caret: number) {
    const p = pendingRef.current;
    if (p === null) return { text: value, caret };
    const r = applyUrdu(value, caret, [0, 0], p, opts, true);
    pendingRef.current = null;
    setPreview(null);
    return { text: r.text, caret: r.caret };
  }

  function onBlur() {
    const el = taRef.current;
    const f = finalize(text, el?.selectionStart ?? text.length);
    if (f.text !== text) setText(f.text);
  }

  function press(key: string) {
    const el = taRef.current;
    const s0 = el?.selectionStart ?? text.length;
    const e0 = el?.selectionEnd ?? text.length;
    const f = finalize(text, s0);
    let v = f.text;
    let s = f.caret;
    const e = s0 === e0 ? s : e0 + (f.caret - s0);
    if (key === "\b") {
      if (s !== e) v = v.slice(0, s) + v.slice(e);
      else if (s > 0) {
        v = v.slice(0, s - 1) + v.slice(s);
        s -= 1;
      }
    } else {
      v = v.slice(0, s) + key + v.slice(e);
      s += key.length;
    }
    setText(v);
    caretRef.current = s;
  }

  function current() {
    const f = finalize(text, taRef.current?.selectionStart ?? text.length);
    if (f.text !== text) setText(f.text);
    return f.text;
  }

  const fontFamily = font === "nastaliq" ? NASTALIQ : NASKH;
  const keyBtn =
    "grid min-h-11 place-items-center rounded-xl surface text-xl font-semibold transition-colors hover:border-brand-400/60 hover:text-brand-400 active:scale-95 active:bg-brand-500/15";
  const keep = (e: { preventDefault: () => void }) => e.preventDefault(); // keep focus in the text box

  return (
    <>
      <Toggle
        label="Typing style"
        value={mode}
        onChange={(m) => {
          setMode(m);
          taRef.current?.focus();
        }}
        options={[
          { value: "smart", label: "Roman Urdu (smart)" },
          { value: "exact", label: "Phonetic keys" },
        ]}
      />
      <p className="mt-2 text-xs text-muted">
        {mode === "smart"
          ? "Write Urdu the way you text it in English letters: mera naam Ali hai. Each word turns into Urdu when you press space."
          : "Every English key gives one Urdu letter, like the phonetic keyboard on a PC: a → ا, b → ب, T → ٹ. See the guide below."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip on={urduOn} onClick={() => setUrduOn((v) => !v)} label="Urdu typing on or off">
          <Languages className="h-3.5 w-3.5" /> {urduOn ? "Urdu typing on" : "English (off)"}
        </Chip>
        <Chip on={punct} onClick={() => setPunct((v) => !v)}>
          Urdu ۔ ، ؟
        </Chip>
        <Chip on={digits} onClick={() => setDigits((v) => !v)}>
          Urdu digits ۱۲۳
        </Chip>
        <Chip on={font === "nastaliq"} onClick={() => setFont((f) => (f === "nastaliq" ? "naskh" : "nastaliq"))}>
          {font === "nastaliq" ? "Nastaliq font" : "Naskh font"}
        </Chip>
        <Chip on={false} onClick={() => setSize((s) => (s + 1) % 3)} label="Change text size">
          <span className="text-[10px]">A</span>
          <span className="text-sm">A</span> Size
        </Chip>
        <Chip on={osk} onClick={() => setOsk((v) => !v)} label="Use the on-screen Urdu keyboard only">
          <Keyboard className="h-3.5 w-3.5" /> On-screen keys only
        </Chip>
      </div>

      <textarea
        ref={taRef}
        value={text}
        onChange={onChange}
        onBlur={onBlur}
        dir="rtl"
        lang="ur"
        rows={6}
        inputMode={osk ? "none" : "text"}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type here in English letters, e.g. mera naam Ali hai"
        aria-label="Urdu text"
        className={`${fieldBase} mt-4 min-h-[200px] resize-y text-right placeholder:text-base ${URDU_SIZES[size]} ${
          font === "nastaliq" ? "leading-[2.4]" : "leading-[1.9]"
        }`}
        style={{ fontFamily }}
      />

      <div className="mt-2 flex min-h-9 flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {countChars(text).toLocaleString()} characters · {countWords(text).toLocaleString()} words
        </span>
        {preview ? (
          <span className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-2.5 py-1 text-[var(--fg)]" aria-live="polite">
            <code>{preview.roman}</code> →
            <span dir="rtl" className="text-base leading-none" style={{ fontFamily: NASKH }}>
              {preview.urdu}
            </span>
            <span className="text-muted">space</span>
          </span>
        ) : (
          <span>{urduOn ? "Tip: double the vowel for long sounds, kitaab → کتاب" : "Urdu typing is off: English stays as typed"}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => void copyText(current(), "Urdu text")}>
          <Copy className="h-4 w-4" /> Copy
        </button>
        <button type="button" className={btnGhost} onClick={() => downloadText(current(), "urdu-text.txt")}>
          <Download className="h-4 w-4" /> Download .txt
        </button>
        <ShareSheet
          title="Urdu text"
          text={text.trim() ? text.slice(0, 280) : "Type in Urdu online, free, with SnapGrab's Urdu keyboard"}
        />
        <ConfirmButton
          disabled={!text}
          onConfirm={() => {
            setText("");
            pendingRef.current = null;
            setPreview(null);
            taRef.current?.focus();
          }}
        >
          <Trash2 className="h-4 w-4" /> Clear
        </ConfirmButton>
      </div>

      <div className="mt-5 rounded-2xl surface p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Keyboard className="h-4 w-4 text-brand-400" /> Urdu keyboard
          </p>
          <button
            type="button"
            onClick={() => setShowMarks((v) => !v)}
            aria-pressed={showMarks}
            className="rounded-lg px-2 py-1 text-xs font-bold text-muted hover:text-[var(--fg)]"
          >
            {showMarks ? "Hide aerab" : "Show aerab (zabar, zer …)"}
          </button>
        </div>
        <div dir="rtl" className="grid grid-cols-8 gap-1.5 sm:grid-cols-11" style={{ fontFamily: NASKH }}>
          {URDU_KEYS.map((k) => (
            <button key={k} type="button" onMouseDown={keep} onClick={() => press(k)} className={keyBtn} aria-label={`Type ${k}`}>
              {k}
            </button>
          ))}
          {showMarks &&
            URDU_MARKS.map(([k, name]) => (
              <button key={k} type="button" onMouseDown={keep} onClick={() => press(k)} className={keyBtn} aria-label={name} title={name}>
                {"◌" + k}
              </button>
            ))}
          {URDU_PUNCT_KEYS.map((k) => (
            <button key={k} type="button" onMouseDown={keep} onClick={() => press(k)} className={keyBtn} aria-label={`Type ${k}`}>
              {k}
            </button>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-[1fr_3fr_1fr] gap-1.5">
          <button type="button" onMouseDown={keep} onClick={() => press("\n")} className={keyBtn} aria-label="New line">
            <CornerDownLeft className="h-5 w-5" />
          </button>
          <button type="button" onMouseDown={keep} onClick={() => press(" ")} className={`${keyBtn} text-sm`} aria-label="Space">
            space
          </button>
          <button type="button" onMouseDown={keep} onClick={() => press("\b")} className={keyBtn} aria-label="Backspace">
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>

      <UrduCheatSheet />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 2. Voice typing — Web Speech API
 * ------------------------------------------------------------------ */

type SRAlt = { transcript: string };
type SRResult = { isFinal: boolean; length: number; [i: number]: SRAlt };
type SREvent = Event & { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SRErrorEvent = Event & { error: string; message?: string };
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SR_LANGS = [
  { code: "ur-PK", label: "Urdu (Pakistan)" },
  { code: "ur-IN", label: "Urdu (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ar-SA", label: "Arabic (Saudi Arabia)" },
  { code: "ar-EG", label: "Arabic (Egypt)" },
  { code: "pa-IN", label: "Punjabi (Gurmukhi)" },
  { code: "bn-BD", label: "Bengali" },
  { code: "fa-IR", label: "Persian" },
  { code: "tr-TR", label: "Turkish" },
  { code: "id-ID", label: "Indonesian" },
  { code: "ms-MY", label: "Malay" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
];

const isRtlLang = (code: string) => /^(ur|ar|fa)/.test(code);

function punctFor(lang: string) {
  if (lang.startsWith("ur")) return { stop: "۔", comma: "،", q: "؟" };
  if (lang.startsWith("ar") || lang.startsWith("fa")) return { stop: ".", comma: "،", q: "؟" };
  if (lang.startsWith("hi") || lang.startsWith("pa") || lang.startsWith("bn")) return { stop: "।", comma: ",", q: "?" };
  return { stop: ".", comma: ",", q: "?" };
}

/** Spoken punctuation ("full stop", "comma", "new line", Urdu "فل سٹاپ" …) and sentence capitals. */
function tidySpeech(t: string, lang: string, base: string) {
  if (!t) return "";
  const P = punctFor(lang);
  const rules: [RegExp, string][] = [
    [/\s*\b(full stop|period)\b/gi, P.stop],
    [/\s*\bcomma\b/gi, P.comma],
    [/\s*\bquestion mark\b/gi, P.q],
    [/\s*\bexclamation (mark|point)\b/gi, "!"],
    [/\s*\bnew paragraph\b\s*/gi, "\n\n"],
    [/\s*\bnew line\b\s*/gi, "\n"],
    [/\s*(فل اسٹاپ|فل سٹاپ|فُل اسٹاپ)/g, "۔"],
    [/\s*(کوما|کاما)/g, "،"],
    [/\s*سوالیہ نشان/g, "؟"],
    [/\s*(نئی لائن|نئی سطر)\s*/g, "\n"],
  ];
  let s = t;
  for (const [re, rep] of rules) s = s.replace(re, rep);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  if (/^[a-z]{2}/.test(lang) && /^(en|es|fr|de|tr|id|ms)/.test(lang)) {
    s = s.replace(/([.!?]\s+)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
    if (!base.trim() || /[.!?\n]\s*$/.test(base)) s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

function joinSpeech(base: string, add: string) {
  if (!add) return base;
  if (!base) return add;
  if (/\s$/.test(base) || /^[\s.,!?۔،؟।]/.test(add)) return base + add;
  return `${base} ${add}`;
}

const SR_ERRORS: Record<string, string> = {
  "not-allowed":
    "Microphone access is blocked. Tap the lock or settings icon next to the address bar, allow the microphone for this site, then try again. On iPhone: Settings → Safari → Microphone → Allow.",
  "service-not-allowed":
    "Your browser has turned off its speech service for this page. Try Chrome or Edge, and make sure the microphone is allowed for this site.",
  "audio-capture": "No microphone was found. Plug one in, or check that no other app is using it, and try again.",
  network:
    "Voice typing needs an internet connection: your browser sends the audio to its own speech service (Google in Chrome, Apple in Safari) to turn it into text.",
  "language-not-supported": "This browser can't recognise that language yet. Try Chrome, or pick another language.",
  "start-failed": "Could not start the microphone. Close other tabs that are using it and try again.",
};

function VoiceTyping({ slug }: { slug: string }) {
  useScriptFonts();
  const reduced = usePrefersReducedMotion();
  const [support, setSupport] = useState<"checking" | "yes" | "no">("checking");
  const [lang, setLang] = useState("ur-PK");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const recRef = useRef<SR | null>(null);
  const wantRef = useRef(false);
  const baseRef = useRef("");
  const skipRef = useRef(0);
  const finalsRef = useRef(0);
  const textRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useTrackOnce(slug, heard);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setSupport(getSR() ? "yes" : "no");
      const saved = loadJSON<{ lang?: string }>("sg-voice-typing");
      if (saved?.lang && SR_LANGS.some((l) => l.code === saved.lang)) setLang(saved.lang);
    });
    return () => {
      cancelAnimationFrame(id);
      wantRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  const update = (t: string) => {
    textRef.current = t;
    setText(t);
  };

  function start() {
    const Ctor = getSR();
    if (!Ctor) return;
    setError(null);
    let rec: SR;
    try {
      rec = new Ctor();
    } catch {
      setError("start-failed");
      return;
    }
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    baseRef.current = textRef.current;
    skipRef.current = 0;
    finalsRef.current = 0;

    rec.onresult = (e) => {
      const finals: string[] = [];
      let live = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finals.push(t.trim());
        else live += t;
      }
      // Chrome on Android repeats the growing phrase as separate results — keep the longest
      const clean = finals.filter((f, i) => f && !(finals[i + 1] ?? "").startsWith(f));
      finalsRef.current = clean.length;
      const spoken = tidySpeech(clean.slice(skipRef.current).join(" "), lang, baseRef.current);
      update(joinSpeech(baseRef.current, spoken));
      setInterim(live);
      if (spoken) setHeard(true);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      setError(e.error);
    };
    rec.onend = () => {
      setInterim("");
      // browsers stop after a pause in speech; carry on until the user taps stop
      if (wantRef.current) {
        baseRef.current = textRef.current;
        skipRef.current = 0;
        finalsRef.current = 0;
        try {
          rec.start();
          return;
        } catch {}
      }
      wantRef.current = false;
      setListening(false);
    };

    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
      trackEvent("voice-typing", lang);
      saveJSON("sg-voice-typing", { lang });
    } catch {
      wantRef.current = false;
      setError("start-failed");
    }
  }

  function stop() {
    wantRef.current = false;
    recRef.current?.stop();
  }

  function addPunct(p: string) {
    if (listening) {
      const cur = textRef.current.replace(/[ \t]+$/, "");
      baseRef.current = cur + p;
      skipRef.current = finalsRef.current;
      update(baseRef.current);
      return;
    }
    const el = taRef.current;
    const v = textRef.current;
    const s = el?.selectionStart ?? v.length;
    const e = el?.selectionEnd ?? v.length;
    const before = p === "\n" ? v.slice(0, s) : v.slice(0, s).replace(/[ \t]+$/, "");
    const next = before + p + v.slice(e);
    update(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length + p.length, before.length + p.length);
    });
  }

  const rtl = isRtlLang(lang);
  const P = punctFor(lang);
  const puncts = [
    { k: P.stop, label: "Full stop" },
    { k: P.comma, label: "Comma" },
    { k: P.q, label: "Question mark" },
    { k: "!", label: "Exclamation mark" },
    { k: "\n", label: "New line" },
  ];
  const langLabel = SR_LANGS.find((l) => l.code === lang)?.label ?? lang;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Language you will speak</span>
          <select value={lang} disabled={listening} onChange={(e) => setLang(e.target.value)} className={`${field} disabled:opacity-60`}>
            {SR_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted sm:max-w-56">Tip: speak clearly, close to the mic. Pauses are fine, it keeps listening.</p>
      </div>

      {support === "no" && (
        <div className="mt-4">
          <Notice tone="warn">
            <strong>Voice typing isn&apos;t available in this browser.</strong> It works in Chrome and Edge on Android and
            desktop; Safari supports it partly (iPhone with iOS 14.5+); Firefox doesn&apos;t support it yet. If you opened
            this inside Facebook, Instagram or WhatsApp, open the page in Chrome instead.
          </Notice>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center">
        <div className="relative grid h-36 w-36 place-items-center">
          {listening &&
            !reduced &&
            [0, 1].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute inset-3 rounded-full bg-rose-500/30"
                initial={{ scale: 0.85, opacity: 0.7 }}
                animate={{ scale: 1.45, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
              />
            ))}
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={support !== "yes"}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice typing" : "Start voice typing"}
            className={`relative grid h-28 w-28 place-items-center rounded-full text-white shadow-2xl transition-all active:scale-95 disabled:opacity-50 ${
              listening
                ? "bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/40"
                : "bg-gradient-to-br from-brand-500 to-accent-500 shadow-brand-500/40 hover:brightness-110"
            }`}
          >
            {listening ? <Square className="h-9 w-9" fill="currentColor" /> : <Mic className="h-11 w-11" />}
          </button>
        </div>
        <p className="mt-1 text-center text-sm font-bold" aria-live="polite">
          {support === "checking"
            ? "Checking your browser…"
            : listening
              ? `Listening in ${langLabel}… tap to stop`
              : text
                ? "Tap the mic to keep dictating"
                : "Tap the mic and start speaking"}
        </p>
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="warn">{SR_ERRORS[error] ?? `Something went wrong (${error}). Please try again.`}</Notice>
        </div>
      )}

      <div
        className="mt-4 min-h-12 rounded-xl bg-[var(--bg-soft)] px-4 py-3 text-sm italic text-muted"
        dir={rtl ? "rtl" : "ltr"}
        style={rtl ? { fontFamily: NASKH, fontSize: "1.05rem" } : undefined}
        aria-live="polite"
      >
        {interim || (listening ? "…" : "Words you are saying show up here first, then move into the text below.")}
      </div>

      <textarea
        ref={taRef}
        value={text}
        readOnly={listening}
        onChange={(e) => update(e.target.value)}
        dir={rtl ? "rtl" : "ltr"}
        lang={lang}
        rows={7}
        placeholder={rtl ? "آپ کی بات یہاں لکھی جائے گی" : "Your text will appear here. You can edit it after you stop."}
        aria-label="Transcript"
        className={`${fieldBase} mt-3 min-h-[180px] resize-y ${rtl ? "text-xl leading-[1.9]" : "text-base leading-relaxed"} ${listening ? "opacity-90" : ""}`}
        style={rtl ? { fontFamily: NASKH } : undefined}
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-muted">Insert:</span>
        {puncts.map((p) => (
          <button
            key={p.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => addPunct(p.k)}
            aria-label={`Insert ${p.label}`}
            title={p.label}
            className="grid min-h-10 min-w-10 place-items-center rounded-xl surface px-3 text-lg font-bold hover:border-brand-400/60 hover:text-brand-400"
          >
            {p.k === "\n" ? <CornerDownLeft className="h-4 w-4" /> : p.k}
          </button>
        ))}
        <span className="ml-auto text-xs tabular-nums text-muted">{countWords(text).toLocaleString()} words</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => void copyText(text)}>
          <Copy className="h-4 w-4" /> Copy
        </button>
        <button type="button" className={btnGhost} onClick={() => downloadText(text, "voice-typing.txt")}>
          <Download className="h-4 w-4" /> Download .txt
        </button>
        <ShareSheet title="Voice typing" text={text.trim() ? text.slice(0, 280) : "Type with your voice, free, on SnapGrab"} />
        <ConfirmButton disabled={!text || listening} onConfirm={() => update("")}>
          <Trash2 className="h-4 w-4" /> Clear
        </ConfirmButton>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Say &ldquo;full stop&rdquo;, &ldquo;comma&rdquo;, &ldquo;question mark&rdquo; or &ldquo;new line&rdquo; in English
        (in Urdu: فل سٹاپ، کوما، سوالیہ نشان، نئی لائن), or tap the buttons above. Speech is turned into text by your
        browser&apos;s own speech service; SnapGrab never receives or stores your voice.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Text to speech — speechSynthesis
 * ------------------------------------------------------------------ */

const TTS_SAMPLES = [
  {
    id: "en",
    label: "English",
    text: "Welcome to SnapGrab. Paste any text here and your device will read it aloud. It is great for proofreading, learning pronunciation, or resting your eyes.",
  },
  {
    id: "ur",
    label: "اردو",
    text: "السلام علیکم! اسنیپ گریب میں خوش آمدید۔ یہاں کوئی بھی تحریر لکھیں اور آپ کا فون اسے بلند آواز میں پڑھ کر سنائے گا۔",
  },
  { id: "ar", label: "العربية", text: "السلام عليكم ورحمة الله وبركاته. مرحباً بكم، اكتب أي نص هنا وسيقرؤه جهازك بصوت عالٍ." },
  { id: "hi", label: "हिन्दी", text: "नमस्ते! यहाँ कोई भी लेख लिखिए और आपका फ़ोन उसे ज़ोर से पढ़कर सुनाएगा।" },
];

const LANG_PRIORITY = ["ur", "en", "hi", "ar", "pa"];

const langNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" });
  } catch {
    return null;
  }
})();
function langName(code: string) {
  try {
    return langNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

function detectScript(t: string): "ur" | "ar" | "hi" | null {
  if (/[ٹڈڑںےگکپچژھہ]/.test(t)) return "ur";
  if (/[؀-ۿ]/.test(t)) return "ar";
  if (/[ऀ-ॿ]/.test(t)) return "hi";
  return null;
}

/** Splits long text so Chrome doesn't cut off utterances after ~15 seconds. */
function chunkText(text: string, max = 220) {
  const out: { text: string; start: number }[] = [];
  for (const m of text.matchAll(/[^.!?؟۔।\n]+[.!?؟۔।\n]*/g)) {
    let start = m.index ?? 0;
    let piece = m[0];
    while (piece.length > max) {
      let cut = piece.lastIndexOf(" ", max);
      if (cut < max * 0.5) cut = max;
      out.push({ text: piece.slice(0, cut), start });
      start += cut;
      piece = piece.slice(cut);
    }
    if (piece.trim()) out.push({ text: piece, start });
  }
  return out;
}

function wordRange(text: string, idx: number, len?: number): [number, number] {
  if (len && len > 0) return [idx, idx + len];
  const m = /^\S+/.exec(text.slice(idx));
  return [idx, idx + (m ? m[0].length : 1)];
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-sm font-semibold">
        {label} <span className="tabular-nums text-muted">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-[var(--color-brand-500)]"
      />
    </label>
  );
}

function TextToSpeech({ slug }: { slug: string }) {
  useScriptFonts();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [uiLang, setUiLang] = useState("en");
  const [filter, setFilter] = useState("all");
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "speaking" | "paused">("idle");
  const [hl, setHl] = useState<[number, number] | null>(null);
  const [played, setPlayed] = useState(false);
  const runRef = useRef(0);
  const uttRef = useRef<SpeechSynthesisUtterance[]>([]);
  const markRef = useRef<HTMLElement>(null);

  useTrackOnce(slug, played);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      const id = requestAnimationFrame(() => setSupported(false));
      return () => cancelAnimationFrame(id);
    }
    const synth = window.speechSynthesis;
    const load = () =>
      setVoices([...synth.getVoices()].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name)));
    const id = requestAnimationFrame(() => {
      setSupported(true);
      setUiLang((navigator.language || "en").slice(0, 2).toLowerCase());
      load();
    });
    synth.addEventListener("voiceschanged", load);
    return () => {
      cancelAnimationFrame(id);
      synth.removeEventListener("voiceschanged", load);
      uttRef.current = [];
      synth.cancel();
    };
  }, []);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "nearest" });
  }, [hl]);

  const langOptions = useMemo(() => {
    const m = new Map<string, number>();
    voices.forEach((v) => {
      const p = v.lang.slice(0, 2).toLowerCase();
      m.set(p, (m.get(p) ?? 0) + 1);
    });
    const rank = (c: string) => (LANG_PRIORITY.includes(c) ? LANG_PRIORITY.indexOf(c) : 99);
    return [...m.entries()]
      .map(([code, count]) => ({ code, count, name: langName(code) }))
      .sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
  }, [voices]);

  const filtered = filter === "all" ? voices : voices.filter((v) => v.lang.toLowerCase().startsWith(filter));
  const voice =
    filtered.find((v) => v.voiceURI === voiceURI) ??
    filtered.find((v) => v.default) ??
    filtered.find((v) => v.lang.toLowerCase().startsWith(uiLang)) ??
    filtered[0] ??
    null;

  const script = detectScript(text);
  const voiceFits = !script || !voice || voice.lang.toLowerCase().startsWith(script);
  const scriptHasVoices = script ? voices.some((v) => v.lang.toLowerCase().startsWith(script)) : false;

  function stop() {
    runRef.current++;
    uttRef.current = [];
    window.speechSynthesis?.cancel();
    setStatus("idle");
    setHl(null);
  }

  function play() {
    if (!text.trim()) {
      notify.info("Type or paste some text first");
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const run = ++runRef.current;
    const chunks = chunkText(text);
    const utts = chunks.map((c, i) => {
      const u = new SpeechSynthesisUtterance(c.text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else if (script) u.lang = script === "ur" ? "ur-PK" : script === "ar" ? "ar-SA" : "hi-IN";
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      u.onstart = () => {
        if (runRef.current === run) setHl(wordRange(text, c.start));
      };
      u.onboundary = (e) => {
        if (runRef.current !== run || (e.name && e.name !== "word")) return;
        setHl(wordRange(text, c.start + e.charIndex, e.charLength));
      };
      u.onend = () => {
        if (runRef.current === run && i === chunks.length - 1) {
          setStatus("idle");
          setHl(null);
        }
      };
      u.onerror = (e) => {
        if (runRef.current !== run || e.error === "interrupted" || e.error === "canceled") return;
        setStatus("idle");
        setHl(null);
        notify.error("Could not read this text aloud", "Try another voice, or a shorter text.");
      };
      return u;
    });
    uttRef.current = utts; // keeps Chrome from garbage-collecting them mid-sentence
    utts.forEach((u) => synth.speak(u));
    setStatus("speaking");
    setPlayed(true);
    trackEvent("speak", voice?.lang);
  }

  function pause() {
    window.speechSynthesis.pause();
    setStatus("paused");
  }

  function resume() {
    window.speechSynthesis.resume();
    setStatus("speaking");
  }

  const rtl = script === "ur" || script === "ar";
  const readerFont = rtl ? { fontFamily: NASKH } : undefined;

  return (
    <>
      {supported === false && (
        <div className="mb-4">
          <Notice tone="warn">
            This browser has no text-to-speech engine. Try Chrome, Edge or Safari on your phone or computer.
          </Notice>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Try a sample:</span>
        {TTS_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={status !== "idle"}
            onClick={() => {
              setText(s.text);
              if (voices.some((v) => v.lang.toLowerCase().startsWith(s.id))) {
                setFilter(s.id);
                setVoiceURI("");
              }
            }}
            className="min-h-9 rounded-lg surface px-3 py-1.5 text-xs font-bold hover:border-brand-400/60 hover:text-brand-400 disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>

      {status === "idle" ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          dir="auto"
          rows={7}
          placeholder="Type or paste text here: English, Urdu, Arabic, Hindi and more"
          aria-label="Text to read aloud"
          className={`${fieldBase} min-h-[200px] resize-y ${rtl ? "text-xl leading-[1.9]" : "text-base leading-relaxed"}`}
          style={readerFont}
        />
      ) : (
        <div
          dir="auto"
          className={`${fieldBase} max-h-[320px] min-h-[200px] overflow-auto whitespace-pre-wrap break-words ${
            rtl ? "text-xl leading-[1.9]" : "text-base leading-relaxed"
          }`}
          style={readerFont}
          aria-label="Reading aloud"
        >
          {hl ? (
            <>
              {text.slice(0, hl[0])}
              <mark ref={markRef} className="rounded bg-brand-500/30 px-0.5 text-[var(--fg)]">
                {text.slice(hl[0], hl[1])}
              </mark>
              {text.slice(hl[1])}
            </>
          ) : (
            text
          )}
        </div>
      )}
      <p className="mt-1.5 text-xs tabular-nums text-muted">
        {countChars(text).toLocaleString()} characters · {countWords(text).toLocaleString()} words
        {text.trim() ? ` · about ${Math.max(1, Math.round(countWords(text) / (2.5 * rate)))} s to read` : ""}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Language</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setVoiceURI("");
            }}
            disabled={status !== "idle"}
            className={`${field} disabled:opacity-60`}
          >
            <option value="all">All languages ({voices.length} voices)</option>
            {langOptions.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.count})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Voice</span>
          <select
            value={voice?.voiceURI ?? ""}
            onChange={(e) => setVoiceURI(e.target.value)}
            disabled={status !== "idle" || !filtered.length}
            className={`${field} disabled:opacity-60`}
          >
            {!filtered.length && <option value="">{supported === null ? "Loading voices…" : "No voices found"}</option>}
            {filtered.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang}){v.localService ? "" : " · online"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {script && !voiceFits && (
        <div className="mt-4">
          <Notice tone="warn">
            Your text looks like {langName(script)}, but the selected voice is {voice ? langName(voice.lang.slice(0, 2)) : "different"}.{" "}
            {scriptHasVoices ? (
              <button
                type="button"
                className="font-bold text-brand-400 underline"
                onClick={() => {
                  setFilter(script);
                  setVoiceURI("");
                }}
              >
                Show {langName(script)} voices
              </button>
            ) : (
              <>
                This device has no {langName(script)} voice installed. On Android: Settings → Text-to-speech → Speech
                Services by Google → Install voice data. On Windows: Settings → Time &amp; language → Speech → Add voices.
              </>
            )}
          </Notice>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Slider label="Speed" value={rate} min={0.5} max={2} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}×`} />
        <Slider label="Pitch" value={pitch} min={0} max={2} step={0.1} onChange={setPitch} format={(v) => v.toFixed(1)} />
        <Slider label="Volume" value={volume} min={0} max={1} step={0.05} onChange={setVolume} format={(v) => `${Math.round(v * 100)}%`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "paused" ? (
          <button type="button" className={btnPrimary} onClick={resume}>
            <Play className="h-4 w-4" /> Resume
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={play} disabled={!supported || status === "speaking"}>
            <Volume2 className="h-4 w-4" /> {status === "speaking" ? "Reading…" : "Play"}
          </button>
        )}
        <button type="button" className={btnGhost} onClick={pause} disabled={status !== "speaking"}>
          <Pause className="h-4 w-4" /> Pause
        </button>
        <button type="button" className={btnGhost} onClick={stop} disabled={status === "idle"}>
          <Square className="h-4 w-4" /> Stop
        </button>
        <ShareSheet title="Text to speech" text={text.trim() ? text.slice(0, 280) : "Listen to any text read aloud, free, on SnapGrab"} />
      </div>

      <div className="mt-5">
        <Notice>
          <strong>Why is there no MP3 download?</strong> Browsers play speech straight to your speaker and never hand the
          audio to web pages, so no website can honestly save it as MP3 without sending your text to a paid server. To keep
          a copy, use your phone&apos;s screen recorder. Word highlighting depends on the voice; most built-in voices
          support it.
        </Notice>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 4. Digital tasbeeh
 * ------------------------------------------------------------------ */

const DHIKR = [
  { id: "subhanallah", name: "SubhanAllah", arabic: "سُبْحَانَ اللّٰهِ", say: "Subḥān Allāh", meaning: "Glory be to Allah" },
  { id: "alhamdulillah", name: "Alhamdulillah", arabic: "اَلْحَمْدُ لِلّٰهِ", say: "Al-ḥamdu lillāh", meaning: "All praise is for Allah" },
  { id: "allahuakbar", name: "Allahu Akbar", arabic: "اَللّٰهُ أَكْبَرُ", say: "Allāhu akbar", meaning: "Allah is the Greatest" },
  { id: "kalima", name: "La ilaha illallah", arabic: "لَا إِلٰهَ إِلَّا اللّٰهُ", say: "Lā ilāha illā Allāh", meaning: "There is no god but Allah" },
  { id: "astaghfirullah", name: "Astaghfirullah", arabic: "أَسْتَغْفِرُ اللّٰهَ", say: "Astaghfirullāh", meaning: "I seek Allah's forgiveness" },
  {
    id: "durood",
    name: "Durood Sharif",
    arabic: "اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ وَّعَلٰى آلِ مُحَمَّدٍ",
    say: "Allāhumma ṣalli ʿalā Muḥammadin wa ʿalā āli Muḥammad",
    meaning: "O Allah, send blessings upon Muhammad and the family of Muhammad",
  },
  {
    id: "subhanallahi-wabihamdihi",
    name: "SubhanAllahi wa bihamdihi",
    arabic: "سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ",
    say: "Subḥān Allāhi wa bi-ḥamdihī",
    meaning: "Glory be to Allah and all praise is His",
  },
  {
    id: "hawqala",
    name: "La hawla wa la quwwata",
    arabic: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ",
    say: "Lā ḥawla wa lā quwwata illā billāh",
    meaning: "There is no power and no strength except with Allah",
  },
  { id: "free", name: "Free count", arabic: "", say: "Any dhikr, du'a or anything you want to count", meaning: "" },
];

type TasbeehSave = {
  dhikr: string;
  target: number;
  custom: string;
  sessions: Record<string, { count: number; rounds: number }>;
  totals: Record<string, number>;
  today: { date: string; counts: Record<string, number> };
  sound: boolean;
  vibe: boolean;
};

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function Tasbeeh({ slug }: { slug: string }) {
  useScriptFonts();
  const reduced = usePrefersReducedMotion();
  const [dhikr, setDhikr] = useState("subhanallah");
  const [target, setTarget] = useState(33);
  const [custom, setCustom] = useState("");
  const [sessions, setSessions] = useState<TasbeehSave["sessions"]>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [today, setToday] = useState<TasbeehSave["today"]>({ date: "", counts: {} });
  const [sound, setSound] = useState(false);
  const [vibe, setVibe] = useState(true);
  const [history, setHistory] = useState<{ id: string; count: number; rounds: number }[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [used, setUsed] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);

  useTrackOnce(slug, used);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const s = loadJSON<Partial<TasbeehSave>>("sg-tasbeeh");
      if (s) {
        if (s.dhikr && DHIKR.some((d) => d.id === s.dhikr)) setDhikr(s.dhikr);
        if (typeof s.target === "number" && s.target >= 0) setTarget(s.target);
        if (typeof s.custom === "string") setCustom(s.custom);
        if (s.sessions) setSessions(s.sessions);
        if (s.totals) setTotals(s.totals);
        if (s.today) setToday(s.today.date === dayKey() ? s.today : { date: dayKey(), counts: {} });
        if (typeof s.sound === "boolean") setSound(s.sound);
        if (typeof s.vibe === "boolean") setVibe(s.vibe);
      }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveJSON("sg-tasbeeh", { dhikr, target, custom, sessions, totals, today, sound, vibe } satisfies TasbeehSave);
  }, [loaded, dhikr, target, custom, sessions, totals, today, sound, vibe]);

  const d = DHIKR.find((x) => x.id === dhikr) ?? DHIKR[0];
  const session = sessions[dhikr] ?? { count: 0, rounds: 0 };
  const { count, rounds } = session;
  const todayCount = today.counts[dhikr] ?? 0;
  const todayAll = Object.values(today.counts).reduce((a, b) => a + b, 0);

  function inc() {
    const next = target > 0 && count >= target ? 1 : count + 1;
    const done = target > 0 && next === target;
    setHistory((h) => [...h.slice(-99), { id: dhikr, count, rounds }]);
    setSessions((s) => ({ ...s, [dhikr]: { count: next, rounds: rounds + (done ? 1 : 0) } }));
    setTotals((t) => ({ ...t, [dhikr]: (t[dhikr] ?? 0) + 1 }));
    const key = dayKey();
    setToday((t) =>
      t.date === key
        ? { date: key, counts: { ...t.counts, [dhikr]: (t.counts[dhikr] ?? 0) + 1 } }
        : { date: key, counts: { [dhikr]: 1 } },
    );
    setUsed(true);
    if (done) {
      if (vibe) buzz([90, 60, 180]);
      if (sound) chime();
      setFlash(rounds + 1);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 2200);
    } else {
      if (vibe) buzz(12);
      if (sound) tone(880, 0.035, 0.08, 0, "triangle");
    }
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setSessions((s) => ({ ...s, [last.id]: { count: last.count, rounds: last.rounds } }));
    setTotals((t) => ({ ...t, [last.id]: Math.max(0, (t[last.id] ?? 0) - 1) }));
    setToday((t) => ({ ...t, counts: { ...t.counts, [last.id]: Math.max(0, (t.counts[last.id] ?? 0) - 1) } }));
    if (vibe) buzz(8);
  }

  function reset() {
    setSessions((s) => ({ ...s, [dhikr]: { count: 0, rounds: 0 } }));
    setHistory([]);
    setFlash(null);
  }

  useHotkeys(true, { space: inc, enter: inc, backspace: undo });

  const targets = [
    { v: 33, label: "33" },
    { v: 99, label: "99" },
    { v: 100, label: "100" },
    { v: 0, label: "No limit" },
  ];
  const isCustom = target > 0 && !targets.some((t) => t.v === target);

  return (
    <>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" role="group" aria-label="Choose dhikr">
        {DHIKR.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === dhikr}
            onClick={() => {
              setDhikr(x.id);
              setHistory([]);
              setFlash(null);
            }}
            className={`min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              x.id === dhikr
                ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                : "surface text-muted hover:text-[var(--fg)]"
            }`}
          >
            {x.name}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[7.5rem] rounded-2xl surface p-4 text-center">
        {d.arabic && (
          <p dir="rtl" lang="ar" className="text-3xl leading-[1.8] sm:text-4xl" style={{ fontFamily: NASKH }}>
            {d.arabic}
          </p>
        )}
        <p className={`font-semibold ${d.arabic ? "mt-1 text-sm" : "pt-6 text-base"}`}>{d.say}</p>
        {d.meaning && <p className="mt-0.5 text-xs text-muted">{d.meaning}</p>}
      </div>

      <motion.button
        type="button"
        onClick={inc}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        aria-label={`Count ${d.name}. Tap, or press Space or Enter`}
        className="relative mt-4 flex min-h-[340px] w-full touch-manipulation select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-[var(--line)] bg-gradient-to-b from-brand-500/10 to-accent-500/5 px-4 py-6 outline-none transition-colors hover:border-brand-400/50 focus-visible:border-brand-400"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <Ring progress={target > 0 ? count / target : 0}>
          <motion.span
            key={count}
            initial={reduced ? false : { scale: 0.82, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.16 }}
            className="block text-6xl font-extrabold tabular-nums sm:text-7xl"
          >
            {count}
          </motion.span>
          <span className="mt-1 text-sm font-semibold text-muted">{target > 0 ? `of ${target}` : "no limit"}</span>
          <span className="mt-2 rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold">
            Round {target > 0 && count >= target ? rounds : rounds + 1}
          </span>
        </Ring>
        <span className="text-xs font-semibold text-muted">Tap anywhere here · Space / Enter on a keyboard</span>
        <AnimatePresence>
          {flash !== null && (
            <motion.span
              role="status"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-4 top-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-2 text-sm font-bold text-white shadow-lg"
            >
              <Sparkles className="h-4 w-4" /> Round {flash} complete, MashaAllah!
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btnGhost} onClick={undo} disabled={!history.length} aria-label="Undo last count">
          <Undo2 className="h-4 w-4" /> Undo
        </button>
        <ConfirmButton onConfirm={reset} disabled={!count && !rounds} confirmLabel="Tap again to reset">
          <RotateCcw className="h-4 w-4" /> Reset
        </ConfirmButton>
        <div className="ml-auto flex gap-2">
          <Chip on={sound} onClick={() => setSound((v) => !v)} label="Click sound">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sound
          </Chip>
          <Chip on={vibe} onClick={() => setVibe((v) => !v)} label="Vibration">
            <Vibrate className="h-4 w-4" /> Vibrate
          </Chip>
        </div>
      </div>

      <div className="mt-5 rounded-2xl surface p-4">
        <span className="mb-2 block text-sm font-semibold">Target per round</span>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <Chip key={t.v} on={target === t.v} onClick={() => setTarget(t.v)}>
              {t.label}
            </Chip>
          ))}
          <input
            type="text"
            inputMode="numeric"
            value={isCustom ? String(target) : custom}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 5);
              setCustom(v);
              if (Number(v) > 0) setTarget(Number(v));
            }}
            placeholder="Custom"
            aria-label="Custom target"
            className={`${field} !w-28 ${isCustom ? "!border-brand-400/60" : ""}`}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This round" value={String(count)} strong />
        <Stat label="Rounds done" value={String(rounds)} />
        <Stat label="Today" value={todayCount.toLocaleString()} />
        <Stat label="All time" value={(totals[dhikr] ?? 0).toLocaleString()} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-muted">
          Today across all dhikr: <strong className="text-[var(--fg)]">{todayAll.toLocaleString()}</strong>. Counts are
          saved on this device only.
        </p>
        <ShareSheet
          title="Digital Tasbeeh"
          text={
            todayCount > 0
              ? `Alhamdulillah, I recited ${d.id === "free" ? "dhikr" : d.name} ${todayCount} times today with SnapGrab's digital tasbeeh.`
              : "A free digital tasbeeh counter for your daily dhikr"
          }
        />
        <ConfirmButton
          disabled={!Object.keys(totals).length}
          confirmLabel="Tap again to erase"
          onConfirm={() => {
            setTotals({});
            setToday({ date: dayKey(), counts: {} });
            setSessions({});
            setHistory([]);
          }}
        >
          <Trash2 className="h-4 w-4" /> Clear saved counts
        </ConfirmButton>
      </div>
      <p className="mt-3 text-xs text-muted">Vibration works on most Android phones; iPhones don&apos;t allow websites to vibrate.</p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 5. Stopwatch, countdown & pomodoro
 * ------------------------------------------------------------------ */

function fmtStopwatch(ms: number) {
  const t = Math.max(0, Math.floor(ms));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor(t / 60_000) % 60;
  const s = Math.floor(t / 1000) % 60;
  const cs = Math.floor(t / 10) % 100;
  return `${h ? `${h}:` : ""}${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function fmtLap(ms: number) {
  const t = Math.max(0, Math.floor(ms));
  const m = Math.floor(t / 60_000);
  const s = Math.floor(t / 1000) % 60;
  return `${pad(m)}:${pad(s)}.${String(t % 1000).padStart(3, "0")}`;
}

function fmtCountdown(ms: number) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return `${h ? `${h}:` : ""}${pad(m)}:${pad(s)}`;
}

/** Which component currently owns the tab title, so two running timers don't fight over it. */
const titleClaims = new Map<symbol, string>();
let baseTitle = "";
function claimTitle(key: symbol, t: string | null) {
  if (t === null) titleClaims.delete(key);
  else {
    if (!titleClaims.size) baseTitle = document.title;
    titleClaims.set(key, t);
  }
  document.title = titleClaims.size ? [...titleClaims.values()][titleClaims.size - 1] : baseTitle;
}
function useDocumentTitle(t: string | null) {
  const [key] = useState(() => Symbol("title"));
  useEffect(() => {
    if (t === null) return;
    claimTitle(key, t);
    return () => claimTitle(key, null);
  }, [key, t]);
}

/**
 * A countdown that stays right in background tabs and after the phone sleeps: it stores the
 * wall-clock end time and derives what's left, rather than counting ticks.
 */
function useDeadline(onDone: () => void) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [total, setTotal] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => setNow(Date.now());
    const iv = window.setInterval(tick, 200);
    const to = window.setTimeout(() => {
      setEndAt(null);
      setLeft(null);
      done.current();
    }, Math.max(0, endAt - Date.now()));
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(to);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endAt]);

  const start = (ms: number, full = ms) => {
    const t = Date.now();
    setNow(t);
    setEndAt(t + ms);
    setLeft(null);
    setTotal(full);
  };
  const pause = () => {
    if (endAt === null) return;
    setLeft(Math.max(0, endAt - Date.now()));
    setEndAt(null);
  };
  const resume = () => {
    if (left !== null) start(left, total);
  };
  const reset = () => {
    setEndAt(null);
    setLeft(null);
  };
  const state: "idle" | "running" | "paused" = endAt !== null ? "running" : left !== null ? "paused" : "idle";
  const remaining = endAt !== null ? Math.max(0, endAt - now) : left;
  return { state, remaining, total, start, pause, resume, reset };
}

function enterFullscreen() {
  try {
    void document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {}
}

/** Big-digits view, portalled to <body> so the card's backdrop-filter doesn't trap it. */
function BigView({
  title,
  time,
  sub,
  onClose,
  children,
}: {
  title: string;
  time: string;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closeFn = useRef(onClose);
  useEffect(() => {
    closeFn.current = onClose;
  });
  useEffect(() => {
    boxRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFn.current();
    };
    const onFs = () => {
      if (!document.fullscreenElement) closeFn.current();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    try {
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (gone) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    } catch {}
    return () => {
      gone = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      void lock?.release().catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  return createPortal(
    <div
      ref={boxRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, full screen`}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 overflow-auto bg-[var(--bg)] p-6 text-center text-[var(--fg)] outline-none"
    >
      <button type="button" onClick={onClose} aria-label="Exit full screen" className={`${btnGhost} absolute right-4 top-4`}>
        <Minimize2 className="h-4 w-4" /> Exit
      </button>
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted sm:text-sm">{title}</p>
      <p className="font-extrabold leading-none tabular-nums" style={{ fontSize: "clamp(3.5rem, 18vw, 16rem)" }} aria-live="off">
        {time}
      </p>
      {sub}
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </div>,
    document.body,
  );
}

function Stopwatch({ slug, active }: { slug: string; active: boolean }) {
  const [running, setRunning] = useState(false);
  const [acc, setAcc] = useState(0);
  const [since, setSince] = useState(0);
  const [now, setNow] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [big, setBig] = useState(false);

  useTrackOnce(slug, running || acc > 0);

  useEffect(() => {
    if (!running) return;
    let id = requestAnimationFrame(function loop() {
      setNow(performance.now());
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);

  const elapsed = acc + (running ? Math.max(0, now - since) : 0);

  function toggle() {
    const t = performance.now();
    if (running) {
      setAcc((a) => a + (t - since));
      setRunning(false);
    } else {
      setSince(t);
      setNow(t);
      setRunning(true);
    }
  }
  function lap() {
    if (!running) return;
    const t = performance.now();
    setLaps((l) => [...l, acc + (t - since)]);
    buzz(10);
  }
  function reset() {
    setRunning(false);
    setAcc(0);
    setSince(0);
    setNow(0);
    setLaps([]);
  }

  useHotkeys(active, { space: toggle, l: lap, r: reset });

  const lapRows = useMemo(() => {
    const splits = laps.map((t, i) => t - (laps[i - 1] ?? 0));
    const best = splits.length >= 3 ? Math.min(...splits) : -1;
    const worst = splits.length >= 3 ? Math.max(...splits) : -1;
    return splits
      .map((s, i) => (
        <tr key={i} className="border-t border-[var(--line)]">
          <td className="px-3 py-2 font-semibold sm:px-4">Lap {i + 1}</td>
          <td className={`px-3 py-2 tabular-nums sm:px-4 ${s === best ? "text-accent-400" : s === worst ? "text-red-400" : ""}`}>
            {fmtLap(s)}
            {s === best && <span className="ml-1 text-[10px] font-bold uppercase">fastest</span>}
            {s === worst && <span className="ml-1 text-[10px] font-bold uppercase">slowest</span>}
          </td>
          <td className="px-3 py-2 text-right tabular-nums text-muted sm:px-4">{fmtLap(laps[i])}</td>
        </tr>
      ))
      .reverse();
  }, [laps]);

  const lapsText = laps.map((t, i) => `Lap ${i + 1}: ${fmtLap(t - (laps[i - 1] ?? 0))} (total ${fmtLap(t)})`).join("\n");

  const controls = (
    <>
      <button type="button" className={`${btnPrimary} min-w-32`} onClick={toggle}>
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
      </button>
      <button type="button" className={btnGhost} onClick={lap} disabled={!running}>
        <Flag className="h-4 w-4" /> Lap
      </button>
      <button type="button" className={btnGhost} onClick={reset} disabled={!elapsed && !laps.length}>
        <RotateCcw className="h-4 w-4" /> Reset
      </button>
    </>
  );

  return (
    <>
      <div className="rounded-2xl surface px-4 py-8 text-center">
        <p className="text-[clamp(2.75rem,13vw,5.5rem)] font-extrabold leading-none tabular-nums" aria-live="off">
          {fmtStopwatch(elapsed)}
        </p>
        <p className="mt-2 text-xs text-muted">Keyboard: Space start/pause · L lap · R reset</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {controls}
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            setBig(true);
            enterFullscreen();
          }}
          aria-label="Full screen"
        >
          <Maximize2 className="h-4 w-4" /> Full screen
        </button>
      </div>

      {laps.length > 0 && (
        <>
          <div className="mt-4 max-h-80 overflow-auto rounded-2xl surface">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--bg-soft)]">
                <tr className="text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2.5 sm:px-4">Lap</th>
                  <th className="px-3 py-2.5 sm:px-4">Lap time</th>
                  <th className="px-3 py-2.5 text-right sm:px-4">Total</th>
                </tr>
              </thead>
              <tbody>{lapRows}</tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => void copyText(lapsText, "Lap times")}>
              <Copy className="h-4 w-4" /> Copy laps
            </button>
            <ShareSheet title="My lap times" text={`My stopwatch: ${laps.length} laps, total ${fmtLap(laps[laps.length - 1])}. Timed on SnapGrab.`} />
          </div>
        </>
      )}

      {big && (
        <BigView title="Stopwatch" time={fmtStopwatch(elapsed)} onClose={() => setBig(false)}>
          {controls}
        </BigView>
      )}
    </>
  );
}

function NotifyChip({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  return (
    <Chip
      on={on}
      label="Notify me when time is up"
      onClick={() => {
        if (on) {
          setOn(false);
          return;
        }
        if (typeof Notification === "undefined") {
          notify.info("Notifications aren't supported here", "The alarm sound and vibration will still work.");
          return;
        }
        void Promise.resolve(Notification.requestPermission()).then((p) => {
          if (p === "granted") setOn(true);
          else notify.warning("Notifications are blocked", "Allow them in your browser's site settings to get an alert.");
        });
      }}
    >
      {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} Notify me
    </Chip>
  );
}

function TimeBox({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label className="block text-center">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className={`${fieldBase} text-center text-3xl font-extrabold tabular-nums disabled:opacity-60`}
      />
      <span className="mt-1 block text-xs font-semibold text-muted">{label}</span>
    </label>
  );
}

function Countdown({ slug, active }: { slug: string; active: boolean }) {
  const [h, setH] = useState("0");
  const [m, setM] = useState("5");
  const [s, setS] = useState("0");
  const [ringing, setRinging] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const [big, setBig] = useState(false);
  const [used, setUsed] = useState(false);
  const stopAlarm = useRef<() => void>(() => {});

  useTrackOnce(slug, used);

  const total = (clampNum(h, 0, 99, 0) * 3600 + clampNum(m, 0, 999, 0) * 60 + clampNum(s, 0, 999, 0)) * 1000;

  const timer = useDeadline(() => {
    setRinging(true);
    stopAlarm.current();
    stopAlarm.current = playAlarm(10);
    buzz([600, 200, 600, 200, 600]);
    if (notifyOn) void showNotice("Time's up!", "Your SnapGrab countdown has finished.");
  });

  useEffect(() => () => stopAlarm.current(), []);

  const running = timer.state === "running";
  useDocumentTitle(ringing ? "Time's up! · Countdown" : running ? `${fmtCountdown(timer.remaining ?? 0)} · Countdown` : null);

  function silence() {
    stopAlarm.current();
    setRinging(false);
  }
  function startWith(ms: number) {
    if (ms <= 0) {
      notify.info("Set a time first", "Enter minutes or tap a preset.");
      return;
    }
    silence();
    getAudio(); // unlock sound now, while we have a tap
    timer.start(ms);
    setUsed(true);
  }
  function preset(sec: number) {
    setH(String(Math.floor(sec / 3600)));
    setM(String(Math.floor(sec / 60) % 60));
    setS(String(sec % 60));
    startWith(sec * 1000);
  }
  function main() {
    if (timer.state === "running") timer.pause();
    else if (timer.state === "paused") timer.resume();
    else startWith(total);
  }

  useHotkeys(active, {
    space: main,
    r: () => {
      silence();
      timer.reset();
    },
  });

  const shown = timer.remaining ?? total;
  const progress = timer.state === "idle" ? 1 : timer.total ? shown / timer.total : 0;
  const locked = timer.state !== "idle";

  const controls = (
    <>
      <button type="button" className={`${btnPrimary} min-w-32`} onClick={main}>
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {running ? "Pause" : timer.state === "paused" ? "Resume" : "Start"}
      </button>
      <button
        type="button"
        className={btnGhost}
        onClick={() => {
          silence();
          timer.reset();
        }}
        disabled={timer.state === "idle" && !ringing}
      >
        <RotateCcw className="h-4 w-4" /> Reset
      </button>
    </>
  );

  const alarmBanner = ringing && (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4" role="alert">
      <Bell className="h-5 w-5 text-rose-400" />
      <span className="font-extrabold">Time&apos;s up!</span>
      <button type="button" className={btnPrimary} onClick={silence}>
        Stop alarm
      </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center rounded-2xl surface px-4 py-6">
        <Ring progress={progress} width="min(250px, 70vw)">
          <span className="text-[clamp(2.25rem,11vw,3.5rem)] font-extrabold leading-none tabular-nums">{fmtCountdown(shown)}</span>
          <span className="mt-1 text-xs font-semibold text-muted">
            {running ? "Counting down" : timer.state === "paused" ? "Paused" : ringing ? "Finished" : "Ready"}
          </span>
        </Ring>
      </div>

      {alarmBanner && <div className="mt-3">{alarmBanner}</div>}

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <TimeBox label="Hours" value={h} onChange={setH} disabled={locked} />
        <TimeBox label="Minutes" value={m} onChange={setM} disabled={locked} />
        <TimeBox label="Seconds" value={s} onChange={setS} disabled={locked} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[30, 60, 300, 600, 900, 1500, 1800].map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => preset(sec)}
            className="min-h-10 rounded-xl surface px-3 py-2 text-xs font-bold hover:border-brand-400/60 hover:text-brand-400"
          >
            {sec < 60 ? `${sec} sec` : `${sec / 60} min`}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {controls}
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            setBig(true);
            enterFullscreen();
          }}
        >
          <Maximize2 className="h-4 w-4" /> Full screen
        </button>
        <NotifyChip on={notifyOn} setOn={setNotifyOn} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Keeps time correctly in a background tab or with the screen off. The alarm rings with sound and vibration; keep
        this tab open (and the phone off silent) to hear it.
      </p>

      {big && (
        <BigView
          title="Countdown"
          time={fmtCountdown(shown)}
          sub={alarmBanner || <span className="text-sm text-muted">{running ? "Counting down" : timer.state === "paused" ? "Paused" : "Ready"}</span>}
          onClose={() => setBig(false)}
        >
          {controls}
        </BigView>
      )}
    </>
  );
}

type Phase = "focus" | "short" | "long";
const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

function Pomodoro({ slug, active }: { slug: string; active: boolean }) {
  const [focusMin, setFocusMin] = useState("25");
  const [shortMin, setShortMin] = useState("5");
  const [longMin, setLongMin] = useState("15");
  const [phase, setPhase] = useState<Phase>("focus");
  const [sessions, setSessions] = useState(0);
  const [autoNext, setAutoNext] = useState(true);
  const [notifyOn, setNotifyOn] = useState(false);
  const [big, setBig] = useState(false);
  const [used, setUsed] = useState(false);

  useTrackOnce(slug, used);

  const mins: Record<Phase, number> = {
    focus: clampNum(focusMin, 1, 180, 25),
    short: clampNum(shortMin, 1, 60, 5),
    long: clampNum(longMin, 1, 90, 15),
  };
  const dur = (p: Phase) => mins[p] * 60_000;

  const timer = useDeadline(() => advance(true));

  function advance(finished: boolean) {
    let done = sessions;
    if (phase === "focus" && finished) {
      done = sessions + 1;
      setSessions(done);
    }
    const next: Phase = phase === "focus" ? (finished && done % 4 === 0 ? "long" : "short") : "focus";
    setPhase(next);
    if (finished) {
      chime();
      window.setTimeout(chime, 700);
      buzz([300, 150, 300]);
      if (notifyOn) void showNotice(`${PHASE_LABEL[phase]} finished`, next === "focus" ? "Break over: time to focus." : "Nice work! Take a break.");
    }
    if (finished && autoNext) timer.start(dur(next));
    else timer.reset();
  }

  const running = timer.state === "running";
  useDocumentTitle(running ? `${fmtCountdown(timer.remaining ?? 0)} · ${PHASE_LABEL[phase]}` : null);

  function main() {
    if (timer.state === "running") timer.pause();
    else if (timer.state === "paused") timer.resume();
    else {
      getAudio();
      timer.start(dur(phase));
      setUsed(true);
    }
  }

  useHotkeys(active, { space: main });

  const shown = timer.remaining ?? dur(phase);
  const progress = timer.state === "idle" ? 1 : timer.total ? shown / timer.total : 0;
  const locked = timer.state !== "idle";
  const phaseTone =
    phase === "focus" ? "from-brand-500 to-accent-500" : phase === "short" ? "from-emerald-500 to-teal-400" : "from-sky-500 to-indigo-500";

  const controls = (
    <>
      <button type="button" className={`${btnPrimary} min-w-32`} onClick={main}>
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {running ? "Pause" : timer.state === "paused" ? "Resume" : `Start ${PHASE_LABEL[phase].toLowerCase()}`}
      </button>
      <button type="button" className={btnGhost} onClick={() => advance(false)}>
        <SkipForward className="h-4 w-4" /> Skip
      </button>
      <button type="button" className={btnGhost} onClick={() => timer.reset()} disabled={timer.state === "idle"}>
        <RotateCcw className="h-4 w-4" /> Reset
      </button>
    </>
  );

  const dots = (
    <div className="flex items-center gap-2" aria-label={`${sessions % 4} of 4 focus sessions in this set`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i < sessions % 4 || (sessions > 0 && sessions % 4 === 0 && phase === "long") ? "bg-accent-400" : "bg-[var(--line)]"}`}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center rounded-2xl surface px-4 py-6">
        <span className={`mb-4 rounded-full bg-gradient-to-r ${phaseTone} px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white`}>
          {PHASE_LABEL[phase]}
        </span>
        <Ring progress={progress} width="min(250px, 70vw)">
          <span className="text-[clamp(2.25rem,11vw,3.5rem)] font-extrabold leading-none tabular-nums">{fmtCountdown(shown)}</span>
          <span className="mt-2">{dots}</span>
        </Ring>
        <p className="mt-3 text-sm text-muted">
          <strong className="text-[var(--fg)]">{sessions}</strong> focus session{sessions === 1 ? "" : "s"} done · long break after every 4
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {controls}
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            setBig(true);
            enterFullscreen();
          }}
        >
          <Maximize2 className="h-4 w-4" /> Full screen
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Field label="Focus (min)" value={focusMin} onChange={setFocusMin} disabled={locked} />
        <Field label="Break (min)" value={shortMin} onChange={setShortMin} disabled={locked} />
        <Field label="Long (min)" value={longMin} onChange={setLongMin} disabled={locked} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip on={autoNext} onClick={() => setAutoNext((v) => !v)}>
          <Play className="h-4 w-4" /> Auto-start next
        </Chip>
        <NotifyChip on={notifyOn} setOn={setNotifyOn} />
        {sessions > 0 && (
          <ShareSheet title="Pomodoro" text={`I finished ${sessions} focused pomodoro session${sessions === 1 ? "" : "s"} today with SnapGrab's timer.`} />
        )}
      </div>

      {big && (
        <BigView title={PHASE_LABEL[phase]} time={fmtCountdown(shown)} sub={dots} onClose={() => setBig(false)}>
          {controls}
        </BigView>
      )}
    </>
  );
}

function TimerTool({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"stopwatch" | "countdown" | "pomodoro">("stopwatch");
  return (
    <>
      <Toggle
        label="Timer type"
        value={tab}
        onChange={setTab}
        options={[
          { value: "stopwatch", label: "Stopwatch" },
          { value: "countdown", label: "Countdown" },
          { value: "pomodoro", label: "Pomodoro" },
        ]}
      />
      {/* all three stay mounted so a running timer keeps going while you look at another */}
      <div className="mt-5" hidden={tab !== "stopwatch"}>
        <Stopwatch slug={slug} active={tab === "stopwatch"} />
      </div>
      <div className="mt-5" hidden={tab !== "countdown"}>
        <Countdown slug={slug} active={tab === "countdown"} />
      </div>
      <div className="mt-5" hidden={tab !== "pomodoro"}>
        <Pomodoro slug={slug} active={tab === "pomodoro"} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 6. Spin the wheel & random pickers
 * ------------------------------------------------------------------ */

const WHEEL_COLORS = ["#7048f0", "#14c8be", "#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#e11d48"];
const WHEEL_R = 92;
const DEFAULT_NAMES = "Ali\nFatima\nAhmed\nAyesha\nHassan\nZainab";

const r3 = (n: number) => Math.round(n * 1000) / 1000;
function wheelPoint(deg: number) {
  const a = (deg * Math.PI) / 180;
  return [r3(WHEEL_R * Math.sin(a)), r3(-WHEEL_R * Math.cos(a))];
}

const parseNames = (t: string) =>
  t
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 200);

function Wheel({
  names,
  gRef,
  angle,
  spinning,
  onSpin,
}: {
  names: string[];
  gRef: RefObject<SVGGElement | null>;
  angle: number;
  spinning: boolean;
  onSpin: () => void;
}) {
  const n = names.length;
  const segs = useMemo(() => {
    const seg = 360 / Math.max(1, n);
    const max = n <= 8 ? 16 : n <= 16 ? 13 : 10;
    return names.map((name, i) => {
      const [x0, y0] = wheelPoint(i * seg);
      const [x1, y1] = wheelPoint((i + 1) * seg);
      const ci = i === n - 1 && i > 0 && i % WHEEL_COLORS.length === 0 ? 5 : i % WHEEL_COLORS.length;
      return {
        d: `M0 0L${x0} ${y0}A${WHEEL_R} ${WHEEL_R} 0 ${seg > 180 ? 1 : 0} 1 ${x1} ${y1}Z`,
        color: WHEEL_COLORS[ci],
        label: name.length > max ? `${name.slice(0, max - 1)}…` : name,
        rot: r3(i * seg + seg / 2 - 90),
      };
    });
  }, [names, n]);
  const fontSize = n <= 6 ? 9 : n <= 10 ? 7.5 : n <= 16 ? 6 : n <= 30 ? 4.5 : 3.2;

  return (
    <button
      type="button"
      onClick={onSpin}
      disabled={spinning || n < 2}
      aria-label={n < 2 ? "Add at least two names to spin" : `Spin the wheel with ${n} entries`}
      className="relative mx-auto block aspect-square w-full max-w-[400px] rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-400/50 disabled:cursor-default"
    >
      <svg viewBox="-100 -100 200 200" className="h-full w-full drop-shadow-xl" aria-hidden>
        <circle r="99" style={{ fill: "var(--bg-soft)", stroke: "var(--line)" }} strokeWidth="2" />
        <g ref={gRef} style={{ transform: `rotate(${angle}deg)`, transformOrigin: "0 0", transformBox: "view-box" }}>
          {n < 2 ? (
            <circle r={WHEEL_R} style={{ fill: "var(--line)" }} />
          ) : (
            segs.map((s, i) => (
              <g key={i}>
                <path d={s.d} fill={s.color} stroke="rgba(255,255,255,0.7)" strokeWidth="0.6" />
                <text
                  transform={`rotate(${s.rot})`}
                  x={WHEEL_R - 7}
                  y={0}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={800}
                  fill="#fff"
                  style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.3)", strokeWidth: 0.9 }}
                >
                  {s.label}
                </text>
              </g>
            ))
          )}
        </g>
        <circle r="15" style={{ fill: "var(--bg)", stroke: "var(--color-brand-500)" }} strokeWidth="3" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight={900} style={{ fill: "var(--fg)" }}>
          {spinning ? "…" : "SPIN"}
        </text>
        <polygon points="0,-78 -8,-99 8,-99" style={{ fill: "var(--fg)", stroke: "var(--bg)" }} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {n < 2 && (
        <span className="absolute inset-0 grid place-items-center px-10 text-center text-sm font-bold text-muted">Add at least 2 names to spin</span>
      )}
    </button>
  );
}

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const parts = Array.from({ length: 170 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.25,
      y: c.height * 0.4,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 15 - 5) * dpr,
      s: (5 + Math.random() * 6) * dpr,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: WHEEL_COLORS[Math.floor(Math.random() * WHEEL_COLORS.length)],
    }));
    const t0 = performance.now();
    let id = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      const fade = Math.max(0, 1 - (t - t0) / 3200);
      ctx.globalAlpha = fade;
      for (const p of parts) {
        p.vy += 0.38 * dpr;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (fade > 0) id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

function WinnerModal({
  name,
  reduced,
  removeAfter,
  onClose,
  onRemove,
  onSpinAgain,
}: {
  name: string;
  reduced: boolean;
  removeAfter: boolean;
  onClose: () => void;
  onRemove: () => void;
  onSpinAgain: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closeFn = useRef(onClose);
  useEffect(() => {
    closeFn.current = onClose;
  });
  useEffect(() => {
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFn.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const titleId = useId();

  return createPortal(
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      {!reduced && <Confetti />}
      <motion.div
        ref={boxRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="glass relative w-full max-w-sm rounded-3xl border border-[var(--line)] p-6 text-center text-[var(--fg)] shadow-2xl outline-none"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:text-[var(--fg)]">
          <X className="h-5 w-5" />
        </button>
        <Trophy className="mx-auto h-10 w-10 text-amber-400" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-muted">The wheel picked</p>
        <p id={titleId} className="gradient-text mt-2 break-words text-4xl font-extrabold sm:text-5xl">
          {name}
        </p>
        {removeAfter && <p className="mt-2 text-xs text-muted">{name} will be taken off the wheel.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className={btnPrimary} onClick={onSpinAgain}>
            <RotateCcw className="h-4 w-4" /> Spin again
          </button>
          {!removeAfter && (
            <button type="button" className={btnGhost} onClick={onRemove}>
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
          <ShareSheet title="Spin the wheel result" text={`The wheel picked ${name}! Spin your own free wheel on SnapGrab.`} />
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

function RandomNumbers({ onUse }: { onUse: () => void }) {
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [count, setCount] = useState("1");
  const [unique, setUnique] = useState(true);
  const [sorted, setSorted] = useState(false);
  const [out, setOut] = useState<number[]>([]);
  const [err, setErr] = useState("");

  function gen() {
    let lo = Math.ceil(num(min));
    let hi = Math.floor(num(max));
    if (lo > hi) [lo, hi] = [hi, lo];
    const range = hi - lo + 1;
    const n = Math.min(1000, Math.max(1, Math.floor(num(count)) || 1));
    if (range > 2 ** 32) return setErr("That range is too large. Keep it under about 4 billion numbers.");
    if (unique && n > range) return setErr(`Only ${range} different numbers exist from ${lo} to ${hi}. Lower the count or allow repeats.`);
    let res: number[];
    if (unique) {
      const set = new Set<number>();
      while (set.size < n) set.add(lo + randInt(range));
      res = [...set];
    } else res = Array.from({ length: n }, () => lo + randInt(range));
    if (sorted) res.sort((a, b) => a - b);
    setOut(res);
    setErr("");
    onUse();
  }

  return (
    <div className="rounded-2xl surface p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Shuffle className="h-4 w-4 text-brand-400" /> Random number generator
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field label="From" value={min} onChange={setMin} />
        <Field label="To" value={max} onChange={setMax} />
        <Field label="How many" value={count} onChange={setCount} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip on={unique} onClick={() => setUnique((v) => !v)}>
          No repeats
        </Chip>
        <Chip on={sorted} onClick={() => setSorted((v) => !v)}>
          Sort
        </Chip>
        <button type="button" className={`${btnPrimary} ml-auto`} onClick={gen}>
          <Sparkles className="h-4 w-4" /> Generate
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <div className="mt-3 flex min-h-12 flex-wrap items-center gap-1.5" aria-live="polite">
        {out.length ? (
          out.slice(0, 300).map((v, i) => (
            <span key={i} className={`rounded-lg bg-brand-500/15 px-2.5 py-1 font-extrabold tabular-nums ${out.length === 1 ? "text-3xl" : "text-sm"}`}>
              {v.toLocaleString()}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted">Your numbers appear here, picked fairly by your device&apos;s secure random generator.</span>
        )}
        {out.length > 300 && <span className="text-xs text-muted">+{out.length - 300} more (copy to see all)</span>}
      </div>
      {out.length > 0 && (
        <button type="button" className={`${btnGhost} mt-2`} onClick={() => void copyText(out.join(", "), "Numbers")}>
          <Copy className="h-4 w-4" /> Copy
        </button>
      )}
    </div>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function DieFace({ value }: { value: number | null }) {
  return (
    <span
      role="img"
      aria-label={value ? `Die showing ${value}` : "Die"}
      className="grid h-16 w-16 grid-cols-3 grid-rows-3 gap-0.5 rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-black/10"
    >
      {value
        ? Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={`m-auto h-2.5 w-2.5 rounded-full ${PIPS[value].includes(i) ? "bg-zinc-900" : ""}`} />
          ))
        : <span className="col-span-3 row-span-3 grid place-items-center text-2xl font-black text-zinc-400">?</span>}
    </span>
  );
}

function CoinAndDice({ onUse, reduced }: { onUse: () => void; reduced: boolean }) {
  const [coin, setCoin] = useState<"Heads" | "Tails" | null>(null);
  const [coinRot, setCoinRot] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [tally, setTally] = useState({ Heads: 0, Tails: 0 });
  const [diceN, setDiceN] = useState<"1" | "2" | "3">("1");
  const [dice, setDice] = useState<number[]>([]);
  const [rolls, setRolls] = useState(0);

  function flip() {
    if (flipping) return;
    const r = randInt(2) === 0 ? "Heads" : "Tails";
    const base = coinRot - (coinRot % 360) + 360 * 5;
    setCoinRot(base + (r === "Tails" ? 180 : 0));
    setFlipping(true);
    window.setTimeout(
      () => {
        setCoin(r);
        setTally((t) => ({ ...t, [r]: t[r] + 1 }));
        setFlipping(false);
        buzz(20);
      },
      reduced ? 50 : 1000,
    );
    onUse();
  }

  function roll() {
    setDice(Array.from({ length: Number(diceN) }, () => 1 + randInt(6)));
    setRolls((r) => r + 1);
    buzz(15);
    onUse();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-center rounded-2xl surface p-4">
        <p className="flex items-center gap-2 self-start text-sm font-bold">
          <Coins className="h-4 w-4 text-brand-400" /> Coin flip (toss)
        </p>
        <div className="my-4 h-24 w-24 [perspective:600px]">
          <motion.div
            className="relative h-full w-full [transform-style:preserve-3d]"
            animate={{ rotateY: coinRot }}
            transition={reduced ? { duration: 0 } : { duration: 1, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <span className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-2xl font-black text-amber-900 shadow-lg ring-4 ring-amber-200/60 [backface-visibility:hidden]">
              H
            </span>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 text-2xl font-black text-zinc-700 shadow-lg ring-4 ring-zinc-100/60 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              T
            </span>
          </motion.div>
        </div>
        <p className="min-h-7 text-lg font-extrabold" aria-live="polite">
          {flipping ? "Flipping…" : coin ?? "Heads or tails?"}
        </p>
        <p className="text-xs tabular-nums text-muted">
          Heads {tally.Heads} · Tails {tally.Tails}
        </p>
        <button type="button" className={`${btnPrimary} mt-3 w-full`} onClick={flip} disabled={flipping}>
          <Coins className="h-4 w-4" /> Flip coin
        </button>
      </div>

      <div className="flex flex-col items-center rounded-2xl surface p-4">
        <p className="flex items-center gap-2 self-start text-sm font-bold">
          <Dices className="h-4 w-4 text-brand-400" /> Dice roller
        </p>
        <div className="my-4 flex min-h-24 items-center justify-center gap-3">
          {(dice.length ? dice : Array.from({ length: Number(diceN) }, () => null)).map((v, i) => (
            <motion.span
              key={`${rolls}-${i}`}
              initial={reduced || !rolls ? false : { rotate: -120, scale: 0.6, opacity: 0.4 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: i * 0.05 }}
            >
              <DieFace value={v} />
            </motion.span>
          ))}
        </div>
        <p className="min-h-7 text-lg font-extrabold" aria-live="polite">
          {dice.length > 1 ? `Total ${dice.reduce((a, b) => a + b, 0)}` : dice.length ? `You rolled ${dice[0]}` : "Roll the dice"}
        </p>
        <div className="mt-2 w-full">
          <Toggle
            label="Number of dice"
            value={diceN}
            onChange={(v) => {
              setDiceN(v);
              setDice([]);
            }}
            options={[
              { value: "1", label: "1 die" },
              { value: "2", label: "2 dice" },
              { value: "3", label: "3 dice" },
            ]}
          />
        </div>
        <button type="button" className={`${btnPrimary} mt-3 w-full`} onClick={roll}>
          <Dices className="h-4 w-4" /> Roll
        </button>
      </div>
    </div>
  );
}

type WheelSave = { names?: string; removeAfter?: boolean; duration?: number; sound?: boolean };

function SpinWheel({ slug }: { slug: string }) {
  const reduced = usePrefersReducedMotion();
  const [namesText, setNamesText] = useState(DEFAULT_NAMES);
  const [removeAfter, setRemoveAfter] = useState(false);
  const [duration, setDuration] = useState<"3" | "5" | "8">("5");
  const [sound, setSound] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [used, setUsed] = useState(false);
  const gRef = useRef<SVGGElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef(0);

  useTrackOnce(slug, used);
  const names = useMemo(() => parseNames(namesText), [namesText]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const s = loadJSON<WheelSave>("sg-spin-wheel");
      if (s) {
        if (typeof s.names === "string") setNamesText(s.names);
        if (typeof s.removeAfter === "boolean") setRemoveAfter(s.removeAfter);
        if (s.duration === 3 || s.duration === 5 || s.duration === 8) setDuration(String(s.duration) as "3" | "5" | "8");
        if (typeof s.sound === "boolean") setSound(s.sound);
      }
      setLoaded(true);
    });
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (loaded) saveJSON("sg-spin-wheel", { names: namesText, removeAfter, duration: Number(duration), sound } satisfies WheelSave);
  }, [loaded, namesText, removeAfter, duration, sound]);

  function spin(list: string[] = names) {
    if (spinning || list.length < 2) return;
    const n = list.length;
    const seg = 360 / n;
    const w = randInt(n);
    const local = (w + 0.15 + (randInt(1000) / 1000) * 0.7) * seg; // land inside the slice, not on a line
    const cur = angleRef.current;
    const offset = (((360 - local - (cur % 360)) % 360) + 360) % 360;
    const secs = Number(duration);
    const turns = reduced ? 1 : secs + 3;
    const target = cur + turns * 360 + offset;
    const ms = reduced ? 700 : secs * 1000;
    const t0 = performance.now();
    let lastSeg = -1;
    if (sound) getAudio();
    setSpinning(true);
    setUsed(true);
    trackEvent("spin", String(n));
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 4);
      const a = cur + (target - cur) * eased;
      angleRef.current = a;
      if (gRef.current) gRef.current.style.transform = `rotate(${a}deg)`;
      if (sound) {
        const s = Math.floor((((360 - (a % 360)) % 360) / seg)) % n;
        if (s !== lastSeg) {
          if (lastSeg !== -1) tone(1600, 0.018, 0.05, 0, "square");
          lastSeg = s;
        }
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const rest = a % 360;
      angleRef.current = rest;
      setAngle(rest);
      setSpinning(false);
      setWinner(list[w]);
      setHistory((h) => [list[w], ...h].slice(0, 10));
      buzz([40, 40, 80]);
      if (sound) chime();
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function withoutWinner(list: string[]) {
    if (winner === null) return list;
    const i = list.indexOf(winner);
    return i === -1 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
  }

  function closeModal(): string[] {
    const next = removeAfter ? withoutWinner(names) : names;
    if (removeAfter) setNamesText(next.join("\n"));
    setWinner(null);
    return next;
  }

  function shuffle() {
    const a = [...names];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    setNamesText(a.join("\n"));
  }

  return (
    <>
      <div className="grid gap-5 md:grid-cols-[1.15fr_1fr] md:items-start">
        <div>
          <Wheel names={names} gRef={gRef} angle={angle} spinning={spinning} onSpin={() => spin()} />
          <button type="button" className={`${btnPrimary} mt-4 w-full py-3.5 text-base`} onClick={() => spin()} disabled={spinning || names.length < 2}>
            <RotateCcw className={`h-5 w-5 ${spinning && !reduced ? "animate-spin" : ""}`} />
            {spinning ? "Spinning…" : "Spin the wheel"}
          </button>
        </div>

        <div>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-semibold">
              Names or options
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-400">{names.length} entries</span>
            </span>
            <textarea
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              disabled={spinning}
              rows={8}
              placeholder={"One per line, or separated by commas\nAli\nFatima\nPizza, Biryani, Karahi"}
              className={`${field} min-h-[200px] resize-y leading-relaxed disabled:opacity-60`}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={shuffle} disabled={spinning || names.length < 2}>
              <Shuffle className="h-4 w-4" /> Shuffle
            </button>
            <button type="button" className={btnGhost} onClick={() => setNamesText([...names].sort((a, b) => a.localeCompare(b)).join("\n"))} disabled={spinning || names.length < 2}>
              A–Z
            </button>
            <button type="button" className={btnGhost} onClick={() => setNamesText(DEFAULT_NAMES)} disabled={spinning}>
              Sample
            </button>
            <ConfirmButton disabled={spinning || !namesText} onConfirm={() => setNamesText("")}>
              <Trash2 className="h-4 w-4" /> Clear
            </ConfirmButton>
          </div>

          <div className="mt-4 rounded-2xl surface p-4">
            <span className="mb-2 block text-sm font-semibold">Spin length</span>
            <Toggle
              label="Spin length"
              value={duration}
              onChange={setDuration}
              options={[
                { value: "3", label: "Quick 3s" },
                { value: "5", label: "Normal 5s" },
                { value: "8", label: "Long 8s" },
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip on={removeAfter} onClick={() => setRemoveAfter((v) => !v)}>
                Remove winner after spin
              </Chip>
              <Chip on={sound} onClick={() => setSound((v) => !v)} label="Spin sound">
                {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sound
              </Chip>
            </div>
          </div>

          {history.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Recent picks</p>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${i === 0 ? "bg-brand-500/20 text-brand-400" : "bg-[var(--bg-soft)]"}`}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="assertive">
        {winner ? `The wheel picked ${winner}` : ""}
      </p>

      <div className="mt-8 border-t border-[var(--line)] pt-6">
        <h3 className="mb-4 text-lg font-extrabold">Quick pickers</h3>
        <RandomNumbers onUse={() => setUsed(true)} />
        <div className="mt-4">
          <CoinAndDice onUse={() => setUsed(true)} reduced={reduced} />
        </div>
      </div>

      <AnimatePresence>
        {winner !== null && (
          <WinnerModal
            key="winner"
            name={winner}
            reduced={reduced}
            removeAfter={removeAfter}
            onClose={() => void closeModal()}
            onRemove={() => {
              setNamesText(withoutWinner(names).join("\n"));
              setWinner(null);
            }}
            onSpinAgain={() => {
              const next = closeModal();
              requestAnimationFrame(() => spin(next));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function UtilityStudio({ tool }: { tool: Tool }) {
  const slug = tool.slug;
  const panels: Record<string, ReactNode> = {
    "urdu-keyboard": <UrduKeyboard slug={slug} />,
    "voice-typing": <VoiceTyping slug={slug} />,
    "text-to-speech": <TextToSpeech slug={slug} />,
    tasbeeh: <Tasbeeh slug={slug} />,
    timer: <TimerTool slug={slug} />,
    "spin-wheel": <SpinWheel slug={slug} />,
  };

  return (
    <div id="tool" className="scroll-mt-24">
      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="aurora-border rounded-[26px]"
        >
          <div className="glass rounded-[26px] p-4 sm:p-6">{panels[(tool.mode as string | undefined) ?? ""] ?? null}</div>
        </motion.div>
      </MotionConfig>
    </div>
  );
}
