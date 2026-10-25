"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Camera,
  Check,
  ClipboardPaste,
  Contrast,
  Copy,
  Download,
  Languages,
  Loader2,
  RotateCcw,
  ScanText,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * languages & constants
 * ------------------------------------------------------------------ */

type LangKey = "eng" | "urd" | "ara" | "hin" | "eng+urd";

const LANGS: { key: LangKey; label: string; native?: string; dir: "ltr" | "rtl" | "auto" }[] = [
  { key: "eng", label: "English", dir: "ltr" },
  { key: "urd", label: "Urdu", native: "اردو", dir: "rtl" },
  { key: "ara", label: "Arabic", native: "العربية", dir: "rtl" },
  { key: "hin", label: "Hindi", native: "हिन्दी", dir: "ltr" },
  { key: "eng+urd", label: "English + Urdu", dir: "auto" },
];

const LANG_STORE = "sg:ocr-lang";

const STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "Loading OCR engine",
  "initializing tesseract": "Starting OCR engine",
  "initialized tesseract": "OCR engine ready",
  "loading language traineddata": "Loading language data",
  "loading language traineddata (from cache)": "Loading language data",
  "loaded language traineddata": "Language data ready",
  "initializing api": "Preparing",
  "initialized api": "Preparing",
  "recognizing text": "Recognizing text",
};

type Source = { file: File; url: string };
type Progress = { label: string; pct: number };

/** Minimal shape of the tesseract.js worker we use — keeps the heavy module out of this file's static imports. */
type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i.test(file.name);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This file is not an image your browser can open."));
    img.src = url;
  });
}

/**
 * Draws the image at a size Tesseract likes (small screenshots are scaled up, huge photos down) and,
 * optionally, turns it into clean black-on-white with a local (Bradley) threshold so uneven lighting
 * and shadows on photographed documents don't swallow the text.
 */
function prepare(img: HTMLImageElement, improve: boolean) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const longest = Math.max(iw, ih);
  let scale = 1;
  if (longest < 1400) scale = Math.min(2, 1400 / longest);
  if (longest * scale > 3000) scale = 3000 / longest;
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: improve });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#ffffff"; // transparent PNGs would otherwise read as black
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  if (!improve) return canvas;

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const grey = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; j < grey.length; i += 4, j++) grey[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;

  // integral image → mean brightness of a window around every pixel in O(1)
  const integral = new Uint32Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += grey[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 32));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = grey[y * w + x] < mean * 0.85 ? 0 : 255;
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** UTF-8 with a BOM so Notepad and Excel show Urdu, Arabic and Hindi correctly. */
const textBlob = (text: string) => new Blob(["﻿", text], { type: "text/plain;charset=utf-8" });

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/* ------------------------------------------------------------------ */

