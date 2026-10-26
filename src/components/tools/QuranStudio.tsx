"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  SkipForward,
  Square,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import ShareSheet from "@/components/ShareSheet";
import { trackEvent } from "@/lib/track-event";

/* ------------------------------------------------------------------ *
 * shared helpers (same look as CalculatorStudio)
 * ------------------------------------------------------------------ */

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";
const chip = "rounded-full surface px-3 py-1.5 text-xs font-bold transition-colors hover:border-brand-400/60";
const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl surface text-muted transition-colors hover:border-brand-400/60 hover:text-[var(--fg)] disabled:opacity-40";

/** Records one anonymous use per page view, once the reader has shown a surah. */
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

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* ------------------------------------------------------------------ *
 * fonts — Amiri Quran for the mushaf text, Nastaliq for Urdu
 * ------------------------------------------------------------------ */

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap";
const QURAN_FONT = `"Amiri Quran", "Noto Naskh Arabic", "KFGQPC Uthmanic Script HAFS", "Traditional Arabic", serif`;
const NASTALIQ = `"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Urdu Typesetting", serif`;

/** Loads the Quran/Urdu web fonts once, after mount. */
function useQuranFonts() {
  useEffect(() => {
    if (document.querySelector("link[data-sg-quran-fonts]")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = FONT_HREF;
    css.dataset.sgQuranFonts = "1";
    document.head.append(pre, css);
  }, []);
}

/* ------------------------------------------------------------------ *
 * the 114 surahs — [English name, meaning, Arabic name, ayahs, Meccan?]
 * ------------------------------------------------------------------ */

const SURAH_ROWS: [string, string, string, number, 0 | 1][] = [
  ["Al-Faatiha", "The Opening", "ٱلْفَاتِحَةِ", 7, 1],
  ["Al-Baqara", "The Cow", "البَقَرَةِ", 286, 0],
  ["Aal-i-Imraan", "The Family of Imraan", "آلِ عِمۡرَانَ", 200, 0],
  ["An-Nisaa", "The Women", "النِّسَاءِ", 176, 0],
  ["Al-Maaida", "The Table", "المَائـِدَةِ", 120, 0],
  ["Al-An'aam", "The Cattle", "الأَنۡعَامِ", 165, 1],
  ["Al-A'raaf", "The Heights", "الأَعۡرَافِ", 206, 1],
  ["Al-Anfaal", "The Spoils of War", "الأَنفَالِ", 75, 0],
  ["At-Tawba", "The Repentance", "التَّوۡبَةِ", 129, 0],
  ["Yunus", "Jonas", "يُونُسَ", 109, 1],
  ["Hud", "Hud", "هُودٍ", 123, 1],
  ["Yusuf", "Joseph", "يُوسُفَ", 111, 1],
  ["Ar-Ra'd", "The Thunder", "الرَّعۡدِ", 43, 0],
  ["Ibrahim", "Abraham", "إِبۡرَاهِيمَ", 52, 1],
  ["Al-Hijr", "The Rock", "الحِجۡرِ", 99, 1],
  ["An-Nahl", "The Bee", "النَّحۡلِ", 128, 1],
  ["Al-Israa", "The Night Journey", "الإِسۡرَاءِ", 111, 1],
  ["Al-Kahf", "The Cave", "الكَهۡفِ", 110, 1],
  ["Maryam", "Mary", "مَرۡيَمَ", 98, 1],
  ["Taa-Haa", "Taa-Haa", "طه", 135, 1],
  ["Al-Anbiyaa", "The Prophets", "الأَنبِيَاءِ", 112, 1],
  ["Al-Hajj", "The Pilgrimage", "الحَجِّ", 78, 0],
  ["Al-Muminoon", "The Believers", "المُؤۡمِنُونَ", 118, 1],
  ["An-Noor", "The Light", "النُّورِ", 64, 0],
  ["Al-Furqaan", "The Criterion", "الفُرۡقَانِ", 77, 1],
  ["Ash-Shu'araa", "The Poets", "الشُّعَرَاءِ", 227, 1],
  ["An-Naml", "The Ant", "النَّمۡلِ", 93, 1],
  ["Al-Qasas", "The Stories", "القَصَصِ", 88, 1],
  ["Al-Ankaboot", "The Spider", "العَنكَبُوتِ", 69, 1],
  ["Ar-Room", "The Romans", "الرُّومِ", 60, 1],
  ["Luqman", "Luqman", "لُقۡمَانَ", 34, 1],
  ["As-Sajda", "The Prostration", "السَّجۡدَةِ", 30, 1],
  ["Al-Ahzaab", "The Clans", "الأَحۡزَابِ", 73, 0],
  ["Saba", "Sheba", "سَبَإٍ", 54, 1],
  ["Faatir", "The Originator", "فَاطِرٍ", 45, 1],
  ["Yaseen", "Yaseen", "يسٓ", 83, 1],
  ["As-Saaffaat", "Those drawn up in Ranks", "الصَّافَّاتِ", 182, 1],
  ["Saad", "The letter Saad", "صٓ", 88, 1],
  ["Az-Zumar", "The Groups", "الزُّمَرِ", 75, 1],
  ["Ghafir", "The Forgiver", "غَافِرٍ", 85, 1],
  ["Fussilat", "Explained in detail", "فُصِّلَتۡ", 54, 1],
  ["Ash-Shura", "Consultation", "الشُّورَىٰ", 53, 1],
  ["Az-Zukhruf", "Ornaments of gold", "الزُّخۡرُفِ", 89, 1],
  ["Ad-Dukhaan", "The Smoke", "الدُّخَانِ", 59, 1],
  ["Al-Jaathiya", "Crouching", "الجَاثِيَةِ", 37, 1],
  ["Al-Ahqaf", "The Dunes", "الأَحۡقَافِ", 35, 1],
  ["Muhammad", "Muhammad", "مُحَمَّدٍ", 38, 0],
  ["Al-Fath", "The Victory", "الفَتۡحِ", 29, 0],
  ["Al-Hujuraat", "The Inner Apartments", "الحُجُرَاتِ", 18, 0],
  ["Qaaf", "The letter Qaaf", "قٓ", 45, 1],
  ["Adh-Dhaariyat", "The Winnowing Winds", "الذَّارِيَاتِ", 60, 1],
  ["At-Tur", "The Mount", "الطُّورِ", 49, 1],
  ["An-Najm", "The Star", "النَّجۡمِ", 62, 1],
  ["Al-Qamar", "The Moon", "القَمَرِ", 55, 1],
  ["Ar-Rahmaan", "The Beneficent", "الرَّحۡمَٰن", 78, 0],
  ["Al-Waaqia", "The Inevitable", "الوَاقِعَةِ", 96, 1],
  ["Al-Hadid", "The Iron", "الحَدِيدِ", 29, 0],
  ["Al-Mujaadila", "The Pleading Woman", "المُجَادلَةِ", 22, 0],
  ["Al-Hashr", "The Exile", "الحَشۡرِ", 24, 0],
  ["Al-Mumtahana", "She that is to be examined", "المُمۡتَحنَةِ", 13, 0],
  ["As-Saff", "The Ranks", "الصَّفِّ", 14, 0],
  ["Al-Jumu'a", "Friday", "الجُمُعَةِ", 11, 0],
  ["Al-Munaafiqoon", "The Hypocrites", "المُنَافِقُونَ", 11, 0],
  ["At-Taghaabun", "Mutual Disillusion", "التَّغَابُنِ", 18, 0],
  ["At-Talaaq", "Divorce", "الطَّلَاقِ", 12, 0],
  ["At-Tahrim", "The Prohibition", "التَّحۡرِيمِ", 12, 0],
  ["Al-Mulk", "The Sovereignty", "المُلۡكِ", 30, 1],
  ["Al-Qalam", "The Pen", "القَلَمِ", 52, 1],
  ["Al-Haaqqa", "The Reality", "الحَاقَّةِ", 52, 1],
  ["Al-Ma'aarij", "The Ascending Stairways", "المَعَارِجِ", 44, 1],
  ["Nooh", "Noah", "نُوحٍ", 28, 1],
  ["Al-Jinn", "The Jinn", "الجِنِّ", 28, 1],
  ["Al-Muzzammil", "The Enshrouded One", "المُزَّمِّلِ", 20, 1],
  ["Al-Muddaththir", "The Cloaked One", "المُدَّثِّرِ", 56, 1],
  ["Al-Qiyaama", "The Resurrection", "القِيَامَةِ", 40, 1],
  ["Al-Insaan", "Man", "الإِنسَانِ", 31, 0],
  ["Al-Mursalaat", "The Emissaries", "المُرۡسَلَاتِ", 50, 1],
  ["An-Naba", "The Announcement", "النَّبَإِ", 40, 1],
  ["An-Naazi'aat", "Those who drag forth", "النَّازِعَاتِ", 46, 1],
  ["Abasa", "He frowned", "عَبَسَ", 42, 1],
  ["At-Takwir", "The Overthrowing", "التَّكۡوِيرِ", 29, 1],
  ["Al-Infitaar", "The Cleaving", "الانفِطَارِ", 19, 1],
  ["Al-Mutaffifin", "Defrauding", "المُطَفِّفِينَ", 36, 1],
  ["Al-Inshiqaaq", "The Splitting Open", "الانشِقَاقِ", 25, 1],
  ["Al-Burooj", "The Constellations", "البُرُوجِ", 22, 1],
  ["At-Taariq", "The Morning Star", "الطَّارِقِ", 17, 1],
  ["Al-A'laa", "The Most High", "الأَعۡلَىٰ", 19, 1],
  ["Al-Ghaashiya", "The Overwhelming", "الغَاشِيَةِ", 26, 1],
  ["Al-Fajr", "The Dawn", "الفَجۡرِ", 30, 1],
  ["Al-Balad", "The City", "البَلَدِ", 20, 1],
  ["Ash-Shams", "The Sun", "الشَّمۡسِ", 15, 1],
  ["Al-Lail", "The Night", "اللَّيۡلِ", 21, 1],
  ["Ad-Dhuhaa", "The Morning Hours", "الضُّحَىٰ", 11, 1],
  ["Ash-Sharh", "The Consolation", "الشَّرۡحِ", 8, 1],
  ["At-Tin", "The Fig", "التِّينِ", 8, 1],
  ["Al-Alaq", "The Clot", "العَلَقِ", 19, 1],
  ["Al-Qadr", "The Power, Fate", "القَدۡرِ", 5, 1],
  ["Al-Bayyina", "The Evidence", "البَيِّنَةِ", 8, 0],
  ["Az-Zalzala", "The Earthquake", "الزَّلۡزَلَةِ", 8, 0],
  ["Al-Aadiyaat", "The Chargers", "العَادِيَاتِ", 11, 1],
  ["Al-Qaari'a", "The Calamity", "القَارِعَةِ", 11, 1],
  ["At-Takaathur", "Competition", "التَّكَاثُرِ", 8, 1],
  ["Al-Asr", "The Declining Day, Epoch", "العَصۡرِ", 3, 1],
  ["Al-Humaza", "The Traducer", "الهُمَزَةِ", 9, 1],
  ["Al-Fil", "The Elephant", "الفِيلِ", 5, 1],
  ["Quraish", "Quraysh", "قُرَيۡشٍ", 4, 1],
  ["Al-Maa'un", "Almsgiving", "المَاعُونِ", 7, 1],
  ["Al-Kawthar", "Abundance", "الكَوۡثَرِ", 3, 1],
  ["Al-Kaafiroon", "The Disbelievers", "الكَافِرُونَ", 6, 1],
  ["An-Nasr", "Divine Support", "النَّصۡرِ", 3, 0],
  ["Al-Masad", "The Palm Fibre", "المَسَدِ", 5, 1],
  ["Al-Ikhlaas", "Sincerity", "الإِخۡلَاصِ", 4, 1],
  ["Al-Falaq", "The Dawn", "الفَلَقِ", 5, 1],
  ["An-Naas", "Mankind", "النَّاسِ", 6, 1],
];

type Surah = { n: number; en: string; meaning: string; ar: string; ayahs: number; meccan: boolean };
const SURAHS: Surah[] = SURAH_ROWS.map(([en, meaning, ar, ayahs, meccan], i) => ({
  n: i + 1,
  en,
  meaning,
  ar,
  ayahs,
  meccan: meccan === 1,
}));

/** Spellings people type in Pakistan and India, by surah number. */
const ALIASES: Record<number, string> = {
  1: "fatiha fateha alhamd hamd",
  2: "baqarah baqra",
  3: "imran ale imran",
  4: "nisa",
  5: "maidah maida",
  6: "anam",
  7: "araf",
  9: "tauba taubah tawbah baraat",
  10: "younus yunus",
  11: "hood hud",
  12: "yousuf yusuf",
  13: "raad",
  17: "bani israel isra",
  19: "maryam mariam",
  20: "taha",
  23: "muminoon",
  24: "noor nur",
  26: "shuara",
  30: "room rum",
  32: "sajdah sajda",
  36: "yaseen yasin",
  37: "saffat",
  38: "saad",
  40: "momin ghafir",
  41: "ha meem sajdah fussilat",
  45: "jasiyah",
  48: "fatah fath",
  50: "qaaf",
  51: "zariyat",
  52: "toor",
  55: "rehman rahman",
  56: "waqiah waqia",
  57: "hadeed",
  58: "mujadila",
  60: "mumtahina",
  62: "jumma jumuah",
  63: "munafiqoon",
  66: "tahreem",
  67: "mulk tabarak",
  68: "qalam noon",
  70: "maarij",
  71: "nooh",
  73: "muzammil",
  74: "muddassir",
  75: "qiyamah",
  76: "dahr insan",
  78: "naba amma",
  79: "naziat",
  81: "takweer",
  83: "mutaffifeen",
  85: "burooj",
  87: "aala",
  88: "ghashiyah",
  92: "lail",
  93: "duha zuha",
  94: "inshirah alam nashrah sharh",
  95: "teen",
  96: "iqra alaq",
  99: "zilzal zalzalah",
  102: "takasur takathur",
  104: "humazah",
  105: "feel fil",
  106: "quraish",
  107: "maoon",
  108: "kausar kawthar",
  109: "kafiroon",
  111: "lahab masad tabbat",
  112: "ikhlas",
  114: "naas nas",
};

const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ﻿]/g;
const plainArabic = (s: string) => s.replace(AR_MARKS, "").replace(/ٱ/g, "ا").replace(/\s+/g, "");

