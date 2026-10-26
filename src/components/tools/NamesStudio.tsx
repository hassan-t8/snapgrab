"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Heart, Search, Shuffle, X } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import ShareSheet from "@/components/ShareSheet";
import { trackEvent } from "@/lib/track-event";
import { MUSLIM_NAMES, type MuslimName, type NameGender, type NameOrigin } from "@/lib/data/muslim-names";

/* ------------------------------------------------------------------ *
 * shared helpers (same look as CalculatorStudio)
 * ------------------------------------------------------------------ */

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";
const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl surface text-muted transition-colors hover:border-brand-400/60 hover:text-[var(--fg)]";

/** Records one anonymous use per page view, once the visitor has actually used the finder. */
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
 * Urdu font (same approach as UtilityStudio)
 * ------------------------------------------------------------------ */

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap";
const NASTALIQ = `"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Urdu Typesetting", serif`;

function useUrduFont() {
  useEffect(() => {
    if (document.querySelector("link[data-sg-urdu-font]")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = FONT_HREF;
    css.dataset.sgUrduFont = "1";
    document.head.append(pre, css);
  }, []);
}

/* ------------------------------------------------------------------ *
 * search
 * ------------------------------------------------------------------ */

/** Folds spelling variants: Ayesha / Aisha, Yousuf / Yusuf, Usman / Osman, Mohammad / Muhammad. */
function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/y/g, "i")
    .replace(/e/g, "i")
    .replace(/o/g, "u")
    .replace(/w/g, "u")
    .replace(/(.)\1/g, "$1");
}

const URDU_MARKS = /[ً-ٰٟ]/g;
const INDEX = MUSLIM_NAMES.map((n) => ({
  n,
  key: fold(n.name),
  urdu: n.urdu.replace(URDU_MARKS, "").replace(/\s+/g, ""),
  meaning: n.meaning.toLowerCase(),
}));

const LETTERS = Array.from(new Set(MUSLIM_NAMES.map((n) => n.name[0].toUpperCase()))).sort();
const ORIGINS = Array.from(new Set(MUSLIM_NAMES.map((n) => n.origin))).sort() as NameOrigin[];
const PAGE = 48;
const FAV_KEY = "sg-names-favs";

type GenderFilter = "all" | "m" | "f";
const GENDER_LABEL: Record<NameGender, string> = { m: "Boy", f: "Girl", u: "Boy or girl" };

const genderTone = (g: NameGender) =>
  g === "m"
    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
    : g === "f"
      ? "bg-pink-500/15 text-pink-700 dark:text-pink-300"
      : "bg-violet-500/15 text-violet-700 dark:text-violet-300";

/* ------------------------------------------------------------------ *
 * cards
 * ------------------------------------------------------------------ */

