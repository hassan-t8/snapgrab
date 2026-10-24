"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  GripVertical,
  Loader2,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  UploadCloud,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * pdf.js loader — client only, loaded on first use
 * ------------------------------------------------------------------ */

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * pdf.js 4.x relies on Promise.withResolvers (Chrome 119+, Safari 17.4+). Older phones — e.g. iPhones stuck on
 * iOS 16 — get the legacy build instead, which ships its own polyfills. Each build gets its matching worker.
 */
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const modern = typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === "function";
      if (modern) {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        return pdfjs;
      }
      const legacy = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJs;
      legacy.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      return legacy;
    })();
    pdfjsPromise.catch(() => {
      pdfjsPromise = null; // allow a retry after e.g. a flaky chunk load
    });
  }
  return pdfjsPromise;
}

function describePdfError(err: unknown): { title: string; body: string } {
  const name = (err as { name?: string } | null)?.name;
  if (name === "PasswordException") {
    return {
      title: "This PDF is password protected",
      body: "Open it with its password, save or print an unprotected copy, then try again.",
    };
  }
  if (name === "InvalidPDFException" || name === "MissingPDFException") {
    return { title: "This file isn't a valid PDF", body: "It may be damaged or incomplete — try downloading it again." };
  }
  return {
    title: "Could not read this PDF",
    body: err instanceof Error && err.message ? err.message : "The file may be damaged or use features your browser can't render.",
  };
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Your browser could not encode the image."))), type, quality),
  );
}

function clickDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function trackUsage(slug: string, body: { inputType: string; outputType: string; files: number; bytesIn: number; bytesOut: number }) {
  fetch("/api/tools/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ tool: slug, ...body }),
  }).catch(() => {});
}

/** "1-3,5, 8-" → sorted unique 1-based page numbers. */
function parsePages(text: string, max: number): number[] {
  const out = new Set<number>();
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Enter pages like "1-3,5".');
  for (const part of parts) {
    const m = part.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" is not a page or range — use something like "1-3,5".`);
    const from = m[1] ? Number(m[1]) : 1;
    const to = m[2] ? (m[3] ? Number(m[3]) : max) : from;
    if (from < 1 || to < from) throw new Error(`"${part}" does not make sense as a range.`);
    if (to > max) throw new Error(`This document only has ${max} page${max === 1 ? "" : "s"}.`);
    for (let n = from; n <= to; n++) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ *
 * shared hooks & pieces
 * ------------------------------------------------------------------ */

/** Object URLs created by this component, all revoked on unmount. */
function useObjectUrls() {
  const ref = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = ref.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);
  return {
    make(blob: Blob) {
      const url = URL.createObjectURL(blob);
      ref.current.add(url);
      return url;
    },
    revoke(url: string | undefined) {
      if (!url) return;
      URL.revokeObjectURL(url);
      ref.current.delete(url);
    },
  };
}

/** One open pdf.js document plus a token that invalidates any in-flight render when the file changes. */
function usePdfDoc() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const holder = useRef<{ doc: PDFDocumentProxy | null; token: number }>({ doc: null, token: 0 });

  useEffect(() => {
    const h = holder.current;
    return () => {
      h.token++;
      void h.doc?.destroy();
      h.doc = null;
    };
  }, []);

  function close() {
    const h = holder.current;
    h.token++;
    void h.doc?.destroy();
    h.doc = null;
    setFile(null);
    setPageCount(0);
    setError(null);
  }

  async function open(f: File | undefined): Promise<{ doc: PDFDocumentProxy; token: number } | null> {
    if (!f) return null;
    if (!isPdf(f)) {
      setError("Please choose a PDF file.");
      notify.error("That isn't a PDF", "Choose a file ending in .pdf.");
      return null;
    }
    const h = holder.current;
    const token = ++h.token;
    void h.doc?.destroy();
    h.doc = null;
    setOpening(true);
    setError(null);
    try {
      const pdfjs = await loadPdfJs();
      const data = new Uint8Array(await f.arrayBuffer()); // pdf.js transfers (detaches) this buffer to its worker
      const task = pdfjs.getDocument({ data, isEvalSupported: false });
      let doc: PDFDocumentProxy;
      try {
        doc = await task.promise;
      } catch (err) {
        void task.destroy();
        throw err;
      }
      if (token !== h.token) {
        void doc.destroy();
        return null;
      }
      h.doc = doc;
      setFile(f);
      setPageCount(doc.numPages);
      return { doc, token };
    } catch (err) {
      if (token !== h.token) return null;
      const { title, body } = describePdfError(err);
      setFile(null);
      setPageCount(0);
      setError(`${title}. ${body}`);
      notify.error(title, body);
      return null;
    } finally {
      if (token === h.token) setOpening(false);
    }
  }

  return {
    file,
    pageCount,
    opening,
    error,
    setError,
    open,
    close,
    doc: () => holder.current.doc,
    token: () => holder.current.token,
    isCurrent: (t: number) => t === holder.current.token,
  };
}