/** Folds spelling differences: "Yaa-Seen", "yaseen" and "yasin" all become "yasin". */
function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/\b(surah|surat|sura|soorah|surha)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/e/g, "i")
    .replace(/o/g, "u")
    .replace(/(.)\1/g, "$1");
}

const SEARCH_INDEX = SURAHS.map((s) => ({
  s,
  latin: [s.en, s.meaning, ALIASES[s.n] ?? "", ...(ALIASES[s.n] ?? "").split(" ")].map(fold).filter(Boolean),
  arabic: plainArabic(s.ar),
}));

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** Brings an ayah into view: centred when it fits on screen, otherwise from its first line. */
function reveal(el: HTMLElement | null, smooth = false) {
  if (!el) return;
  const tall = el.offsetHeight > window.innerHeight * 0.75;
  el.scrollIntoView({ block: tall ? "start" : "center", behavior: smooth ? "smooth" : "auto" });
}

/* ------------------------------------------------------------------ *
 * AlQuran Cloud API + islamic.network audio CDN
 * ------------------------------------------------------------------ */

const API = "https://api.alquran.cloud/v1";
const EDITIONS = ["quran-uthmani", "ur.jalandhry", "en.sahih"] as const;
const CACHE_NAME = "sg-quran-v1";

const RECITERS = [
  { id: "ar.alafasy", name: "Mishary Rashid Alafasy", kbps: 128 },
  { id: "ar.husary", name: "Mahmoud Khalil Al-Husary", kbps: 128 },
  { id: "ar.minshawi", name: "Muhammad Siddiq Al-Minshawi", kbps: 128 },
  { id: "ar.abdulbasitmurattal", name: "Abdul Basit Abdus Samad", kbps: 64 },
  { id: "ar.abdurrahmaansudais", name: "Abdur-Rahman As-Sudais", kbps: 64 },
  { id: "ar.mahermuaiqly", name: "Maher Al-Muaiqly", kbps: 128 },
  { id: "ar.saoodshuraym", name: "Saud Ash-Shuraim", kbps: 64 },
] as const;
type ReciterId = (typeof RECITERS)[number]["id"];

