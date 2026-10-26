"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileText, Loader2, ShieldCheck, Sparkles, Square, Trash2, UploadCloud } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * pdf.js loader — client only, loaded on first use (same approach as PdfPagesStudio)
 * ------------------------------------------------------------------ */

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js 4.x needs Promise.withResolvers; older browsers (e.g. iOS 16) get the legacy build and its worker. */
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
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

function describePdfError(err: unknown): { title: string; body: string } {
  const name = (err as { name?: string } | null)?.name;
  if (name === "PasswordException") {
    return { title: "This PDF is password protected", body: "Open it with its password, save or print an unprotected copy, then try again." };
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Your browser could not encode the page image."))), type, quality),
  );
}

class Stopped extends Error {}

/* ------------------------------------------------------------------ */

type Level = "basic" | "strong";
type Dpi = 72 | 100 | 150;

type Output = { url: string; name: string; size: number; level: Level; pages: number; blob: Blob };

const MAX_AREA = 16_000_000;
const PAGE_LIMIT = 400;

function Chip({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold leading-tight transition-all disabled:opacity-60 ${
        active ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function PdfCompressStudio({ tool }: { tool: Tool }) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [opening, setOpening] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [level, setLevel] = useState<Level>("strong");
  const [dpi, setDpi] = useState<Dpi>(100);
  const [quality, setQuality] = useState(65);
  const [gray, setGray] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const holder = useRef<{ doc: PDFDocumentProxy | null; token: number; stop: boolean; urls: Set<string> }>({ doc: null, token: 0, stop: false, urls: new Set() });

  useEffect(() => {
    const h = holder.current;
    return () => {
      h.token++;
      h.stop = true;
      void h.doc?.destroy();
      h.urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function makeUrl(blob: Blob) {
    const u = URL.createObjectURL(blob);
    holder.current.urls.add(u);
    return u;
  }
  function revoke(u: string | null | undefined) {
    if (!u) return;
    URL.revokeObjectURL(u);
    holder.current.urls.delete(u);
  }

  async function onFile(f: File | undefined) {
    if (!f || running) return;
    if (!isPdf(f)) {
      setError("Please choose a PDF file.");
      notify.error("That isn't a PDF", "Choose a file ending in .pdf.");
      return;
    }
    const h = holder.current;
    const token = ++h.token;
    void h.doc?.destroy();
    h.doc = null;
    revoke(output?.url);
    setOutput(null);
    setProgress(null);
    setOpening(true);
    setError(null);
    try {
      const pdfjs = await loadPdfJs();
      const task = pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false });
      let doc: PDFDocumentProxy;
      try {
        doc = await task.promise;
      } catch (err) {
        void task.destroy();
        throw err;
      }
      if (token !== h.token) {
        void doc.destroy();
        return;
      }
      h.doc = doc;
      setFile(f);
      setPageCount(doc.numPages);
      revoke(originalUrl);
      setOriginalUrl(makeUrl(f));
      if (doc.numPages > PAGE_LIMIT) notify.warning(`${doc.numPages} pages`, `Strong compression handles up to ${PAGE_LIMIT} pages at a time — split the PDF first.`);
    } catch (err) {
      if (token !== h.token) return;
      const { title, body } = describePdfError(err);
      setFile(null);
      setPageCount(0);
      setError(`${title}. ${body}`);
      notify.error(title, body);
    } finally {
      if (token === h.token) setOpening(false);
    }
  }

  function reset() {
    const h = holder.current;
    h.token++;
    h.stop = true;
    void h.doc?.destroy();
    h.doc = null;
    revoke(output?.url);
    revoke(originalUrl);
    setOutput(null);
    setOriginalUrl(null);
    setFile(null);
    setPageCount(0);
    setProgress(null);
    setError(null);
    setRunning(false);
  }

  async function basic(f: File): Promise<Blob> {
    const { PDFDocument } = await import("pdf-lib");
    let doc;
    try {
      doc = await PDFDocument.load(await f.arrayBuffer(), { updateMetadata: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      throw new Error(
        /encrypt/i.test(msg)
          ? "This PDF is encrypted, so Basic can't rewrite it. Try Strong, which rebuilds the pages from scratch."
          : "This PDF's structure could not be read — it may be damaged. Strong compression may still work.",
      );
    }
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  }

  async function strong(doc: PDFDocumentProxy, token: number): Promise<Blob> {
    const h = holder.current;
    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.create();
    out.setProducer("SnapGrab PDF compressor");
    out.setCreator("SnapGrab");
    const total = doc.numPages;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: gray });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    try {
      for (let n = 1; n <= total; n++) {
        if (h.stop || token !== h.token) throw new Stopped();
        setProgress({ done: n - 1, total });
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 }); // PDF points, rotation applied
        let scale = dpi / 72;
        const area = base.width * base.height * scale * scale;
        if (area > MAX_AREA) scale *= Math.sqrt(MAX_AREA / area);
        const viewport = page.getViewport({ scale });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
        if (gray) {
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const p = img.data;
          for (let i = 0; i < p.length; i += 4) {
            const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
            p[i] = p[i + 1] = p[i + 2] = l;
          }
          ctx.putImageData(img, 0, 0);
        }
        const jpg = await toBlob(canvas, "image/jpeg", quality / 100);
        const image = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
        const pdfPage = out.addPage([base.width, base.height]);
        pdfPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      }
    } finally {
      canvas.width = canvas.height = 0;
    }
    setProgress({ done: total, total });
    const bytes = await out.save({ useObjectStreams: true });
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  }

  async function run() {
    const h = holder.current;
    if (!file || !h.doc || running) return;
    if (level === "strong" && pageCount > PAGE_LIMIT) {
      const msg = `Strong compression handles up to ${PAGE_LIMIT} pages at a time — split the PDF first, then compress each part.`;
      setError(msg);
      notify.warning("Too many pages", msg);
      return;
    }
    h.stop = false;
    const token = h.token;
    revoke(output?.url);
    setOutput(null);
    setError(null);
    setRunning(true);
    setProgress(level === "strong" ? { done: 0, total: pageCount } : null);
    trackEvent("process", tool.slug);
    try {
      const blob = level === "basic" ? await basic(file) : await strong(h.doc, token);
      if (token !== h.token) return;
      const name = `${file.name.replace(/\.pdf$/i, "") || "document"}-compressed.pdf`;
      const url = makeUrl(blob);
      setOutput({ url, name, size: blob.size, level, pages: pageCount, blob });
      if (blob.size < file.size) {
        notify.success("PDF compressed", `${formatBytes(file.size)} → ${formatBytes(blob.size)} (${Math.round((1 - blob.size / file.size) * 100)}% smaller)`);
      } else {
        notify.warning("No saving this time", "The result isn't smaller — keep your original.");
      }
      fetch("/api/tools/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ tool: tool.slug, inputType: "application/pdf", outputType: "application/pdf", files: 1, bytesIn: file.size, bytesOut: blob.size }),
      }).catch(() => {});
    } catch (err) {
      if (token !== h.token) return;
      if (err instanceof Stopped) {
        notify.info("Stopped", "Nothing was saved.");
        setProgress(null);
        return;
      }
      const { title, body } = err instanceof Error && !(err as { name?: string }).name?.endsWith("Exception") ? { title: "Could not compress this PDF", body: err.message } : describePdfError(err);
      setError(`${title}. ${body}`);
      notify.error(title, body);
    } finally {
      if (token === h.token) setRunning(false);
    }
  }

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const saved = output && file ? 1 - output.size / file.size : 0;
  const bigger = !!output && !!file && output.size >= file.size;

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="aurora-border rounded-[26px]">
        <div className="glass rounded-[26px] p-4 sm:p-6">
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void onFile(e.dataTransfer.files[0]);
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
              <p className="mt-1 text-sm text-muted">One document at a time — compressed on this device</p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl surface p-3 sm:p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{file.name}</span>
                <span className="block text-xs text-muted">
                  {formatBytes(file.size)} · {pageCount} page{pageCount === 1 ? "" : "s"}
                </span>
              </span>
              <button
                type="button"
                onClick={reset}
                disabled={running}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-muted transition-colors hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Clear</span>
                <span className="sr-only sm:hidden">Clear file</span>
              </button>
            </div>
          )}

          {file && (
            <div className="mt-5 space-y-4">
              <div>
                <span className="mb-2 block text-sm font-semibold">Compression</span>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Compression level">
                  {(
                    [
                      ["basic", "Basic", "Keeps text selectable. Repacks the file — savings are often small."],
                      ["strong", "Strong", "Turns each page into a compressed image. Much smaller; text is no longer selectable. Best for scans."],
                    ] as const
                  ).map(([id, label, body]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={level === id}
                      disabled={running}
                      onClick={() => setLevel(id)}
                      className={`rounded-xl px-4 py-3 text-left transition-all disabled:opacity-60 ${
                        level === id ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface hover:border-brand-400/60"
                      }`}
                    >
                      <span className="block text-sm font-bold">{label}</span>
                      <span className={`mt-0.5 block text-xs ${level === id ? "text-white/85" : "text-muted"}`}>{body}</span>
                    </button>
                  ))}
                </div>
              </div>

              {level === "strong" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="mb-2 block text-sm font-semibold">Resolution</span>
                    <div className="flex gap-2" role="radiogroup" aria-label="Resolution">
                      {([72, 100, 150] as const).map((d) => (
                        <Chip key={d} active={dpi === d} disabled={running} onClick={() => setDpi(d)}>
                          {d} DPI
                          <span className="block text-[11px] font-semibold opacity-80">{d === 72 ? "Smallest" : d === 100 ? "Balanced" : "Sharper"}</span>
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pdfc-quality" className="mb-2 flex items-center justify-between text-sm font-semibold">
                      Image quality <span className="font-mono text-brand-400">{quality}%</span>
                    </label>
                    <input
                      id="pdfc-quality"
                      type="range"
                      min={30}
                      max={90}
                      value={quality}
                      disabled={running}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                    <p className="mt-1 text-xs text-muted">{quality >= 75 ? "Cleaner text, bigger file." : quality >= 55 ? "Good for most documents." : "Smallest — small print may blur."}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={gray} disabled={running} onChange={(e) => setGray(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-500)]" />
                    Black &amp; white (grayscale) — usually smaller for text documents
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={() => void run()}
              disabled={!file || running || opening}
              whileHover={{ scale: file && !running ? 1.02 : 1 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:min-w-[210px] sm:flex-none"
            >
              {running ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
              {running ? "Compressing…" : output ? "Compress again" : "Compress PDF"}
            </motion.button>
            {running && level === "strong" && (
              <button
                type="button"
                onClick={() => {
                  holder.current.stop = true;
                }}
                className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:text-red-400"
              >
                <Square className="h-4 w-4" /> Cancel
              </button>
            )}
          </div>

          {running && level === "strong" && progress && (
            <div className="mt-4" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.2 }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Page {Math.min(progress.done + 1, progress.total)} of {progress.total} · {pct}%
              </p>
            </div>
          )}
          {running && level === "basic" && <p className="mt-4 text-sm text-muted" aria-live="polite">Repacking the file…</p>}

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </motion.p>
            )}
          </AnimatePresence>

          {output && file && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl surface p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[var(--bg-soft)] px-2 py-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Before</span>
                  <span className="block font-extrabold">{formatBytes(file.size)}</span>
                </div>
                <div className="rounded-xl bg-[var(--bg-soft)] px-2 py-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">After</span>
                  <span className="block font-extrabold">{formatBytes(output.size)}</span>
                </div>
                <div className={`rounded-xl px-2 py-3 ${bigger ? "bg-amber-500/10 text-amber-500" : "bg-gradient-to-br from-brand-500 to-accent-500 text-white"}`}>
                  <span className="block text-[11px] font-bold uppercase tracking-wider opacity-80">Saved</span>
                  <span className="block font-extrabold">{bigger ? "0%" : saved < 0.01 ? "<1%" : `${Math.min(99, Math.floor(saved * 100))}%`}</span>
                </div>
              </div>

              {bigger ? (
                <p className="mt-3 flex items-start gap-2 text-sm text-amber-500">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {output.level === "basic"
                    ? "This PDF is already well packed, so Basic couldn't shrink it. Try Strong, or keep your original."
                    : "The image version is bigger than your original — common for PDFs that are mostly text. Keep the original, or try 72 DPI and a lower quality."}
                </p>
              ) : (
                <p className="mt-3 flex items-start gap-2 text-sm text-accent-400">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {output.level === "strong"
                    ? "Pages are now images: check small print is still readable before you send it. Text can't be selected or searched."
                    : "Text, links and pages are unchanged."}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {bigger && originalUrl ? (
                  <a
                    href={originalUrl}
                    download={file.name}
                    onClick={() => trackEvent("download", "original")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 sm:flex-none"
                  >
                    <Download className="h-[18px] w-[18px]" /> Keep original
                  </a>
                ) : null}
                <a
                  href={output.url}
                  download={output.name}
                  onClick={() => trackEvent("download", tool.slug)}
                  className={
                    bigger
                      ? "flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60"
                      : "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 sm:flex-none"
                  }
                >
                  <Download className="h-[18px] w-[18px]" /> {bigger ? "Download anyway" : "Download PDF"}
                </a>
                <ShareSheet
                  title={tool.name}
                  text={`Compressed with the free ${tool.name} on SnapGrab`}
                  getFiles={() => [bigger ? file : blobToFile(output.blob, output.name)]}
                />
              </div>
            </motion.div>
          )}

          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
            Runs in your browser with pdf.js and pdf-lib — your PDF is never uploaded.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