export default function OcrStudio({ tool }: { tool: Tool }) {
  const [src, setSrc] = useState<Source | null>(null);
  const [lang, setLang] = useState<LangKey>("eng");
  const [improve, setImprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // a stable holder object, so the unmount cleanup can reach the live worker
  const jobRef = useRef<{ worker: OcrWorker | null; run: number }>({ worker: null, run: 0 });

  // restore the last language after hydration (deferred: no synchronous setState inside an effect)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(LANG_STORE) as LangKey | null;
        if (saved && LANGS.some((l) => l.key === saved)) setLang(saved);
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // the object URL lives exactly as long as the source it belongs to
  useEffect(() => {
    if (!src) return;
    const url = src.url;
    return () => URL.revokeObjectURL(url);
  }, [src]);

  // never leave a Web Worker (and its ~20 MB of WASM) running after the page is left
  useEffect(() => {
    const job = jobRef.current;
    return () => {
      job.run++;
      void job.worker?.terminate().catch(() => {});
      job.worker = null;
    };
  }, []);

  const acceptFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!isImage(file)) {
      setError("Please choose an image (JPG, PNG, WEBP, screenshot…).");
      notify.error("That isn't an image", "Choose a photo or screenshot that contains text.");
      return;
    }
    setSrc({ file, url: URL.createObjectURL(file) });
    setText(null);
    setConfidence(null);
    setError(null);
  }, []);

  // Ctrl+V / ⌘V a screenshot anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      const named = new File([file], file.name && file.name !== "image.png" ? file.name : `screenshot-${Date.now()}.png`, { type: file.type });
      acceptFile(named);
      notify.info("Screenshot pasted", "Choose the language, then tap Extract text.");
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptFile]);

  function chooseLang(key: LangKey) {
    setLang(key);
    try {
      localStorage.setItem(LANG_STORE, key);
    } catch {}
  }

  async function recognize() {
    if (!src || busy) return;
    const job = jobRef.current;
    const run = ++job.run;
    const stale = () => job.run !== run;
    setBusy(true);
    setError(null);
    setProgress({ label: "Starting", pct: 0 });
    trackEvent("process", tool.slug);

    let worker: OcrWorker | null = null;
    try {
      const img = await loadImage(src.url);
      const canvas = prepare(img, improve);

      const mod = await import("tesseract.js");
      const T = (mod as unknown as { default?: typeof mod }).default ?? mod;
      worker = (await T.createWorker(lang.split("+"), 1, {
        logger: (m) => {
          if (stale()) return;
          const label = STATUS_LABELS[m.status] ?? m.status.charAt(0).toUpperCase() + m.status.slice(1);
          setProgress({ label, pct: Math.round((m.progress ?? 0) * 100) });
        },
      })) as unknown as OcrWorker;
      job.worker = worker;
      if (stale()) return;

      const { data } = await worker.recognize(canvas);
      canvas.width = 0;
      if (stale()) return;

      const out = data.text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      setText(out);
      setConfidence(Math.round(data.confidence));
      if (!out) {
        notify.warning("No text found", "Try a sharper, well-lit photo, the right language, or turn on Improve contrast.");
        return;
      }
      notify.success("Text extracted", `${countWords(out)} words · ${out.length} characters`);
      fetch("/api/tools/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          tool: tool.slug,
          inputType: src.file.type || "image",
          outputType: "text/plain",
          files: 1,
          bytesIn: src.file.size,
          bytesOut: textBlob(out).size,
        }),
      }).catch(() => {});
    } catch (err) {
      if (stale()) return;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const msg = offline
        ? "You appear to be offline — the OCR engine and language data download the first time you use them."
        : err instanceof Error && err.message
          ? err.message
          : "Something went wrong while reading the image.";
      setError(msg);
      notify.error("Could not extract text", offline ? "Connect to the internet once, then try again." : "Try again, or use a smaller / clearer image.");
    } finally {
      if (worker) void worker.terminate().catch(() => {});
      if (job.worker === worker) job.worker = null;
      if (!stale()) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  function cancel() {
    const job = jobRef.current;
    job.run++;
    void job.worker?.terminate().catch(() => {});
    job.worker = null;
    setBusy(false);
    setProgress(null);
    notify.info("Stopped", "Text recognition was cancelled.");
  }

  function reset() {
    setSrc(null);
    setText(null);
    setConfidence(null);
    setError(null);
  }

  async function copyText() {
    if (!text) return;
    trackEvent("copy", tool.slug);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    setCopied(true);
    notify.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1600);
  }

  const baseName = () => (src?.file.name.replace(/\.[^.]+$/, "") || "image") + "-text";

  function downloadTxt() {
    if (!text) return;
    const blob = textBlob(text);
    saveBlob(blob, `${baseName()}.txt`);
    trackEvent("download", tool.slug);
    notify.success("Text file downloaded", formatBytes(blob.size));
  }

  const langInfo = LANGS.find((l) => l.key === lang) ?? LANGS[0];
  const btnBase =
    "flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {/* language */}
          <div>
            <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Languages className="h-4 w-4 text-brand-400" /> Text language
            </span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Text language">
              {LANGS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={lang === l.key}
                  disabled={busy}
                  onClick={() => chooseLang(l.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                    lang === l.key
                      ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                      : "surface text-muted hover:text-[var(--fg)]"
                  }`}
                >
                  {l.label}
                  {l.native && <span className="ml-1 font-normal opacity-80">{l.native}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            {!src ? (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    acceptFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Choose an image with text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      inputRef.current?.click();
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
                    <UploadCloud className="h-6 w-6" />
                  </motion.span>
                  <p className="mt-4 font-bold">Drop an image with text, or tap to browse</p>
                  <p className="mt-1 text-sm text-muted">Photos, scans or screenshots — read in your browser, never uploaded</p>
                  <p className="mt-2 hidden items-center gap-1.5 text-xs text-muted sm:flex">
                    <ClipboardPaste className="h-3.5 w-3.5" /> Tip: press Ctrl+V to paste a screenshot
                  </p>
                </div>
                <div className="mt-3 flex justify-center sm:hidden">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-2 rounded-2xl surface px-5 py-3 text-sm font-bold transition-colors hover:border-brand-400/60"
                  >
                    <Camera className="h-4 w-4" /> Take a photo of the text
                  </button>
                </div>
              </>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
                {/* ---------------------------- image ---------------------------- */}
                <div className="min-w-0">
                  <div className="overflow-hidden rounded-2xl surface p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src.url}
                      alt="The image to read text from"
                      className="mx-auto max-h-[300px] w-auto max-w-full rounded-xl object-contain sm:max-h-[380px]"
                      style={improve ? { filter: "grayscale(1) contrast(1.6)" } : undefined}
                    />
                  </div>
                  <p className="mt-2 truncate text-xs text-muted">
                    {src.file.name} · {formatBytes(src.file.size)}
                  </p>

                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl surface p-3">
                    <input
                      type="checkbox"
                      checked={improve}
                      disabled={busy}
                      onChange={(e) => setImprove(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-500)]"
                    />
                    <span className="text-sm">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Contrast className="h-4 w-4 text-brand-400" /> Improve contrast
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        Turns the image black-and-white first. Helps with phone photos of documents, shadows and faint
                        print; leave it off for clean screenshots.
                      </span>
                    </span>
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={busy}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      <UploadCloud className="h-3.5 w-3.5" /> Change image
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      disabled={busy}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50 sm:hidden"
                    >
                      <Camera className="h-3.5 w-3.5" /> Camera
                    </button>
                  </div>
                </div>

                {/* ---------------------------- result --------------------------- */}
                <div className="min-w-0 space-y-4">
                  {text === null && (
                    <div className="rounded-2xl surface p-4">
                      <p className="text-sm font-bold">Ready to read {langInfo.label} text</p>
                      <p className="mt-0.5 text-xs text-muted">
                        The first run downloads the OCR engine and {langInfo.label} language data (a few MB) — after that it is
                        cached and faster.
                      </p>

                      {busy && progress ? (
                        <div className="mt-4" aria-live="polite">
                          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" /> {progress.label}
                            </span>
                            <span className="font-mono text-brand-400">{progress.pct}%</span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress.pct}
                            aria-label={progress.label}
                          >
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                              animate={{ width: `${progress.pct}%` }}
                              transition={{ duration: 0.25 }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={cancel}
                            className="mt-3 flex items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </div>
                      ) : (
                        <motion.button
                          type="button"
                          onClick={() => void recognize()}
                          disabled={busy}
                          whileHover={{ scale: busy ? 1 : 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className={`${btnBase} mt-4 w-full bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25 sm:w-auto`}
                        >
                          <ScanText className="h-4 w-4" /> Extract text
                        </motion.button>
                      )}
                    </div>
                  )}

                  {text !== null && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="ocr-text" className="text-sm font-semibold">
                          Extracted text <span className="font-normal text-muted">— edit freely</span>
                        </label>
                        <span className="text-xs text-muted">
                          {countWords(text)} words · {text.length} characters
                          {confidence !== null && text ? ` · ${confidence}% confidence` : ""}
                        </span>
                      </div>
                      <textarea
                        id="ocr-text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        dir={langInfo.dir}
                        lang={lang === "eng+urd" ? undefined : lang === "urd" ? "ur" : lang === "ara" ? "ar" : lang === "hin" ? "hi" : "en"}
                        rows={12}
                        placeholder="No text was found. Try another language, Improve contrast, or a sharper image."
                        className={`w-full resize-y rounded-xl surface px-4 py-3 text-sm leading-relaxed outline-none transition-all focus:border-brand-400 ${
                          langInfo.dir === "rtl" ? "text-right text-base leading-loose" : ""
                        }`}
                      />
                      {confidence !== null && text && confidence < 60 && (
                        <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          Low confidence — check the text carefully. A straighter, sharper photo or Improve contrast usually
                          helps.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyText()}
                          disabled={!text}
                          className={`${btnBase} flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25 sm:flex-none`}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copied ? "Copied" : "Copy text"}
                        </button>
                        <button
                          type="button"
                          onClick={downloadTxt}
                          disabled={!text}
                          className={`${btnBase} flex-1 surface hover:text-brand-400 sm:flex-none`}
                        >
                          <Download className="h-4 w-4" /> Download .txt
                        </button>
                        {text && (
                          <ShareSheet
                            title="Text extracted with SnapGrab"
                            text="I pulled this text out of an image with SnapGrab's free Image to Text tool"
                            getFiles={async () => [blobToFile(textBlob(text), `${baseName()}.txt`)]}
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setText(null);
                            setConfidence(null);
                          }}
                          className="flex items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]"
                        >
                          <ScanText className="h-3.5 w-3.5" /> Read again (other language / settings)
                        </button>
                        <button
                          type="button"
                          onClick={reset}
                          className="flex items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Recognize another image
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
            Text recognition runs in your browser — your image is never uploaded. Printed text works best; handwriting and
            decorative or Nastaliq Urdu fonts may need corrections.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
