"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Copy, RotateCcw, Trash2 } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { trackEvent } from "@/lib/track-event";

/* ------------------------------------------------------------------ *
 * pure transforms — no state, easy to reason about and to test
 * ------------------------------------------------------------------ */

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s|["'([{])(\p{L})/gu, (_, p, c) => p + c.toLocaleUpperCase());

export const toSentenceCase = (s: string) =>
  s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, p, c) => p + c.toLocaleUpperCase());

export const toSlug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const parts = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+|(?<=\p{Ll})(?=\p{Lu})/gu)
    .filter(Boolean);

export const CASES: { key: string; label: string; fn: (s: string) => string }[] = [
  { key: "upper", label: "UPPERCASE", fn: (s) => s.toLocaleUpperCase() },
  { key: "lower", label: "lowercase", fn: (s) => s.toLocaleLowerCase() },
  { key: "title", label: "Title Case", fn: toTitleCase },
  { key: "sentence", label: "Sentence case", fn: toSentenceCase },
  { key: "camel", label: "camelCase", fn: (s) => parts(s).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join("") },
  { key: "pascal", label: "PascalCase", fn: (s) => parts(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("") },
  { key: "snake", label: "snake_case", fn: (s) => parts(s).map((w) => w.toLowerCase()).join("_") },
  { key: "kebab", label: "kebab-case (slug)", fn: (s) => parts(s).map((w) => w.toLowerCase()).join("-") },
  { key: "constant", label: "CONSTANT_CASE", fn: (s) => parts(s).map((w) => w.toUpperCase()).join("_") },
];

function utf8ToBase64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function base64ToUtf8(s: string) {
  const bin = atob(s.trim().replace(/\s+/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function subtleAvailable() {
  return typeof crypto !== "undefined" && typeof crypto.subtle?.digest === "function";
}

async function sha(algo: AlgorithmIdentifier, text: string) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        trackEvent("copy");
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // insecure context (plain http on a phone) — fall back to a selection copy
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
          } catch {}
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg surface px-3 py-1.5 text-xs font-bold transition-colors hover:border-brand-400/60 disabled:opacity-40"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl surface p-3 transition-colors hover:border-brand-400/40">
      <span className="w-36 shrink-0 text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <code className="min-w-0 flex-1 break-all font-mono text-sm">{value || "—"}</code>
      <CopyButton value={value} />
    </div>
  );
}

export default function TextStudio({ tool }: { tool: Tool }) {
  const mode = tool.mode ?? "count";
  const isSlug = tool.slug === "slug-generator";

  const [text, setText] = useState("");
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [hashUnavailable, setHashUnavailable] = useState(false);

  const stats = useMemo(() => {
    const w = words(text);
    const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim()).length;
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim()).length;
    const mins = w.length / 200;
    return {
      words: w.length,
      characters: text.length,
      charactersNoSpaces: text.replace(/\s/g, "").length,
      sentences,
      paragraphs,
      lines: text ? text.split("\n").length : 0,
      readingTime: mins < 1 && mins > 0 ? "under 1 min" : `${Math.round(mins)} min`,
      longestWord: w.reduce((a, b) => (b.length > a.length ? b : a), ""),
    };
  }, [text]);

  const codec = useMemo(() => {
    if (!text) return { value: "", error: null as string | null };
    try {
      if (mode === "base64") {
        return { value: direction === "encode" ? utf8ToBase64(text) : base64ToUtf8(text), error: null };
      }
      if (mode === "url") {
        return { value: direction === "encode" ? encodeURIComponent(text) : decodeURIComponent(text), error: null };
      }
      return { value: "", error: null };
    } catch {
      return {
        value: "",
        error:
          direction === "decode"
            ? `That is not valid ${mode === "base64" ? "Base64" : "percent-encoded"} input.`
            : "Could not encode that input.",
      };
    }
  }, [text, mode, direction]);

  const json = useMemo(() => {
    if (mode !== "json" || !text.trim()) return { pretty: "", mini: "", error: null as string | null, saved: 0 };
    try {
      const parsed = JSON.parse(text);
      const pretty = JSON.stringify(parsed, null, 2);
      const mini = JSON.stringify(parsed);
      return { pretty, mini, error: null, saved: text.length ? Math.round(((text.length - mini.length) / text.length) * 100) : 0 };
    } catch (e) {
      return { pretty: "", mini: "", error: e instanceof Error ? e.message : "Invalid JSON", saved: 0 };
    }
  }, [text, mode]);

  useEffect(() => {
    if (mode !== "hash") return;
    let cancelled = false;
    // every state update happens inside the async callback, never in the effect body
    (async () => {
      if (!subtleAvailable()) {
        if (!cancelled) setHashUnavailable(true);
        return;
      }
      if (!text) {
        if (!cancelled) setHashes({});
        return;
      }
      const entries = await Promise.all(
        (["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const).map(async (a) => [a, await sha(a, text)] as const),
      );
      if (!cancelled) setHashes(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [text, mode]);

  const placeholder =
    mode === "json"
      ? '{"name":"SnapGrab","tools":27,"free":true}'
      : mode === "base64"
        ? direction === "encode"
          ? "Type text to encode…"
          : "Paste Base64 to decode…"
        : mode === "url"
          ? "https://example.com/search?q=hello world"
          : isSlug
            ? "How to Download YouTube Videos in 4K"
            : "Paste or type your text here…";

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          {(mode === "base64" || mode === "url") && (
            <div className="mb-4 flex gap-2">
              {(["encode", "decode"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold capitalize transition-all ${
                    direction === d
                      ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                      : "surface text-muted hover:text-[var(--fg)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <label className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>Your text</span>
            <span className="flex items-center gap-2">
              {text && (
                <button
                  type="button"
                  onClick={() => setText("")}
                  className="flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </span>
          </label>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={mode === "count" || mode === "json" ? 10 : 6}
            spellCheck={mode === "count"}
            placeholder={placeholder}
            aria-label="Input text"
            className={`w-full resize-y rounded-2xl surface p-4 text-[15px] outline-none transition-all placeholder:text-muted focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(112,72,240,.12)] ${
              mode === "json" || mode === "base64" ? "font-mono text-[13px]" : ""
            }`}
          />

          {/* ---------------- word counter ---------------- */}
          {mode === "count" && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Words", value: stats.words.toLocaleString() },
                { label: "Characters", value: stats.characters.toLocaleString() },
                { label: "No spaces", value: stats.charactersNoSpaces.toLocaleString() },
                { label: "Sentences", value: stats.sentences.toLocaleString() },
                { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
                { label: "Lines", value: stats.lines.toLocaleString() },
                { label: "Reading time", value: stats.readingTime },
                { label: "Longest word", value: stats.longestWord || "—" },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  layout
                  className="rounded-2xl surface p-4 text-center transition-transform hover:-translate-y-0.5"
                >
                  <p className="truncate text-xl font-extrabold tracking-tight gradient-text">{s.value}</p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ---------------- case converter / slug ---------------- */}
          {mode === "case" && text && (
            <div className="mt-5 space-y-2">
              {(isSlug
                ? ["kebab", "snake", "lower", "title"]
                    .map((k) => CASES.find((c) => c.key === k)!)
                    .map((c) => (c.key === "kebab" ? { ...c, label: "URL slug" } : c))
                : CASES
              ).map((c) => (
                <ResultRow key={c.key} label={c.label} value={c.fn(text)} />
              ))}
            </div>
          )}

          {/* ---------------- base64 / url ---------------- */}
          {(mode === "base64" || mode === "url") && (
            <div className="mt-5">
              {codec.error ? (
                <p className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {codec.error}
                </p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">{direction}d output</span>
                    <CopyButton value={codec.value} />
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-2xl surface p-4 font-mono text-[13px] leading-relaxed">
                    <code className="break-all whitespace-pre-wrap">{codec.value || "—"}</code>
                  </pre>
                </>
              )}
            </div>
          )}

          {/* ---------------- json ---------------- */}
          {mode === "json" && text.trim() && (
            <div className="mt-5">
              {json.error ? (
                <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong className="block">Invalid JSON</strong>
                    <span className="text-muted">{json.error}</span>
                  </span>
                </p>
              ) : (
                <>
                  <p className="mb-3 flex items-center gap-2 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-2.5 text-sm text-accent-400">
                    <Check className="h-4 w-4" /> Valid JSON · minifying saves {json.saved}%
                  </p>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Formatted</span>
                    <CopyButton value={json.pretty} />
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-2xl surface p-4 font-mono text-[13px] leading-relaxed">
                    <code>{json.pretty}</code>
                  </pre>
                  <div className="mb-2 mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold">Minified</span>
                    <CopyButton value={json.mini} />
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-2xl surface p-4 font-mono text-[13px]">
                    <code className="break-all whitespace-pre-wrap">{json.mini}</code>
                  </pre>
                </>
              )}
            </div>
          )}

          {/* ---------------- hashes ---------------- */}
          {mode === "hash" && hashUnavailable && (
            <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="block">Hashing needs a secure connection</strong>
                <span className="text-muted">
                  Browsers only expose the Web Crypto digest API over HTTPS or on localhost. Open this page over HTTPS
                  and the hashes will appear.
                </span>
              </span>
            </p>
          )}

          {mode === "hash" && !hashUnavailable && (
            <div className="mt-5 space-y-2">
              <AnimatePresence>
                {text ? (
                  Object.entries(hashes).map(([algo, value]) => (
                    <motion.div key={algo} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <ResultRow label={algo} value={value} />
                    </motion.div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-muted">Type something to see its hashes.</p>
                )}
              </AnimatePresence>
            </div>
          )}

          {!text && mode === "case" && (
            <p className="mt-5 flex items-center justify-center gap-2 py-6 text-sm text-muted">
              <RotateCcw className="h-4 w-4" /> Enter some text to see every case at once.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