/** Per-ayah MP3 by the ayah's number in the whole Quran (1–6236). */
function audioUrl(reciter: ReciterId, globalAyah: number) {
  const r = RECITERS.find((x) => x.id === reciter) ?? RECITERS[0];
  return `https://cdn.islamic.network/quran/audio/${r.kbps}/${r.id}/${globalAyah}.mp3`;
}

type Ayah = { n: number; g: number; ar: string; ur: string; en: string; juz: number; sajda: boolean };

type ApiAyah = { number: number; numberInSurah: number; text: string; juz: number; sajda: boolean | object };
type ApiEdition = { edition: { identifier: string }; ayahs: ApiAyah[] };

const memory = new Map<number, Ayah[]>();

/** The API puts the Bismillah at the start of ayah 1 of every surah except 1 and 9; it is shown separately here. */
function withoutBasmala(text: string) {
  const words = text.trim().split(/\s+/);
  if (words.length > 4 && plainArabic(words.slice(0, 4).join(" ")) === "بسماللهالرحمنالرحيم") return words.slice(4).join(" ");
  return text;
}

async function loadSurah(n: number, signal: AbortSignal): Promise<Ayah[]> {
  const hit = memory.get(n);
  if (hit) return hit;
  const url = `${API}/surah/${n}/editions/${EDITIONS.join(",")}`;
  let cache: Cache | null = null;
  let res: Response | undefined;
  try {
    cache = "caches" in window ? await caches.open(CACHE_NAME) : null;
    res = (await cache?.match(url)) ?? undefined;
  } catch {
    cache = null;
  }
  if (!res) {
    res = await fetch(url, { signal });
    if (!res.ok) throw new Error(res.status === 429 ? "Too many requests — please wait a moment." : `The Quran server replied ${res.status}.`);
    if (cache) cache.put(url, res.clone()).catch(() => {});
  }
  const json = (await res.json()) as { code?: number; data?: ApiEdition[] };
  const pick = (id: string) => json.data?.find((d) => d.edition?.identifier === id)?.ayahs;
  const ar = pick("quran-uthmani");
  const ur = pick("ur.jalandhry");
  const en = pick("en.sahih");
  if (json.code !== 200 || !ar || !ur || !en || ar.length === 0) throw new Error("The Quran server sent an unexpected reply.");
  const ayahs = ar.map((a, i) => {
    const text = a.text.replace(/﻿/g, "");
    return {
      n: a.numberInSurah,
      g: a.number,
      ar: i === 0 && n !== 1 && n !== 9 ? withoutBasmala(text) : text,
      ur: ur[i]?.text.replace(/﻿/g, "") ?? "",
      en: en[i]?.text ?? "",
      juz: a.juz,
      sajda: !!a.sajda,
    };
  });
  memory.set(n, ayahs);
  return ayahs;
}