function DropZone({ onFile, opening, hint }: { onFile: (f: File | undefined) => void; opening: boolean; hint: string }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files[0]);
      }}
      onClick={() => !opening && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Choose a PDF file"
      aria-busy={opening}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!opening) inputRef.current?.click();
        }
      }}
      className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${
        dragging ? "border-brand-400 bg-brand-500/10" : "border-[var(--line)] hover:border-brand-400/60"
      }`}
    >
      <motion.span
        animate={dragging ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
        className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
      >
        {opening ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
      </motion.span>
      <p className="mt-4 font-bold">{opening ? "Opening PDF…" : "Drop a PDF file, or tap to browse"}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function FileBar({ file, pages, onClear, disabled }: { file: File; pages: number; onClear: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl surface p-3 sm:p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{file.name}</span>
        <span className="block text-xs text-muted">
          {formatBytes(file.size)} · {pages} page{pages === 1 ? "" : "s"}
        </span>
      </span>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-muted transition-colors hover:text-red-400 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Clear</span>
        <span className="sr-only sm:hidden">Clear file</span>
      </button>
    </div>
  );
}

function ErrorNote({ text }: { text: string | null }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" /> {text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="aurora-border rounded-[26px]"
    >
      <div className="glass rounded-[26px] p-4 sm:p-6">
        {children}
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
          Pages are rendered locally with pdf.js — your PDF never leaves this device.
        </p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * PDF → images
 * ------------------------------------------------------------------ */

type Rendered = { page: number; url: string; name: string; width: number; height: number; size: number };

const SOFT_PAGE_LIMIT = 50;
const HARD_PAGE_LIMIT = 150;
/** iOS Safari refuses canvases above ~16.7 MP; stay just under. */
const MAX_AREA = 16_000_000;
const MAX_SIDE = 10_000;

function PdfToImages({ tool }: { tool: Tool }) {
  const pdf = usePdfDoc();
  const urls = useObjectUrls();
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [allPages, setAllPages] = useState(true);
  const [range, setRange] = useState("");
  const [results, setResults] = useState<Rendered[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; page: number } | null>(null);
  const [rendering, setRendering] = useState(false);
  const stopRef = useRef(false);

  function clearResults() {
    results.forEach((r) => urls.revoke(r.url));
    setResults([]);
    setProgress(null);
  }

  async function onFile(f: File | undefined) {
    if (rendering) return;
    clearResults();
    const opened = await pdf.open(f);
    if (opened) {
      setRange(opened.doc.numPages > 1 ? `1-${opened.doc.numPages}` : "1");
      if (opened.doc.numPages > SOFT_PAGE_LIMIT) {
        notify.info(`${opened.doc.numPages} pages`, "Large documents are best converted in smaller ranges.");
      }
    }
  }

  function reset() {
    stopRef.current = true;
    clearResults();
    pdf.close();
    setRendering(false);
    setRange("");
    setAllPages(true);
  }

  async function run() {
    const doc = pdf.doc();
    if (!doc || !pdf.file || rendering) return;

    let pages: number[];
    try {
      pages = allPages ? Array.from({ length: pdf.pageCount }, (_, i) => i + 1) : parsePages(range, pdf.pageCount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Check the page selection.";
      pdf.setError(msg);
      notify.error("Check the page selection", msg);
      return;
    }
    if (pages.length > HARD_PAGE_LIMIT) {
      const msg = `Convert at most ${HARD_PAGE_LIMIT} pages at a time — pick a range such as 1-${HARD_PAGE_LIMIT}, then continue from ${HARD_PAGE_LIMIT + 1}.`;
      pdf.setError(msg);
      notify.warning("Too many pages at once", msg);
      return;
    }
    if (pages.length > SOFT_PAGE_LIMIT) {
      notify.warning(
        `Rendering ${pages.length} pages`,
        scale > 1 ? "This can use a lot of memory on phones — 1× is safer for big documents." : "This may take a little while.",
      );
    }

    pdf.setError(null);
    clearResults();
    setRendering(true);
    stopRef.current = false;
    trackEvent("process", tool.slug);

    const token = pdf.token();
    const file = pdf.file;
    const base = file.name.replace(/\.pdf$/i, "") || "document";
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const produced: Rendered[] = [];
    let shrunk = false;

    try {
      for (let i = 0; i < pages.length; i++) {
        if (!pdf.isCurrent(token) || stopRef.current) break;
        const n = pages[i];
        setProgress({ done: i, total: pages.length, page: n });

        const page = await doc.getPage(n);
        let viewport = page.getViewport({ scale });
        const area = viewport.width * viewport.height;
        if (viewport.width > MAX_SIDE || viewport.height > MAX_SIDE || area > MAX_AREA) {
          const k = Math.min(MAX_SIDE / viewport.width, MAX_SIDE / viewport.height, Math.sqrt(MAX_AREA / area));
          viewport = page.getViewport({ scale: scale * k });
          shrunk = true;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable in this browser.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();

        const blob = await toBlob(canvas, mime, format === "jpg" ? quality / 100 : undefined);
        const item: Rendered = {
          page: n,
          url: urls.make(blob),
          name: `${base}-page-${n}.${format}`,
          width: canvas.width,
          height: canvas.height,
          size: blob.size,
        };
        canvas.width = 0; // free the bitmap right away — matters on phones
        canvas.height = 0;
        produced.push(item);
        setResults((prev) => [...prev, item]);
      }

      if (!pdf.isCurrent(token)) return;
      setProgress({ done: produced.length, total: pages.length, page: pages[pages.length - 1] });

      if (produced.length) {
        if (shrunk) notify.info("Some pages were scaled down", "They were too large for a browser canvas at this resolution.");
        if (stopRef.current) notify.info("Stopped", `${produced.length} of ${pages.length} pages were converted.`);
        else notify.success(`${produced.length} image${produced.length === 1 ? "" : "s"} ready`, "Save them one by one or all at once.");
        trackUsage(tool.slug, {
          inputType: "application/pdf",
          outputType: mime,
          files: produced.length,
          bytesIn: file.size,
          bytesOut: produced.reduce((s, r) => s + r.size, 0),
        });
      }
    } catch (err) {
      if (!pdf.isCurrent(token)) return;
      const { title, body } = describePdfError(err);
      pdf.setError(`${title}. ${body}`);
      notify.error(title, body);
    } finally {
      if (pdf.isCurrent(token)) setRendering(false);
    }
  }

  function downloadAll() {
    if (!results.length) return;
    trackEvent("download", tool.slug);
    if (results.length > 1) notify.info(`Downloading ${results.length} images`, "Allow multiple downloads if your browser asks.");
    results.forEach((r, i) => setTimeout(() => clickDownload(r.url, r.name), i * 350)); // browsers throttle bursts
  }

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <div id="tool" className="scroll-mt-24">
      <Shell>
        {!pdf.file ? (
          <DropZone onFile={onFile} opening={pdf.opening} hint="One document at a time — every page becomes a JPG or PNG" />
        ) : (
          <FileBar file={pdf.file} pages={pdf.pageCount} onClear={reset} disabled={rendering} />
        )}

        {pdf.file && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-2 block text-sm font-semibold">Image format</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Image format">
                {(["jpg", "png"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={format === f}
                    disabled={rendering}
                    onClick={() => setFormat(f)}
                    className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all disabled:opacity-60 ${
                      format === f
                        ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                        : "surface text-muted hover:text-[var(--fg)]"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold">Resolution</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Resolution">
                {([1, 2, 3] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={scale === s}
                    disabled={rendering}
                    onClick={() => setScale(s)}
                    className={`flex-1 rounded-xl px-2 py-2 text-sm font-bold leading-tight transition-all disabled:opacity-60 ${
                      scale === s
                        ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                        : "surface text-muted hover:text-[var(--fg)]"
                    }`}
                  >
                    {s}×<span className="block text-[11px] font-semibold opacity-80">~{s * 72} DPI</span>
                  </button>
                ))}
              </div>
            </div>

            {format === "jpg" && (
              <div>
                <label htmlFor="p2i-quality" className="mb-2 flex items-center justify-between text-sm font-semibold">
                  JPG quality <span className="font-mono text-brand-400">{quality}%</span>
                </label>
                <input
                  id="p2i-quality"
                  type="range"
                  min={40}
                  max={100}
                  value={quality}
                  disabled={rendering}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-[var(--color-brand-500)]"
                />
                <p className="mt-1 text-xs text-muted">{quality >= 85 ? "Sharp text, larger files." : "Smaller files, softer text."}</p>
              </div>
            )}

            <div className={format === "jpg" ? "" : "sm:col-span-2"}>
              <span className="mb-2 block text-sm font-semibold">Pages</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--bg-soft)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={allPages}
                    disabled={rendering}
                    onChange={(e) => setAllPages(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  All {pdf.pageCount}
                </label>
                <input
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  disabled={allPages || rendering}
                  placeholder="1-3,5"
                  aria-label="Page selection, for example 1-3,5"
                  className="min-w-0 flex-1 rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <motion.button
            type="button"
            onClick={run}
            disabled={!pdf.file || rendering}
            whileHover={{ scale: pdf.file && !rendering ? 1.02 : 1 }}
            whileTap={{ scale: 0.97 }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:flex-none sm:min-w-[210px]"
          >
            {rendering ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
            {rendering ? "Rendering…" : `Convert to ${format.toUpperCase()}`}
          </motion.button>

          {rendering && (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
              }}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:text-red-400"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
          )}

          {!rendering && results.length > 1 && (
            <button
              type="button"
              onClick={downloadAll}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60"
            >
              <Download className="h-[18px] w-[18px]" /> Download all ({results.length})
            </button>
          )}
        </div>

        {progress && (rendering || progress.done < progress.total) && (
          <div className="mt-4" aria-live="polite">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>
                {rendering
                  ? allPages
                    ? `Rendering page ${progress.page} of ${progress.total}`
                    : `Rendering page ${progress.page} (${progress.done + 1} of ${progress.total})`
                  : `Converted ${progress.done} of ${progress.total} pages`}
              </span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Rendering progress"
            >
              <motion.div animate={{ width: `${pct}%` }} className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500" />
            </div>
          </div>
        )}

        <ErrorNote text={pdf.error} />
      </Shell>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {results.map((r) => (
              <motion.li
                key={r.url}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col rounded-2xl surface p-2.5"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl bg-white"
                  aria-label={`Open page ${r.page} in a new tab`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={`Page ${r.page}`} loading="lazy" className="max-h-full max-w-full object-contain" />
                </a>
                <span className="mt-2 block text-sm font-semibold">Page {r.page}</span>
                <span className="block text-[11px] text-muted">
                  {r.width}×{r.height} · {formatBytes(r.size)}
                </span>
                <a
                  href={r.url}
                  download={r.name}
                  onClick={() => trackEvent("download", tool.slug)}
                  className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-2 text-xs font-bold text-white"
                >
                  <Download className="h-3.5 w-3.5" /> Save {r.name.split(".").pop()?.toUpperCase()}
                </a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * organize pages
 * ------------------------------------------------------------------ */

type PageItem = {
  id: string;
  /** 0-based index in the source document */
  index: number;
  /** extra clockwise rotation chosen here, on top of the page's own /Rotate */
  rotation: 0 | 90 | 180 | 270;
  deleted: boolean;
  thumb?: string;
};

type SavedPdf = { url: string; name: string; size: number; pages: number };

const THUMB_WIDTH = 180;

function OrganizePages({ tool }: { tool: Tool }) {
  const pdf = usePdfDoc();
  const urls = useObjectUrls();
  const [pages, setPages] = useState<PageItem[]>([]);
  const [thumbs, setThumbs] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [output, setOutput] = useState<SavedPdf | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const gridRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; over: string | null } | null>(null);

  function dropAll() {
    pages.forEach((p) => urls.revoke(p.thumb));
    urls.revoke(output?.url);
    setPages([]);
    setOutput(null);
    setThumbs(null);
  }

  async function onFile(f: File | undefined) {
    if (saving) return;
    dropAll();
    const opened = await pdf.open(f);
    if (!opened) return;
    const { doc, token } = opened;
    const total = doc.numPages;
    setPages(Array.from({ length: total }, (_, i) => ({ id: `p${i}`, index: i, rotation: 0, deleted: false })));
    if (total > 300) notify.info(`${total} pages`, "Thumbnails for long documents take a moment — you can start arranging right away.");

    setThumbs({ done: 0, total });
    for (let i = 0; i < total; i++) {
      if (!pdf.isCurrent(token)) return;
      try {
        const page = await doc.getPage(i + 1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1, THUMB_WIDTH / base.width, (THUMB_WIDTH * 1.6) / base.height) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable in this browser.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
        const blob = await toBlob(canvas, "image/jpeg", 0.75);
        canvas.width = 0;
        canvas.height = 0;
        if (!pdf.isCurrent(token)) return;
        const url = urls.make(blob);
        setPages((prev) => prev.map((p) => (p.index === i ? { ...p, thumb: url } : p)));
      } catch {
        // a single unrenderable page should not stop the rest; it simply shows without a preview
        if (!pdf.isCurrent(token)) return;
      }
      setThumbs({ done: i + 1, total });
    }
  }

  function reset() {
    dropAll();
    pdf.close();
  }

  function columns() {
    const el = gridRef.current;
    if (!el) return 1;
    return Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  }

  function refocus(id: string, action?: string) {
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-page-id="${id}"]`);
      const target = action ? card?.querySelector<HTMLElement>(`[data-action="${action}"]`) : card;
      (target && !(target as HTMLButtonElement).disabled ? target : card)?.focus();
    });
  }

  function moveBy(id: string, delta: number, action?: string) {
    const from = pages.findIndex((p) => p.id === id);
    if (from < 0) return;
    const to = Math.min(pages.length - 1, Math.max(0, from + delta));
    if (to === from) return;
    const next = [...pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setPages(next);
    setOutput(null);
    setAnnounce(`Page ${item.index + 1} moved to position ${to + 1} of ${next.length}.`);
    refocus(id, action);
  }

  function moveOnto(id: string, targetId: string) {
    const to = pages.findIndex((p) => p.id === targetId);
    const from = pages.findIndex((p) => p.id === id);
    if (from < 0 || to < 0 || from === to) return;
    moveBy(id, to - from);
  }

  function rotate(id: string) {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (((p.rotation + 90) % 360) as PageItem["rotation"]) } : p)));
    setOutput(null);
  }

  function toggleDelete(id: string, action?: string) {
    const item = pages.find((p) => p.id === id);
    if (!item) return;
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, deleted: !p.deleted } : p)));
    setOutput(null);
    setAnnounce(`Page ${item.index + 1} ${item.deleted ? "restored" : "removed"}.`);
    if (action) refocus(id, action);
  }

  function resetChanges() {
    setPages((prev) => [...prev].sort((a, b) => a.index - b.index).map((p) => ({ ...p, rotation: 0, deleted: false })));
    setOutput(null);
    setAnnounce("All changes undone.");
  }

  function onCardKey(e: KeyboardEvent<HTMLLIElement>, id: string) {
    if (e.target !== e.currentTarget) return; // let the buttons inside handle their own keys
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns(), ArrowDown: columns() };
    if (e.key in map) {
      e.preventDefault();
      moveBy(id, map[e.key]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      toggleDelete(id);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      rotate(id);
    }
  }

  /* ---- pointer drag & drop (mouse anywhere on the thumbnail, touch/pen via the grip) ---- */

  function onDragStart(e: PointerEvent<HTMLDivElement>, id: string) {
    const fromGrip = (e.target as HTMLElement).closest("[data-grip]");
    if (e.pointerType !== "mouse" && !fromGrip) return; // keep normal scrolling on touch screens
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId, over: null };
    setDragId(id);
  }

  function onDragMove(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-page-id]");
    const over = el?.dataset.pageId ?? null;
    if (over !== d.over) {
      d.over = over;
      setOverId(over);
    }
    // nudge the page when dragging near the top/bottom edge
    if (e.clientY < 70) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
  }

  function onDragEnd(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
    if (e.type === "pointerup" && d.over && d.over !== d.id) moveOnto(d.id, d.over);
  }

  async function save() {
    if (!pdf.file || saving) return;
    const kept = pages.filter((p) => !p.deleted);
    if (!kept.length) {
      notify.error("Nothing to save", "Restore at least one page first.");
      return;
    }
    setSaving(true);
    trackEvent("process", tool.slug);
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      let src;
      try {
        src = await PDFDocument.load(await pdf.file.arrayBuffer());
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        throw new Error(
          /encrypt/i.test(msg)
            ? "This PDF is encrypted (it has edit restrictions), so it can't be rebuilt in the browser."
            : "This PDF's structure could not be read for saving — it may be damaged.",
        );
      }
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, kept.map((p) => p.index));
      copied.forEach((page, i) => {
        const extra = kept[i].rotation;
        if (extra) page.setRotation(degrees((((page.getRotation().angle + extra) % 360) + 360) % 360));
        out.addPage(page);
      });
      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      urls.revoke(output?.url);
      const name = `${pdf.file.name.replace(/\.pdf$/i, "") || "document"}-organized.pdf`;
      const url = urls.make(blob);
      setOutput({ url, name, size: blob.size, pages: kept.length });
      clickDownload(url, name);
      trackEvent("download", tool.slug);
      notify.success("PDF saved", `${kept.length} page${kept.length === 1 ? "" : "s"} · ${formatBytes(blob.size)}`);
      trackUsage(tool.slug, {
        inputType: "application/pdf",
        outputType: "application/pdf",
        files: 1,
        bytesIn: pdf.file.size,
        bytesOut: blob.size,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong while saving.";
      pdf.setError(msg);
      notify.error("Could not save the PDF", msg);
    } finally {
      setSaving(false);
    }
  }

  const keptCount = pages.filter((p) => !p.deleted).length;
  const changed = pages.some((p, i) => p.index !== i || p.rotation !== 0 || p.deleted);
  const iconBtn =
    "grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div id="tool" className="scroll-mt-24">
      <Shell>
        {!pdf.file ? (
          <DropZone onFile={onFile} opening={pdf.opening} hint="Reorder, rotate and delete pages — then save a new PDF" />
        ) : (
          <FileBar file={pdf.file} pages={pdf.pageCount} onClear={reset} disabled={saving} />
        )}

        {pdf.file && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="font-bold">{pdf.pageCount}</span> <span className="text-muted">pages before</span>
              <span className="mx-2 text-muted">→</span>
              <span className={`font-bold ${keptCount ? "text-accent-400" : "text-red-400"}`}>{keptCount}</span>{" "}
              <span className="text-muted">after</span>
            </span>
            {thumbs && thumbs.done < thumbs.total && (
              <span className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading previews {thumbs.done} / {thumbs.total}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <motion.button
            type="button"
            onClick={save}
            disabled={!pdf.file || saving || keptCount === 0}
            whileHover={{ scale: pdf.file && !saving && keptCount ? 1.02 : 1 }}
            whileTap={{ scale: 0.97 }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:flex-none sm:min-w-[210px]"
          >
            {saving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Download className="h-[18px] w-[18px]" />}
            {saving ? "Saving…" : "Save PDF"}
          </motion.button>
          {changed && (
            <button
              type="button"
              onClick={resetChanges}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
            >
              <RotateCcw className="h-[18px] w-[18px]" /> Undo changes
            </button>
          )}
        </div>
        {pdf.file && keptCount === 0 && (
          <p className="mt-3 text-sm text-red-400">Every page is marked for deletion — restore at least one to save.</p>
        )}

        <ErrorNote text={pdf.error} />

        {output && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-3 rounded-xl bg-[var(--bg-soft)] p-3"
          >
            <FileText className="h-5 w-5 shrink-0 text-accent-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{output.name}</span>
              <span className="block text-xs text-muted">
                {output.pages} page{output.pages === 1 ? "" : "s"} · {formatBytes(output.size)}
              </span>
            </span>
            <a
              href={output.url}
              download={output.name}
              onClick={() => trackEvent("download", tool.slug)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-bold text-white"
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download again</span>
              <span className="sr-only sm:hidden">Download again</span>
            </a>
          </motion.div>
        )}
      </Shell>

      {pages.length > 0 && (
        <>
          <p className="mt-5 text-xs text-muted">
            Drag thumbnails to reorder (on touch screens use the <GripVertical className="inline h-3 w-3" /> handle), or focus a page
            and use the arrow keys. <kbd className="font-mono">R</kbd> rotates, <kbd className="font-mono">Delete</kbd> removes.
          </p>
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
          <ul ref={gridRef} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pages.map((p, pos) => (
              <li
                key={p.id}
                data-page-id={p.id}
                tabIndex={0}
                onKeyDown={(e) => onCardKey(e, p.id)}
                aria-label={`Page ${p.index + 1}, position ${pos + 1} of ${pages.length}${p.rotation ? `, rotated ${p.rotation} degrees` : ""}${
                  p.deleted ? ", marked for deletion" : ""
                }`}
                className={`relative flex flex-col rounded-2xl surface p-2 outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  dragId === p.id ? "scale-95 opacity-40" : ""
                } ${overId === p.id && dragId && dragId !== p.id ? "ring-2 ring-brand-400" : ""}`}
              >
                <div
                  onPointerDown={(e) => onDragStart(e, p.id)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                  className={`relative grid aspect-square select-none place-items-center overflow-hidden rounded-xl bg-white ${
                    dragId === p.id ? "cursor-grabbing" : "cursor-grab"
                  }`}
                >
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumb}
                      alt=""
                      draggable={false}
                      className={`pointer-events-none max-h-full max-w-full object-contain shadow-sm transition-transform duration-300 ${
                        p.deleted ? "opacity-30 grayscale" : ""
                      }`}
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                    />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  )}
                  <span
                    data-grip
                    aria-hidden="true"
                    className="absolute left-1 top-1 grid h-8 w-8 touch-none place-items-center rounded-lg bg-black/55 text-white"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="absolute right-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {pos + 1}
                  </span>
                  {p.deleted && (
                    <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      Removed
                    </span>
                  )}
                </div>

                <span className="mt-1.5 px-1 text-xs text-muted">
                  Page {p.index + 1}
                  {p.rotation ? ` · ${p.rotation}°` : ""}
                </span>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-0.5">
                  <span className="flex">
                    <button
                      type="button"
                      data-action="left"
                      aria-label={`Move page ${p.index + 1} earlier`}
                      disabled={pos === 0 || saving}
                      onClick={() => moveBy(p.id, -1, "left")}
                      className={iconBtn}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      data-action="up"
                      aria-label={`Move page ${p.index + 1} up a row`}
                      disabled={pos === 0 || saving}
                      onClick={() => moveBy(p.id, -columns(), "up")}
                      className={iconBtn}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      data-action="down"
                      aria-label={`Move page ${p.index + 1} down a row`}
                      disabled={pos === pages.length - 1 || saving}
                      onClick={() => moveBy(p.id, columns(), "down")}
                      className={iconBtn}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      data-action="right"
                      aria-label={`Move page ${p.index + 1} later`}
                      disabled={pos === pages.length - 1 || saving}
                      onClick={() => moveBy(p.id, 1, "right")}
                      className={iconBtn}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </span>
                  <span className="flex">
                    <button
                      type="button"
                      data-action="rotate"
                      aria-label={`Rotate page ${p.index + 1} 90 degrees clockwise`}
                      disabled={saving}
                      onClick={() => rotate(p.id)}
                      className={iconBtn}
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      data-action="delete"
                      aria-label={p.deleted ? `Restore page ${p.index + 1}` : `Delete page ${p.index + 1}`}
                      aria-pressed={p.deleted}
                      disabled={saving}
                      onClick={() => toggleDelete(p.id, "delete")}
                      className={`${iconBtn} ${p.deleted ? "text-accent-400" : "hover:!text-red-400"}`}
                    >
                      {p.deleted ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function PdfPagesStudio({ tool }: { tool: Tool }) {
  const mode: string = tool.mode ?? "pdf-to-image";
  return mode === "organize" ? <OrganizePages tool={tool} /> : <PdfToImages tool={tool} />;
}
