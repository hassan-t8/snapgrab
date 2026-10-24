"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Download, Search, X } from "lucide-react";
import { TOOLS, type Tool } from "@/lib/tools";
import { PLATFORMS } from "@/lib/platforms";
import { ToolIcon } from "@/lib/tool-icons";
import type { ServiceSummary } from "@/lib/services";
import { trackEvent } from "@/lib/track-event";

const OPEN_EVENT = "sg:search";

/** Open the search dialog from anywhere, optionally pre-filled. */
export function openToolSearch(query = "") {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: query }));
}

type Result = {
  href: string;
  name: string;
  sub: string;
  group: string;
  color: string;
  tool?: Tool;
};

const POPULAR = [
  "currency-converter",
  "image-compressor",
  "passport-photo-maker",
  "salary-tax-calculator-pakistan",
  "merge-pdf",
  "cv-maker",
  "prayer-times",
  "qr-code-generator",
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Every word must appear somewhere; name matches outrank keyword and description matches. */
function score(words: string[], name: string, haystack: string) {
  let total = 0;
  for (const w of words) {
    if (name.startsWith(w)) total += 6;
    else if (name.includes(` ${w}`)) total += 5;
    else if (name.includes(w)) total += 4;
    else if (haystack.includes(w)) total += 1;
    else return 0;
  }
  return total;
}

function useCatalog(services?: ServiceSummary): Result[] {
  return useMemo(() => {
    const tools = services ? TOOLS.filter((t) => services.toolSlugs.includes(t.slug)) : TOOLS;
    const platforms = services ? PLATFORMS.filter((p) => services.platformIds.includes(p.id)) : PLATFORMS;
    return [
      ...tools.map((t) => ({
        href: `/tools/${t.slug}`,
        name: t.name,
        sub: t.tagline,
        group: t.category === "Calculators" ? "Calculators" : `${t.category} tools`,
        color: t.color,
        tool: t,
      })),
      ...platforms.map((p) => ({
        href: `/download/${p.slug}`,
        name: `${p.name} downloader`,
        sub: p.blurb,
        group: "Downloaders",
        color: p.color,
      })),
    ];
  }, [services]);
}

export default function ToolSearch({ services }: { services?: ServiceSummary }) {
  const router = useRouter();
  const catalog = useCatalog(services);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setQuery((e as CustomEvent<string>).detail ?? "");
      setActive(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setQuery("");
        setActive(0);
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(focus);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const results = useMemo(() => {
    const words = norm(query).split(" ").filter(Boolean);
    if (!words.length) {
      const popular = POPULAR.map((s) => catalog.find((r) => r.tool?.slug === s)).filter(Boolean) as Result[];
      return popular.map((r) => ({ ...r, group: "Popular tools" }));
    }
    return catalog
      .map((r) => {
        const hay = norm([r.sub, r.group, r.tool?.keywords.join(" "), r.tool?.description, r.tool?.outputs.join(" "), r.tool?.inputs.join(" ")].join(" "));
        return { r, s: score(words, ` ${norm(r.name)}`.trim(), hay) };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.r);
  }, [query, catalog]);

  const go = (r: Result) => {
    trackEvent("search", `${query.slice(0, 40)} → ${r.href.split("/").pop()}`);
    setOpen(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/50 px-3 pt-[8vh] backdrop-blur-sm sm:px-4 sm:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search tools"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--line)] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
              <Search className="h-5 w-5 shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search tools — e.g. pdf, dollar rate, passport photo"
                aria-label="Search tools"
                role="combobox"
                aria-expanded="true"
                aria-controls="tool-search-results"
                aria-activedescendant={results[active] ? `tool-search-${active}` : undefined}
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="rounded-lg p-1.5 text-muted hover:text-[var(--fg)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul id="tool-search-results" ref={listRef} role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted">
                  No tool matches &ldquo;{query}&rdquo;.{" "}
                  <Link href="/contact" onClick={() => setOpen(false)} className="font-semibold text-brand-400">
                    Request it
                  </Link>{" "}
                  and we will build it.
                </li>
              )}
              {results.map((r, i) => {
                const header = i === 0 || results[i - 1].group !== r.group ? r.group : null;
                return (
                  <li key={r.href}>
                    {header && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">{header}</p>}
                    <button
                      type="button"
                      id={`tool-search-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(r)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        i === active ? "bg-brand-500/15" : ""
                      }`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: r.color }}>
                        {r.tool ? <ToolIcon tool={r.tool} className="h-[18px] w-[18px]" /> : <Download className="h-[18px] w-[18px]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{r.name}</span>
                        <span className="block truncate text-xs text-muted">{r.sub}</span>
                      </span>
                      {i === active ? (
                        <CornerDownLeft className="h-4 w-4 shrink-0 text-brand-400" />
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted opacity-0 sm:opacity-100" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="hidden items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-[11px] text-muted sm:flex">
              <span>↑ ↓ to move · Enter to open · Esc to close</span>
              <span>
                <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5">Ctrl</kbd> +{" "}
                <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5">K</kbd> anywhere
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Looks like a search field; opens the search dialog. */
export function ToolSearchBox({
  className = "",
  initialQuery,
  placeholder = "Search free tools — PDF, image, calculator…",
}: {
  className?: string;
  initialQuery?: string;
  placeholder?: string;
}) {
  useEffect(() => {
    if (!initialQuery) return;
    const id = requestAnimationFrame(() => openToolSearch(initialQuery));
    return () => cancelAnimationFrame(id);
  }, [initialQuery]);

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
      <button
        type="button"
        onClick={() => openToolSearch()}
        aria-label="Search tools"
        className="h-14 w-full cursor-text rounded-2xl surface pl-12 pr-24 text-left text-base text-muted shadow-lg outline-none transition-colors hover:border-brand-400/50 focus-visible:border-brand-400"
      >
        {placeholder}
      </button>
      <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border border-[var(--line)] px-2 py-1 text-xs text-muted sm:block">
        Ctrl K
      </kbd>
    </div>
  );
}
