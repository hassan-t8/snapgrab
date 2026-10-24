"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ClipboardPaste,
  Clock,
  Download,
  FileAudio,
  FileImage,
  FileVideo,
  Loader2,
  Search,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { detectPlatform, normalizeUrl } from "@/lib/platforms";
import { trackEvent } from "@/lib/track-event";
import type { ResolvedMedia } from "@/lib/types";

const KIND_ICON = { video: FileVideo, audio: FileAudio, image: FileImage } as const;

function formatBytes(b?: number) {
  if (!b || b <= 0) return null;
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatDuration(s?: number) {
  if (!s || s <= 0) return null;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  const h = Math.floor(m / 60);
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Downloader({
  presetPlatform,
  only,
  placeholder = "Paste any video link — we detect the platform automatically",
  cta = "Download",
}: {
  presetPlatform?: string;
  /** restrict the results list to one media kind (used by the audio tools) */
  only?: "audio" | "video";
  placeholder?: string;
  cta?: string;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolvedMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [autoPasted, setAutoPasted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastResolved = useRef<string>("");

  const detected = useMemo(() => (url.trim().length > 6 ? detectPlatform(url) : null), [url]);

  const resolve = useCallback(async (raw: string) => {
    const clean = normalizeUrl(raw);
    if (!clean) {
      setError("That does not look like a valid link.");
      return;
    }
    if (lastResolved.current === clean && result) return;

    setLoading(true);
    setError(null);
    setErrorCode(null);
    setResult(null);
    try {
      let res: Response;
      try {
        res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: clean }),
        });
      } catch {
        throw new Error("You seem to be offline. Check your internet connection and try again.");
      }
      // a gateway timeout returns HTML, not JSON — never show a parser error to the visitor
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string; data?: unknown } | null;
      if (!res.ok || !json?.ok) {
        setErrorCode(json?.code ?? (res.status === 429 ? "RATE_LIMIT" : null));
        throw new Error(
          json?.error ??
            (res.status >= 500 ? "Our server is having a moment. Please try again in a minute." : "Could not read that link."),
        );
      }

      const media = json.data as ResolvedMedia;
      trackEvent("resolve", media.platform);
      if (only) {
        const kept = media.formats.filter((f) => f.kind === only);
        if (!kept.length) {
          throw new Error(
            only === "audio"
              ? "That link has no separate audio track we can extract."
              : "That link has no downloadable video stream.",
          );
        }
        media.formats = kept;
      }

      lastResolved.current = clean;
      setResult(media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [result, only]);

  // auto-detect on paste — the whole point of the product
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    setUrl(text);
    if (detectPlatform(text)) void resolve(text);
  }

  // read the clipboard when the user focuses the field (permission-gated, fails silently)
  async function tryClipboard() {
    if (url || autoPasted) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && detectPlatform(text)) {
        setUrl(text);
        setAutoPasted(true);
        void resolve(text);
      }
    } catch {
      /* clipboard permission denied — completely fine */
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reset() {
    setUrl("");
    setResult(null);
    setError(null);
    lastResolved.current = "";
    inputRef.current?.focus();
  }

  function downloadHref(f: ResolvedMedia["formats"][number]) {
    const p = new URLSearchParams({
      url: f.url,
      title: result?.title ?? "snapgrab",
      ext: f.ext,
      quality: f.quality,
      kind: f.kind,
      platform: result?.platform ?? presetPlatform ?? "unknown",
      source: result?.sourceUrl ?? "",
    });
    return `/api/download?${p.toString()}`;
  }

  return (
    <div id="downloader" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resolve(url);
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
                <input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={onPaste}
                  onFocus={tryClipboard}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={placeholder}
                  aria-label="Video link"
                  className={`w-full rounded-2xl surface py-4 pl-12 text-[15px] outline-none transition-all placeholder:text-muted focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(112,72,240,.14)] ${
                    detected ? "pr-40" : url ? "pr-12" : "pr-4"
                  }`}
                />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  <AnimatePresence mode="wait">
                    {detected ? (
                      <motion.span
                        key={detected.id}
                        initial={{ opacity: 0, scale: 0.8, x: 6 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold"
                        style={{ background: `${detected.color}22`, color: detected.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: detected.color }} />
                        {detected.name}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                  {url && (
                    <button
                      type="button"
                      onClick={reset}
                      aria-label="Clear"
                      className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:text-[var(--fg)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading || !url.trim()}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-7 py-4 font-bold text-white shadow-xl shadow-brand-500/25 transition-opacity disabled:opacity-50 sm:min-w-[168px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-[18px] w-[18px] animate-spin" /> Reading…
                  </>
                ) : (
                  <>
                    <Download className="h-[18px] w-[18px]" /> {cta}
                  </>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5 text-brand-400" /> Paste and it starts on its own
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-accent-400" /> No signup, no watermark
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              to focus
            </span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading && <SkeletonResult key="skeleton" />}

        {error && !loading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${
              errorCode === "QUOTA_EXCEEDED" || errorCode === "RATE_LIMIT" || errorCode === "DISABLED"
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            {errorCode === "QUOTA_EXCEEDED" || errorCode === "RATE_LIMIT" ? (
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            )}
            <div>
              <p className={`font-semibold ${errorCode === "QUOTA_EXCEEDED" || errorCode === "RATE_LIMIT" ? "text-amber-400" : "text-red-400"}`}>
                {errorCode === "QUOTA_EXCEEDED"
                  ? "Downloader limit reached"
                  : errorCode === "RATE_LIMIT"
                    ? "Slow down a little"
                    : errorCode === "DISABLED"
                      ? "Temporarily unavailable"
                      : "Could not process that link"}
              </p>
              <p className="mt-0.5 text-sm text-muted">{error}</p>
            </div>
          </motion.div>
        )}

        {result && !loading && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
            className="mt-5 overflow-hidden rounded-[26px] surface"
          >
            {result.demo && (
              <div className="flex items-start gap-2 bg-amber-500/15 px-5 py-2.5 text-xs font-medium leading-relaxed text-amber-400">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Demo mode — add your RapidAPI key in <code className="whitespace-nowrap font-mono">.env</code> to
                  return real media.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-5 p-5 sm:flex-row">
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-soft)] sm:w-64">
                {result.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    <FileVideo className="h-8 w-8" />
                  </div>
                )}
                {formatDuration(result.durationSec) && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
                    {formatDuration(result.durationSec)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-400">
                    {result.platformName}
                  </span>
                  {result.cached && (
                    <span className="flex items-center gap-1 rounded-lg bg-accent-500/15 px-2 py-0.5 text-xs font-semibold text-accent-400">
                      <Clock className="h-3 w-3" /> instant (cached)
                    </span>
                  )}
                </div>
                <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{result.title}</h3>
                {result.author && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <User className="h-3.5 w-3.5" />
                    {result.author}
                  </p>
                )}
                <p className="mt-3 text-sm text-muted">
                  {result.formats.length} download option{result.formats.length === 1 ? "" : "s"} available — pick a
                  quality below.
                </p>
              </div>
            </div>

            <div className="border-t border-[var(--line)] p-3 sm:p-4">
              <div className="grid gap-2">
                {result.formats.map((f, i) => {
                  const Icon = KIND_ICON[f.kind];
                  return (
                    <motion.a
                      key={f.id}
                      href={downloadHref(f)}
                      onClick={() => trackEvent("download", `${result.platform}:${f.kind}:${f.quality}`)}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      whileHover={{ x: 3 }}
                      className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition-colors hover:border-brand-400/40 hover:bg-brand-500/5"
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          f.kind === "audio"
                            ? "bg-accent-500/15 text-accent-400"
                            : f.kind === "image"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-brand-500/15 text-brand-400"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{f.quality}</span>
                        <span className="block text-xs uppercase tracking-wide text-muted">
                          {f.ext}
                          {formatBytes(f.sizeBytes) ? ` · ${formatBytes(f.sizeBytes)}` : ""}
                          {f.kind === "video" && f.hasAudio === false ? " · no audio" : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-bold text-white opacity-90 transition-opacity group-hover:opacity-100">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Save</span>
                      </span>
                    </motion.a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SkeletonResult() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-5 overflow-hidden rounded-[26px] surface"
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-[var(--bg-soft)] sm:w-64" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-24 animate-pulse rounded-lg bg-[var(--bg-soft)]" />
          <div className="h-5 w-4/5 animate-pulse rounded-lg bg-[var(--bg-soft)]" />
          <div className="h-4 w-1/3 animate-pulse rounded-lg bg-[var(--bg-soft)]" />
        </div>
      </div>
      <div className="space-y-2 border-t border-[var(--line)] p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--bg-soft)]" />
        ))}
      </div>
    </motion.div>
  );
}