/* ------------------------------------------------------------------ *
 * preferences
 * ------------------------------------------------------------------ */

type Prefs = { ur: boolean; en: boolean; size: number; reciter: ReciterId; follow: boolean };
const DEFAULT_PREFS: Prefs = { ur: true, en: true, size: 30, reciter: "ar.alafasy", follow: true };
const PREFS_KEY = "sg-quran-prefs";
const LAST_KEY = "sg-quran-last";
type LastRead = { s: number; a: number };

const MIN_SIZE = 20;
const MAX_SIZE = 52;

const QUICK: { label: string; s: number; a?: number }[] = [
  { label: "Ayat al-Kursi", s: 2, a: 255 },
  { label: "Yaseen", s: 36 },
  { label: "Ar-Rahman", s: 55 },
  { label: "Al-Waqiah", s: 56 },
  { label: "Al-Mulk", s: 67 },
  { label: "Al-Kahf", s: 18 },
  { label: "Al-Fatiha", s: 1 },
];

/* ------------------------------------------------------------------ *
 * small presentational pieces
 * ------------------------------------------------------------------ */

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
        checked ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function AyahNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="mx-1 inline-flex h-[1.6em] min-w-[1.6em] items-center justify-center rounded-full border border-brand-400/50 px-1 align-middle text-[0.55em] leading-none text-brand-500 dark:text-brand-300"
    >
      {toArabicDigits(n)}
    </span>
  );
}