function NameCard({
  n,
  fav,
  onFav,
  onOpen,
}: {
  n: MuslimName;
  fav: boolean;
  onFav: () => void;
  onOpen: () => void;
}) {
  return (
    <li className="flex flex-col rounded-2xl surface p-4 transition-all hover:-translate-y-0.5 hover:border-brand-400/60">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="block truncate text-lg font-extrabold">{n.name}</span>
          <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
            <span className={`rounded-md px-1.5 py-0.5 ${genderTone(n.gender)}`}>{GENDER_LABEL[n.gender]}</span>
            <span className="rounded-md bg-[var(--line)] px-1.5 py-0.5 text-muted">{n.origin}</span>
          </span>
        </button>
        <span dir="rtl" lang="ur" className="shrink-0 text-xl leading-[2]" style={{ fontFamily: NASTALIQ }}>
          {n.urdu}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm text-muted">{n.meaning}</p>
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onFav}
          aria-pressed={fav}
          aria-label={fav ? `Remove ${n.name} from favourites` : `Save ${n.name} to favourites`}
          className={`${iconBtn} ${fav ? "text-pink-500 hover:text-pink-500" : ""}`}
        >
          <Heart className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
        </button>
        <button type="button" onClick={onOpen} className="rounded-xl surface px-3 py-2 text-xs font-bold hover:border-brand-400/60">
          Details
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * the finder
 * ------------------------------------------------------------------ */

function NameFinder({ slug }: { slug: string }) {
  useUrduFont();
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [letter, setLetter] = useState<string>("");
  const [origin, setOrigin] = useState<NameOrigin | "">("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<MuslimName | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [used, setUsed] = useState(false);
  useTrackOnce(slug, used);

  // browser-only state: favourites and a shared ?name= link
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
        if (Array.isArray(raw)) setFavs(raw.filter((x): x is string => typeof x === "string"));
      } catch {}
      const shared = new URLSearchParams(window.location.search).get("name");
      if (shared) {
        const hit = MUSLIM_NAMES.find((n) => n.name.toLowerCase() === shared.toLowerCase());
        if (hit) setPicked(hit);
      }
      setPageUrl(window.location.origin + window.location.pathname);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    const f = fold(q);
    const urduQ = q.replace(URDU_MARKS, "").replace(/\s+/g, "");
    const isUrdu = /[؀-ۿ]/.test(q);
    const favSet = new Set(favs);
    return INDEX.filter(({ n, key, urdu, meaning }) => {
      if (gender !== "all" && n.gender !== gender && n.gender !== "u") return false;
      if (letter && n.name[0].toUpperCase() !== letter) return false;
      if (origin && n.origin !== origin) return false;
      if (onlyFavs && !favSet.has(n.name)) return false;
      if (!q) return true;
      if (isUrdu) return urdu.includes(urduQ);
      return key.includes(f) || meaning.includes(q.toLowerCase());
    })
      .sort((a, b) => {
        // names that start with the query first, then the rest alphabetically
        if (f && !isUrdu) {
          const sa = a.key.startsWith(f) ? 0 : 1;
          const sb = b.key.startsWith(f) ? 0 : 1;
          if (sa !== sb) return sa - sb;
        }
        return a.n.name.localeCompare(b.n.name);
      })
      .map((x) => x.n);
  }, [query, gender, letter, origin, onlyFavs, favs]);

  function touch() {
    setLimit(PAGE);
    setUsed(true);
  }

  function toggleFav(name: string) {
    setUsed(true);
    setFavs((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (!favs.includes(name)) trackEvent("favourite", slug);
  }

  function openName(n: MuslimName) {
    setPicked(n);
    setUsed(true);
    requestAnimationFrame(() => document.getElementById("name-spotlight")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function randomName() {
    const pool = results.length ? results : MUSLIM_NAMES;
    let n = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && picked && n.name === picked.name) n = pool[(pool.indexOf(n) + 1) % pool.length];
    trackEvent("random", slug);
    openName(n);
  }

  function clearFilters() {
    setQuery("");
    setGender("all");
    setLetter("");
    setOrigin("");
    setOnlyFavs(false);
    setLimit(PAGE);
  }

  async function copyName(n: MuslimName) {
    try {
      await navigator.clipboard.writeText(`${n.name} (${n.urdu}) — ${n.meaning}`);
      notify.success("Copied", n.name);
      trackEvent("copy", slug);
    } catch {
      notify.error("Could not copy", "Select the text and copy it manually.");
    }
  }

  const filtered = query.trim() !== "" || gender !== "all" || letter !== "" || origin !== "" || onlyFavs;
  const shown = results.slice(0, limit);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Search names or meanings</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              touch();
            }}
            placeholder="Search a name, meaning (e.g. light) or Urdu"
            className={`${field} pl-10`}
            enterKeyHint="search"
          />
        </label>
        <button
          type="button"
          onClick={randomName}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-transform hover:-translate-y-0.5"
        >
          <Shuffle className="h-4 w-4" aria-hidden /> Random name
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Toggle
          label="Gender"
          value={gender}
          onChange={(v) => {
            setGender(v);
            touch();
          }}
          options={[
            { value: "all", label: "All" },
            { value: "m", label: "Boys" },
            { value: "f", label: "Girls" },
          ]}
        />
        <label className="block">
          <span className="sr-only">Origin</span>
          <select
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value as NameOrigin | "");
              touch();
            }}
            className={field}
          >
            <option value="">All origins</option>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={onlyFavs}
          onClick={() => {
            setOnlyFavs((v) => !v);
            touch();
          }}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            onlyFavs ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25" : "surface text-muted hover:text-[var(--fg)]"
          }`}
        >
          <Heart className="h-4 w-4" fill={onlyFavs ? "currentColor" : "none"} aria-hidden /> Favourites
          {favs.length > 0 && <span className="tabular-nums">({favs.length})</span>}
        </button>
      </div>

      <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="First letter">
        <button
          type="button"
          aria-pressed={letter === ""}
          onClick={() => {
            setLetter("");
            touch();
          }}
          className={`h-9 shrink-0 rounded-lg px-3 text-xs font-bold ${letter === "" ? "bg-brand-500 text-white" : "surface text-muted"}`}
        >
          A–Z
        </button>
        {LETTERS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={letter === l}
            onClick={() => {
              setLetter(letter === l ? "" : l);
              touch();
            }}
            className={`h-9 w-9 shrink-0 rounded-lg text-sm font-bold ${letter === l ? "bg-brand-500 text-white" : "surface text-muted hover:text-[var(--fg)]"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {picked && (
        <section
          id="name-spotlight"
          aria-label={`${picked.name} meaning`}
          className="relative mt-5 scroll-mt-24 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 p-5 text-white shadow-xl shadow-brand-500/25 sm:p-6"
        >
          <button
            type="button"
            onClick={() => setPicked(null)}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">
            {GENDER_LABEL[picked.gender]} name · {picked.origin} origin
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 pr-8">
            <h3 className="text-3xl font-extrabold sm:text-4xl">{picked.name}</h3>
            <span dir="rtl" lang="ur" className="text-3xl leading-[2.1]" style={{ fontFamily: NASTALIQ }}>
              {picked.urdu}
            </span>
          </div>
          <p className="mt-2 text-lg font-semibold">{picked.meaning}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleFav(picked.name)}
              aria-pressed={favs.includes(picked.name)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-600"
            >
              <Heart className="h-4 w-4" fill={favs.includes(picked.name) ? "currentColor" : "none"} aria-hidden />
              {favs.includes(picked.name) ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => copyName(picked)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold hover:bg-white/25"
            >
              <Copy className="h-4 w-4" aria-hidden /> Copy
            </button>
            <button
              type="button"
              onClick={randomName}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold hover:bg-white/25"
            >
              <Shuffle className="h-4 w-4" aria-hidden /> Another
            </button>
            {/* kept at the right edge so its menu (anchored right) stays on screen on phones */}
            <ShareSheet
              title={`${picked.name} — name meaning`}
              text={`${picked.name} (${picked.urdu}) means “${picked.meaning}” — ${GENDER_LABEL[picked.gender].toLowerCase()} name, ${picked.origin} origin`}
              url={pageUrl ? `${pageUrl}?name=${encodeURIComponent(picked.name)}` : undefined}
              className="ml-auto text-[var(--fg)] [&>button]:border-white/20 [&>button]:bg-white/15 [&>button]:text-white"
            />
          </div>
        </section>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? "name" : "names"}
          {filtered ? " match" : ""}
        </p>
        {filtered && (
          <button type="button" onClick={clearFilters} className="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-3 rounded-2xl surface p-6 text-center text-sm text-muted">
          {onlyFavs && favs.length === 0
            ? "No favourites yet — tap the heart on any name to save it here (saved on this device only)."
            : "No names match. Try another spelling, letter or filter."}
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) => (
            <NameCard key={n.name} n={n} fav={favs.includes(n.name)} onFav={() => toggleFav(n.name)} onOpen={() => openName(n)} />
          ))}
        </ul>
      )}

      {results.length > shown.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-xl surface px-5 py-2.5 text-sm font-bold hover:border-brand-400/60"
          >
            Show more ({results.length - shown.length} left)
          </button>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Meanings are the commonly accepted ones from Arabic, Persian, Turkish and Urdu; for names linked to the Prophets,
        the Prophet&apos;s family and the Companions we note who the name honours. Spellings vary — search finds Ayesha/Aisha,
        Yousuf/Yusuf and similar. Favourites are saved on this device only. For a final choice, it is good practice to ask a
        trusted scholar.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function NamesStudio({ tool }: { tool: Tool }) {
  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <NameFinder slug={tool.slug} />
        </div>
      </motion.div>
    </div>
  );
}