function SurahCard({ s, onOpen, last }: { s: Surah; onOpen: () => void; last?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex w-full min-w-0 items-center gap-3 rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400/60 sm:p-4 ${
        last ? "bg-brand-500/10 ring-1 ring-brand-400/50" : "surface"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-extrabold text-white">
        {s.n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{s.en}</span>
        <span className="block truncate text-xs text-muted">
          {s.meaning} · {s.ayahs} ayahs · {s.meccan ? "Makki" : "Madani"}
        </span>
      </span>
      <span dir="rtl" lang="ar" className="shrink-0 text-xl leading-none" style={{ fontFamily: QURAN_FONT }}>
        {s.ar}
      </span>
    </button>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading surah">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl surface p-4">
          <div className="h-4 w-14 rounded bg-[var(--line)]" />
          <div className="ml-auto mt-4 h-7 w-11/12 rounded bg-[var(--line)]" />
          <div className="ml-auto mt-2 h-7 w-3/4 rounded bg-[var(--line)]" />
          <div className="mt-4 h-3.5 w-full rounded bg-[var(--line)]" />
          <div className="mt-2 h-3.5 w-2/3 rounded bg-[var(--line)]" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * the reader
 * ------------------------------------------------------------------ */

type PlayState = { s: number; i: number; mode: "surah" | "ayah" };

function QuranReader({ slug }: { slug: string }) {
  useQuranFonts();
  const [view, setView] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [last, setLast] = useState<LastRead | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [loaded, setLoaded] = useState<{ s: number; ayahs: Ayah[] } | null>(null);
  const [failed, setFailed] = useState<{ s: number; msg: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [jump, setJump] = useState("");
  const [play, setPlay] = useState<PlayState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const nextRef = useRef<HTMLAudioElement | null>(null);
  const target = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const surah = view ? SURAHS[view - 1] : null;
  const ayahs = loaded && loaded.s === view ? loaded.ayahs : null;
  const error = failed && failed.s === view ? failed.msg : null;
  const hasBasmala = view !== null && view !== 1 && view !== 9;
  useTrackOnce(slug, !!ayahs);

  // browser-only state: saved preferences, last read, and a ?surah=&ayah= link
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = readJson<Partial<Prefs>>(PREFS_KEY);
      if (saved) setPrefs((p) => ({ ...p, ...saved, reciter: RECITERS.some((r) => r.id === saved.reciter) ? saved.reciter! : p.reciter }));
      const l = readJson<LastRead>(LAST_KEY);
      if (l && l.s >= 1 && l.s <= 114) setLast(l);
      const params = new URLSearchParams(window.location.search);
      const s = Number(params.get("surah"));
      const a = Number(params.get("ayah"));
      if (Number.isInteger(s) && s >= 1 && s <= 114) {
        target.current = Number.isInteger(a) && a >= 1 && a <= SURAHS[s - 1].ayahs ? a : null;
        setView(s);
      }
      setPageUrl(window.location.origin + window.location.pathname);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // fetch the open surah (memory → Cache Storage → network)
  useEffect(() => {
    if (view === null) return;
    const ctrl = new AbortController();
    loadSurah(view, ctrl.signal)
      .then((a) => {
        if (!ctrl.signal.aborted) setLoaded({ s: view, ayahs: a });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setFailed({
          s: view,
          msg: offline ? "You appear to be offline. Connect to the internet and try again." : e instanceof Error && !/fetch/i.test(e.message) ? e.message : "Could not reach the Quran server.",
        });
      });
    return () => ctrl.abort();
  }, [view, attempt]);

  // once a surah is on screen, go to the requested ayah (or the top of the reader)
  useEffect(() => {
    if (!ayahs) return;
    const a = target.current;
    target.current = null;
    let alive = true;
    const go = () => {
      if (!alive) return;
      const el = a ? document.getElementById(`ayah-${a}`) : document.getElementById("tool");
      if (a) reveal(el); else el?.scrollIntoView({ block: "start" });
    };
    const id = requestAnimationFrame(go);
    // the Arabic/Urdu web fonts change line heights when they arrive, so aim again once they have loaded
    if (a) document.fonts?.ready.then(() => requestAnimationFrame(go)).catch(() => {});
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [ayahs]);

  // remember the ayah being read
  useEffect(() => {
    if (!ayahs || view === null || !listRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.ayah));
        if (!seen.length) return;
        const a = Math.min(...seen);
        writeJson(LAST_KEY, { s: view, a });
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    listRef.current.querySelectorAll("[data-ayah]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ayahs, view]);

  // follow the recitation
  useEffect(() => {
    if (!play || !prefs.follow) return;
    const el = document.getElementById(play.i === 0 ? "basmala" : `ayah-${play.i}`);
    reveal(el, true);
  }, [play, prefs.follow]);

  // buffer the next ayah so surah playback runs without gaps
  useEffect(() => {
    if (!play || play.mode !== "surah" || !ayahs || play.i >= ayahs.length) return;
    const next = new Audio();
    next.preload = "auto";
    next.src = audioUrl(prefs.reciter, ayahs[play.i].g);
    nextRef.current = next;
    return () => {
      next.removeAttribute("src");
      next.load();
    };
  }, [play, ayahs, prefs.reciter]);

  // lock-screen / notification title on phones
  useEffect(() => {
    if (!play || !surah || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: play.i === 0 ? `Bismillah — Surah ${surah.en}` : `Surah ${surah.en} — Ayah ${play.i}`,
        artist: RECITERS.find((r) => r.id === prefs.reciter)?.name ?? "",
        album: "The Holy Quran",
      });
    } catch {}
  }, [play, surah, prefs.reciter]);

  // stop the audio when the reader goes away
  useEffect(() => {
    const el = audioRef.current;
    return () => el?.pause();
  }, []);

  function updatePrefs(patch: Partial<Prefs>) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writeJson(PREFS_KEY, next);
      return next;
    });
  }

  function stop() {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setPlay(null);
    setPlaying(false);
    setBuffering(false);
  }

  function open(s: number, a?: number) {
    stop();
    target.current = a ?? null;
    setFailed(null);
    setView(s);
    setJump("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("surah", String(s));
      if (a) url.searchParams.set("ayah", String(a));
      else url.searchParams.delete("ayah");
      window.history.replaceState(null, "", url);
    } catch {}
  }

  function backToList() {
    stop();
    setView(null);
    const l = readJson<LastRead>(LAST_KEY);
    if (l) setLast(l);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("surah");
      url.searchParams.delete("ayah");
      window.history.replaceState(null, "", url);
    } catch {}
    requestAnimationFrame(() => document.getElementById("tool")?.scrollIntoView({ block: "start" }));
  }

  function startAt(i: number, mode: PlayState["mode"], reciter: ReciterId = prefs.reciter) {
    const el = audioRef.current;
    if (!el || !ayahs || view === null) return;
    const g = i === 0 ? 1 : ayahs[i - 1]?.g; // the Bismillah recitation is ayah 1 of Al-Fatiha
    if (!g) return;
    el.src = audioUrl(reciter, g);
    setBuffering(true);
    el.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setBuffering(false);
      setPlaying(false);
      notify.error("Could not play the recitation", "Check your connection and try again.");
    });
    setPlay({ s: view, i, mode });
    if (i > 0) writeJson(LAST_KEY, { s: view, a: i });
  }

  function playSurah(from = 1) {
    trackEvent("play", slug);
    startAt(from === 1 && hasBasmala ? 0 : from, "surah");
  }

  function toggleAyah(n: number) {
    const el = audioRef.current;
    if (play && play.i === n && el) {
      if (el.paused) el.play().catch(() => {});
      else el.pause();
      return;
    }
    trackEvent("play", slug);
    startAt(n, "ayah");
  }

  function togglePause() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function onEnded() {
    if (!play || !ayahs) return;
    if (play.mode === "surah" && play.i < ayahs.length) startAt(play.i + 1, "surah");
    else {
      setPlay(null);
      setPlaying(false);
    }
  }

  function skip() {
    if (!play || !ayahs) return;
    if (play.i < ayahs.length) startAt(play.i + 1, play.mode === "ayah" ? "ayah" : "surah");
    else stop();
  }

  function goToAyah() {
    const a = Number(jump);
    if (!surah || !Number.isInteger(a) || a < 1 || a > surah.ayahs) {
      notify.warning("Enter an ayah number", surah ? `Surah ${surah.en} has ${surah.ayahs} ayahs.` : undefined);
      return;
    }
    reveal(document.getElementById(`ayah-${a}`), true);
    writeJson(LAST_KEY, { s: view, a });
  }

  function ayahText(a: Ayah) {
    if (!surah) return "";
    const parts = [a.ar];
    if (prefs.ur) parts.push(a.ur);
    if (prefs.en) parts.push(a.en);
    return `${parts.join("\n\n")}\n\n— Quran ${surah.n}:${a.n} (Surah ${surah.en})`;
  }

  async function copyAyah(a: Ayah) {
    try {
      await navigator.clipboard.writeText(ayahText(a));
      notify.success("Ayah copied", `Surah ${surah?.en} ${surah?.n}:${a.n}`);
      trackEvent("copy", slug);
    } catch {
      notify.error("Could not copy", "Select the text and copy it manually.");
    }
  }

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return SURAHS;
    const ref = q.match(/^(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?$/);
    if (ref) {
      const s = SURAHS[Number(ref[1]) - 1];
      return s ? [s] : [];
    }
    const ar = plainArabic(q);
    if (/[؀-ۿ]/.test(ar)) return SEARCH_INDEX.filter((x) => x.arabic.includes(ar)).map((x) => x.s);
    const f = fold(q);
    if (!f) return SURAHS;
    return SEARCH_INDEX.filter((x) => x.latin.some((w) => w.includes(f))).map((x) => x.s);
  }, [query]);

  function submitSearch() {
    const ref = query.trim().match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
    if (ref) {
      const s = Number(ref[1]);
      const a = Number(ref[2]);
      if (s >= 1 && s <= 114 && a >= 1 && a <= SURAHS[s - 1].ayahs) return open(s, a);
    }
    if (/kursi/i.test(query)) return open(2, 255);
    if (results.length === 1) open(results[0].n);
  }

  const reciterName = RECITERS.find((r) => r.id === prefs.reciter)?.name ?? "";
  const urSize = Math.round(prefs.size * 0.62);
  const enSize = Math.max(14, Math.round(prefs.size * 0.52));

  /* ---------------- surah list ---------------- */
  if (view === null || !surah) {
    const lastSurah = last ? SURAHS[last.s - 1] : null;
    return (
      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Read the Holy Quran</h2>
            <p className="text-sm text-muted">Arabic text with Urdu and English translation, and verse-by-verse recitation.</p>
          </div>
        </div>

        {lastSurah && last && (
          <button
            type="button"
            onClick={() => open(last.s, last.a)}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 p-4 text-left text-white shadow-lg shadow-brand-500/25 transition-transform hover:-translate-y-0.5"
          >
            <BookOpen className="h-6 w-6 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-white/80">Continue reading</span>
              <span className="block truncate font-extrabold">
                Surah {lastSurah.en} · Ayah {last.a}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
          </button>
        )}

        <form
          className="relative mt-4"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: Yaseen, Rehman, 67, 2:255, الملك"
            aria-label="Search surah by name or number"
            className={`${field} pl-10`}
            enterKeyHint="search"
          />
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q.label} type="button" onClick={() => open(q.s, q.a)} className={chip}>
              {q.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold text-muted" aria-live="polite">
          {query.trim() ? `${results.length} ${results.length === 1 ? "surah" : "surahs"} found` : "114 surahs"}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {results.map((s) => (
            <SurahCard key={s.n} s={s} last={last?.s === s.n} onOpen={() => open(s.n)} />
          ))}
        </div>
        {results.length === 0 && (
          <div className="mt-2 rounded-2xl surface p-6 text-center text-sm text-muted">
            No surah matches “{query}”. Try the surah number (1–114) or another spelling.
          </div>
        )}
        <Attribution />
      </div>
    );
  }

  /* ---------------- reader ---------------- */
  const playingThis = play && play.s === view;
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={backToList} aria-label="All surahs" className={`${iconBtn} gap-1.5 text-sm font-bold sm:w-auto sm:px-3`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Surahs</span>
        </button>
        <select
          value={view}
          onChange={(e) => open(Number(e.target.value))}
          aria-label="Choose surah"
          className={`${field} min-w-0 flex-1 py-2`}
        >
          {SURAHS.map((s) => (
            <option key={s.n} value={s.n}>
              {s.n}. {s.en}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => open(view - 1)} disabled={view <= 1} aria-label="Previous surah" className={iconBtn}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => open(view + 1)} disabled={view >= 114} aria-label="Next surah" className={iconBtn}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <header className="mt-4 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 p-5 text-center text-white">
        <p dir="rtl" lang="ar" className="text-3xl leading-[1.6] sm:text-4xl" style={{ fontFamily: QURAN_FONT }}>
          سُورَةُ {surah.ar}
        </p>
        <h2 className="mt-1 text-xl font-extrabold">Surah {surah.en}</h2>
        <p className="text-sm text-white/85">
          {surah.meaning} · {surah.ayahs} ayahs · {surah.meccan ? "Makki (Meccan)" : "Madani (Medinan)"}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {playingThis && play.mode === "surah" ? (
            <>
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-brand-600 shadow-lg"
              >
                {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                {playing ? "Pause" : "Resume"}
              </button>
              <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold">
                <Square className="h-4 w-4" aria-hidden /> Stop
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => playSurah(1)}
              disabled={!ayahs}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-brand-600 shadow-lg disabled:opacity-60"
            >
              <Play className="h-4 w-4" aria-hidden /> Play surah
            </button>
          )}
        </div>
      </header>

      {/* settings */}
      <div className="mt-4 grid gap-3 rounded-2xl surface p-3 sm:grid-cols-2 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Show</span>
          <Switch checked={prefs.ur} onChange={(v) => updatePrefs({ ur: v })}>
            Urdu
          </Switch>
          <Switch checked={prefs.en} onChange={(v) => updatePrefs({ en: v })}>
            English
          </Switch>
          <Switch checked={prefs.follow} onChange={(v) => updatePrefs({ follow: v })}>
            Auto-scroll
          </Switch>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Text size</span>
          <button
            type="button"
            onClick={() => updatePrefs({ size: Math.max(MIN_SIZE, prefs.size - 2) })}
            disabled={prefs.size <= MIN_SIZE}
            aria-label="Smaller text"
            className={iconBtn}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-bold tabular-nums" aria-live="polite">
            {prefs.size}
          </span>
          <button
            type="button"
            onClick={() => updatePrefs({ size: Math.min(MAX_SIZE, prefs.size + 2) })}
            disabled={prefs.size >= MAX_SIZE}
            aria-label="Larger text"
            className={iconBtn}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Reciter</span>
          <select
            value={prefs.reciter}
            onChange={(e) => {
              const r = e.target.value as ReciterId;
              updatePrefs({ reciter: r });
              if (play) startAt(play.i, play.mode, r);
            }}
            className={`${field} py-2`}
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="block"
          onSubmit={(e) => {
            e.preventDefault();
            goToAyah();
          }}
        >
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Go to ayah</span>
          <span className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={surah.ayahs}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              placeholder={`1–${surah.ayahs}`}
              aria-label={`Ayah number, 1 to ${surah.ayahs}`}
              className={`${field} py-2`}
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 text-sm font-bold text-white shadow-lg shadow-brand-500/25"
            >
              Go
            </button>
          </span>
        </form>
      </div>

      {error ? (
        <div role="alert" className="mt-6 rounded-2xl surface p-6 text-center">
          <p className="font-bold">Could not load Surah {surah.en}</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(null);
              setAttempt((n) => n + 1);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      ) : !ayahs ? (
        <ReaderSkeleton />
      ) : (
        <div ref={listRef} className="mt-6 space-y-3">
          {hasBasmala && (
            <p
              id="basmala"
              dir="rtl"
              lang="ar"
              className={`scroll-mt-28 rounded-2xl py-3 text-center transition-colors ${
                playingThis && play.i === 0 ? "bg-brand-500/10 ring-2 ring-brand-400/60" : ""
              }`}
              style={{ fontFamily: QURAN_FONT, fontSize: Math.round(prefs.size * 1.05), lineHeight: 2 }}
            >
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
          )}
          {ayahs.map((a) => {
            const active = playingThis && play.i === a.n;
            return (
              <article
                key={a.n}
                id={`ayah-${a.n}`}
                data-ayah={a.n}
                aria-label={`Ayah ${a.n}`}
                className={`scroll-mt-28 rounded-2xl p-4 transition-colors sm:p-5 ${
                  active ? "bg-brand-500/10 ring-2 ring-brand-400/60" : "surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted">
                    <span className="rounded-lg bg-brand-500/10 px-2 py-1 text-brand-600 dark:text-brand-300">
                      {surah.n}:{a.n}
                    </span>
                    <span>Juz {a.juz}</span>
                    {a.sajda && <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-700 dark:text-amber-300">Sajdah</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleAyah(a.n)}
                      aria-label={active && playing ? `Pause ayah ${a.n}` : `Play ayah ${a.n}`}
                      className={iconBtn}
                    >
                      {active && buffering ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : active && playing ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button type="button" onClick={() => copyAyah(a)} aria-label={`Copy ayah ${a.n}`} className={iconBtn}>
                      <Copy className="h-4 w-4" />
                    </button>
                    <ShareSheet
                      variant="icon"
                      title={`Quran ${surah.n}:${a.n} — Surah ${surah.en}`}
                      text={`${a.ar}\n\n${prefs.en || !prefs.ur ? a.en : a.ur}\n\n— Quran ${surah.n}:${a.n} (Surah ${surah.en})`}
                      url={pageUrl ? `${pageUrl}?surah=${surah.n}&ayah=${a.n}` : undefined}
                    />
                  </span>
                </div>
                <p
                  dir="rtl"
                  lang="ar"
                  className="mt-3 text-right"
                  style={{ fontFamily: QURAN_FONT, fontSize: prefs.size, lineHeight: 2.2 }}
                >
                  {a.ar}
                  <AyahNumber n={a.n} />
                </p>
                {prefs.ur && (
                  <p dir="rtl" lang="ur" className="mt-3 text-right text-muted" style={{ fontFamily: NASTALIQ, fontSize: urSize, lineHeight: 2.3 }}>
                    {a.ur}
                  </p>
                )}
                {prefs.en && (
                  <p lang="en" className="mt-2 text-muted" style={{ fontSize: enSize, lineHeight: 1.65 }}>
                    {a.en}
                  </p>
                )}
              </article>
            );
          })}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button type="button" onClick={() => open(view - 1)} disabled={view <= 1} className={`${chip} inline-flex items-center gap-1 disabled:opacity-40`}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {view > 1 ? SURAHS[view - 2].en : "Previous"}
            </button>
            <button type="button" onClick={() => open(view + 1)} disabled={view >= 114} className={`${chip} inline-flex items-center gap-1 disabled:opacity-40`}>
              {view < 114 ? SURAHS[view].en : "Next"} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {playingThis && (
        <div className="sticky bottom-3 z-20 mt-4 flex items-center gap-2 rounded-2xl glass p-2.5 shadow-xl sm:p-3" role="region" aria-label="Recitation player">
          <button
            type="button"
            onClick={togglePause}
            aria-label={playing ? "Pause recitation" : "Resume recitation"}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
          >
            {buffering ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {play.i === 0 ? "Bismillah" : `Ayah ${play.i} of ${surah.ayahs}`} · {surah.en}
            </span>
            <span className="block truncate text-xs text-muted">{reciterName}</span>
          </span>
          {play.mode === "surah" && (
            <button type="button" onClick={skip} aria-label="Next ayah" className={iconBtn}>
              <SkipForward className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={stop} aria-label="Stop recitation" className={iconBtn}>
            <Square className="h-4 w-4" />
          </button>
        </div>
      )}

      <audio
        ref={audioRef}
        preload="auto"
        onPlaying={() => {
          setPlaying(true);
          setBuffering(false);
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onEnded={onEnded}
        onError={() => {
          if (!play) return;
          setBuffering(false);
          setPlaying(false);
          notify.error("Recitation not available", "This ayah's audio could not be loaded. Try another reciter or check your connection.");
        }}
        className="hidden"
      />

      <Attribution />
    </div>
  );
}

function Attribution() {
  return (
    <p className="mt-6 text-xs leading-relaxed text-muted">
      Arabic text: Uthmani script (Tanzil). Urdu translation: Maulana Fateh Muhammad Jalandhry. English translation: Saheeh
      International. Recitation: islamic.network. Delivered by the free{" "}
      <a href="https://alquran.cloud" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--fg)]">
        AlQuran Cloud
      </a>{" "}
      API. A translation conveys the meaning of the Quran in another language; it is not the Quran itself. Please treat the
      text with respect.
    </p>
  );
}

/* ------------------------------------------------------------------ */

export default function QuranStudio({ tool }: { tool: Tool }) {
  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <QuranReader slug={tool.slug} />
        </div>
      </motion.div>
    </div>
  );
}
