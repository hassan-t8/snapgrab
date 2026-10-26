"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Download,
  ImageIcon,
  Loader2,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile, urlsToFiles } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * shared helpers
 * ------------------------------------------------------------------ */

/**
 * Websites disagree on whether a KB is 1,000 or 1,024 bytes, so every target is treated as
 * N × 1,000 bytes — a file under that passes either check.
 */
const KB = 1000;

/** iOS Safari refuses canvases above ~16.7 MP. */
const MAX_AREA = 16_000_000;
const MAX_SIDE = 6000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Size in KB with one decimal under 100 KB — "19.6 KB" tells you more than "20 KB" when the limit is 20. */
function kbLabel(bytes: number) {
  const k = bytes / 1024;
  if (k >= 1024) return formatBytes(bytes);
  return `${k < 100 ? k.toFixed(1) : Math.round(k)} KB`;
}

type Src = CanvasImageSource & { width: number; height: number };

function isImage(f: File) {
  return f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);
}

/** Decodes a file (EXIF rotation applied by the browser), shrinking anything too big for a canvas. */
async function decodeFile(file: File): Promise<{ img: Src; width: number; height: number }> {
  let img: Src;
  try {
    img = (await createImageBitmap(file)) as Src;
  } catch {
    img = await new Promise<Src>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = new Image();
      el.onload = () => resolve(el as unknown as Src);
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("This file is not an image your browser can open."));
      };
      el.src = url;
    });
  }
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  if (!w || !h) throw new Error("This image appears to be empty.");
  const k = Math.min(1, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_AREA / (w * h)));
  if (k >= 1) return { img, width: w, height: h };
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  (img as ImageBitmap).close?.();
  return { img: c, width: c.width, height: c.height };
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Your browser could not encode the image."))), type, quality),
  );
}

/** Draws a source onto a white canvas at the given size (JPG has no transparency). */
function drawScaled(src: Src, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

class Cancelled extends Error {}

/** Highest JPEG quality in [lo, hi] whose file fits under `target` bytes (binary search). */
async function bestQuality(canvas: HTMLCanvasElement, target: number, lo: number, hi: number, steps: number, alive: () => boolean) {
  const low = await encode(canvas, "image/jpeg", lo);
  if (!alive()) throw new Cancelled();
  if (low.size > target) return { ok: false, blob: low, q: lo };
  const top = await encode(canvas, "image/jpeg", hi);
  if (top.size <= target) return { ok: true, blob: top, q: hi };
  let best = { blob: low, q: lo };
  let a = lo;
  let b = hi;
  for (let i = 0; i < steps; i++) {
    if (!alive()) throw new Cancelled();
    const m = (a + b) / 2;
    const blob = await encode(canvas, "image/jpeg", m);
    if (blob.size <= target) {
      best = { blob, q: m };
      a = m;
    } else b = m;
  }
  return { ok: true, ...best };
}

type Fitted = { blob: Blob; width: number; height: number; quality: number | null; reached: boolean; kept: boolean };

/**
 * Lands a JPEG just under `target` bytes: first the best quality at full size, and only when even a
 * low quality is too big, the largest dimensions that fit at a decent quality.
 */
async function compressToTarget(file: File, src: Src, sw: number, sh: number, target: number, alive: () => boolean): Promise<Fitted> {
  if (/jpe?g$/i.test(file.type) && file.size <= target) {
    return { blob: file, width: sw, height: sh, quality: null, reached: true, kept: true };
  }
  const MIN_Q = 0.45;
  const MAX_Q = 0.92;
  const MID_Q = 0.72;

  const full = drawScaled(src, sw, sh);
  const first = await bestQuality(full, target, MIN_Q, MAX_Q, 6, alive);
  full.width = full.height = 0;
  if (first.ok) return { blob: first.blob, width: sw, height: sh, quality: first.q, reached: true, kept: false };

  // too big even at low quality: find the largest scale that fits at MID_Q
  const dims = (s: number) => [Math.max(8, Math.round(sw * s)), Math.max(8, Math.round(sh * s))] as const;
  let hi = 1;
  let lo = 0;
  let s = Math.min(0.9, Math.sqrt(target / first.blob.size) * 0.95);
  let smallest = first.blob;
  let smallestDims: readonly [number, number] = [sw, sh];
  for (let tries = 0; tries < 14; tries++) {
    if (!alive()) throw new Cancelled();
    const [w, h] = dims(s);
    const c = drawScaled(src, w, h);
    const blob = await encode(c, "image/jpeg", MID_Q);
    c.width = c.height = 0;
    if (blob.size <= target) {
      lo = s;
      break;
    }
    if (blob.size < smallest.size) {
      smallest = blob;
      smallestDims = [w, h];
    }
    hi = s;
    if (w <= 8 || h <= 8) break;
    s *= Math.min(0.9, Math.sqrt(target / blob.size) * 0.97);
  }
  if (!lo) {
    return { blob: smallest, width: smallestDims[0], height: smallestDims[1], quality: MID_Q, reached: false, kept: false };
  }
  // creep back up towards the largest size that still fits
  for (let i = 0; i < 4; i++) {
    if (!alive()) throw new Cancelled();
    const m = (lo + hi) / 2;
    const [w, h] = dims(m);
    const c = drawScaled(src, w, h);
    const blob = await encode(c, "image/jpeg", MID_Q);
    c.width = c.height = 0;
    if (blob.size <= target) lo = m;
    else hi = m;
  }
  const [w, h] = dims(lo);
  const c = drawScaled(src, w, h);
  const fin = await bestQuality(c, target, MID_Q, MAX_Q, 4, alive);
  c.width = c.height = 0;
  return { blob: fin.blob, width: w, height: h, quality: fin.q, reached: fin.ok, kept: false };
}

/** Records one anonymous use per page view, once the tool produces a real result. */
function useTrackOnce(slug: string, ready: boolean, files = 1) {
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ tool: slug, files }),
    }).catch(() => {});
  }, [slug, ready, files]);
}

function clickDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Shell({ children, note }: { children: ReactNode; note: string }) {
  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          {children}
          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
            {note}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-all disabled:opacity-50 ${
        active
          ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
          : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function DropArea({
  onFiles,
  multiple,
  busy,
  title,
  hint,
}: {
  onFiles: (files: File[]) => void;
  multiple: boolean;
  busy: boolean;
  title: string;
  hint: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pick = (list: FileList | null) => {
    if (list?.length) onFiles(Array.from(list));
  };
  return (
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
          pick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={title}
        aria-busy={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-7 text-center transition-all sm:p-10 ${
          dragging ? "border-brand-400 bg-brand-500/10" : "border-[var(--line)] hover:border-brand-400/60"
        }`}
      >
        <motion.span
          animate={dragging ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
          className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
        </motion.span>
        <p className="mt-4 font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
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
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-3 flex justify-center sm:hidden">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex items-center gap-2 rounded-2xl surface px-5 py-3 text-sm font-bold transition-colors hover:border-brand-400/60"
        >
          <Camera className="h-4 w-4" /> Take a photo with the camera
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * A. compress image to an exact size in KB
 * ------------------------------------------------------------------ */

const KB_PRESETS = [10, 20, 30, 50, 100, 200, 500];

type KbJob = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  status: "queued" | "working" | "done" | "error";
  out?: Fitted & { url: string; name: string; target: number };
  error?: string;
};

let jobSeq = 0;

function CompressKb({ tool, initialKb }: { tool: Tool; initialKb: number }) {
  const [targetKb, setTargetKb] = useState(initialKb);
  const [custom, setCustom] = useState(KB_PRESETS.includes(initialKb) ? "" : String(initialKb));
  const [jobs, setJobs] = useState<KbJob[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const runRef = useRef(0);
  const jobsRef = useRef<KbJob[]>([]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // release every object URL on unmount
  useEffect(
    () => () => {
      runRef.current++;
      jobsRef.current.forEach((j) => {
        URL.revokeObjectURL(j.url);
        if (j.out && !j.out.kept) URL.revokeObjectURL(j.out.url);
      });
    },
    [],
  );

  const done = jobs.filter((j) => j.status === "done" && j.out);
  useTrackOnce(tool.slug, done.length > 0, done.length);

  const process = useCallback(async (list: KbJob[], kb: number) => {
    const run = runRef.current;
    const alive = () => runRef.current === run;
    const target = kb * KB;
    for (const job of list) {
      if (!alive()) return;
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "working", error: undefined } : j)));
      try {
        const { img, width, height } = await decodeFile(job.file);
        const fit = await compressToTarget(job.file, img, width, height, target, alive);
        (img as ImageBitmap).close?.();
        if (!alive()) return;
        const base = job.file.name.replace(/\.[^.]+$/, "") || "image";
        const url = fit.kept ? job.url : URL.createObjectURL(fit.blob);
        const out = { ...fit, url, name: fit.kept ? job.file.name : `${base}-${kb}kb.jpg`, target: kb };
        setJobs((prev) =>
          prev.map((j) => {
            if (j.id !== job.id) return j;
            if (j.out && !j.out.kept) URL.revokeObjectURL(j.out.url);
            return { ...j, status: "done", out };
          }),
        );
      } catch (err) {
        if (err instanceof Cancelled || !alive()) return;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "error", error: err instanceof Error ? err.message : "Could not compress this image." } : j,
          ),
        );
      }
    }
    if (alive()) trackEvent("process");
  }, []);

  async function addFiles(files: File[]) {
    const images = files.filter(isImage);
    if (!images.length) {
      notify.error("No images found", "Choose JPG, PNG or WEBP photos.");
      return;
    }
    if (images.length < files.length) notify.warning("Some files were skipped", "Only images can be compressed here.");
    setAdding(true);
    const next: KbJob[] = [];
    for (const file of images) {
      const url = URL.createObjectURL(file);
      try {
        const { img, width, height } = await decodeFile(file);
        (img as ImageBitmap).close?.();
        next.push({ id: `kb-${jobSeq++}`, file, url, width, height, status: "queued" });
      } catch {
        next.push({ id: `kb-${jobSeq++}`, file, url, width: 0, height: 0, status: "error", error: "Your browser can't open this image — try a JPG or PNG." });
      }
    }
    setAdding(false);
    setJobs((prev) => [...prev, ...next]);
    setSelected((s) => s ?? next.find((j) => j.status !== "error")?.id ?? null);
    void process(
      next.filter((j) => j.status !== "error"),
      targetKb,
    );
  }

  function changeTarget(kb: number) {
    if (!Number.isFinite(kb) || kb < 1) return;
    const value = Math.min(10_000, Math.round(kb));
    if (value === targetKb && jobsRef.current.every((j) => j.status !== "queued")) return;
    setTargetKb(value);
    runRef.current++; // stop the run for the old target
    const redo = jobsRef.current.filter((j) => j.width > 0);
    if (redo.length) {
      setJobs((prev) => prev.map((j) => (j.width > 0 ? { ...j, status: "queued" } : j)));
      void process(redo, value);
    }
  }

  function remove(id: string) {
    setJobs((prev) => {
      const j = prev.find((x) => x.id === id);
      if (j) {
        URL.revokeObjectURL(j.url);
        if (j.out && !j.out.kept) URL.revokeObjectURL(j.out.url);
      }
      return prev.filter((x) => x.id !== id);
    });
    setSelected((s) => (s === id ? null : s));
  }

  function clearAll() {
    runRef.current++;
    jobs.forEach((j) => {
      URL.revokeObjectURL(j.url);
      if (j.out && !j.out.kept) URL.revokeObjectURL(j.out.url);
    });
    setJobs([]);
    setSelected(null);
  }

  function downloadAll() {
    trackEvent("download-all");
    if (done.length > 1) notify.info(`Downloading ${done.length} images`, "Allow multiple downloads if your browser asks.");
    done.forEach((j, i) => setTimeout(() => clickDownload(j.out!.url, j.out!.name), i * 300));
  }

  const working = jobs.some((j) => j.status === "working" || j.status === "queued");
  const view = jobs.find((j) => j.id === selected && j.out) ?? done[0];
  const totalIn = done.reduce((n, j) => n + j.file.size, 0);
  const totalOut = done.reduce((n, j) => n + (j.out?.blob.size ?? 0), 0);

  return (
    <Shell note="Compression runs in your browser — your photos are never uploaded.">
      <div>
        <span className="mb-2 block text-sm font-semibold">Target size</span>
        <div className="flex flex-wrap gap-2">
          {KB_PRESETS.map((kb) => (
            <Chip
              key={kb}
              active={targetKb === kb && !custom}
              onClick={() => {
                setCustom("");
                changeTarget(kb);
              }}
            >
              {kb} KB
            </Chip>
          ))}
          <label className="flex items-center gap-2 rounded-xl surface px-3 py-1.5 text-sm">
            <span className="font-semibold text-muted">Custom</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={custom}
              placeholder="KB"
              aria-label="Custom target size in KB"
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => custom && changeTarget(Number(custom))}
              onKeyDown={(e) => e.key === "Enter" && custom && changeTarget(Number(custom))}
              className="w-16 bg-transparent font-mono outline-none"
            />
            <span className="text-muted">KB</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Output is JPG, aimed just under {targetKb.toLocaleString()} KB ({(targetKb * KB).toLocaleString()} bytes) so it passes whether a
          website counts 1 KB as 1,000 or 1,024 bytes. Quality is lowered first; the dimensions shrink only if they have to.
        </p>
      </div>

      <div className="mt-5">
        <DropArea
          onFiles={(f) => void addFiles(f)}
          multiple
          busy={adding}
          title={adding ? "Opening images…" : jobs.length ? "Add more images" : "Drop images here, or tap to browse"}
          hint="JPG, PNG, WEBP · several at once"
        />
      </div>

      {jobs.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {done.length > 1 && (
            <button
              type="button"
              onClick={downloadAll}
              className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-3 font-bold text-white shadow-xl shadow-brand-500/25 sm:flex-none"
            >
              <Download className="h-[18px] w-[18px]" /> Save all ({done.length})
            </button>
          )}
          {done.length > 0 && (
            <ShareSheet
              title={tool.name}
              text={`Compressed to ${targetKb} KB with the free ${tool.name} on SnapGrab`}
              label={done.length > 1 ? `Share all (${done.length})` : "Share"}
              getFiles={() => urlsToFiles(done.map((j) => ({ url: j.out!.url, name: j.out!.name })))}
            />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-2 rounded-2xl surface px-5 py-3 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <RotateCcw className="h-[18px] w-[18px]" /> Clear
          </button>
          {working && (
            <span className="flex items-center gap-2 px-2 text-sm text-muted" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" /> Compressing…
            </span>
          )}
        </div>
      )}

      {done.length > 0 && totalIn > 0 && (
        <p className="mt-4 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-2.5 text-sm text-accent-400" aria-live="polite">
          {formatBytes(totalIn)} → {formatBytes(totalOut)}
          {totalOut < totalIn ? ` · ${Math.min(99, Math.floor(((totalIn - totalOut) / totalIn) * 100))}% smaller` : ""}
        </p>
      )}

      {/* before / after */}
      {view?.out && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "Before", url: view.url, size: view.file.size, w: view.width, h: view.height },
            { label: "After", url: view.out.url, size: view.out.blob.size, w: view.out.width, h: view.out.height },
          ].map((p) => (
            <figure key={p.label} className="min-w-0 overflow-hidden rounded-2xl surface">
              <div className="grid aspect-square place-items-center bg-[var(--bg-soft)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`${p.label} compression`} className="max-h-full max-w-full object-contain" />
              </div>
              <figcaption className="p-2.5 text-xs sm:p-3">
                <span className="block font-bold">{p.label}</span>
                <span className="text-muted">
                  {kbLabel(p.size)} · {p.w}×{p.h}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* queue */}
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-2.5">
            {jobs.map((job) => (
              <li
                key={job.id}
                className={`flex items-center gap-3 rounded-2xl surface p-2.5 sm:p-3 ${view?.id === job.id ? "border-brand-400/60" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => job.out && setSelected(job.id)}
                  aria-label={`Preview ${job.file.name}`}
                  className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--bg-soft)]"
                >
                  {job.width > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.out?.url ?? job.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted" />
                  )}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{job.out?.name ?? job.file.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    <span>{kbLabel(job.file.size)}</span>
                    {job.out && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span className={`font-semibold ${job.out.reached ? "text-accent-400" : "text-amber-400"}`}>
                          {kbLabel(job.out.blob.size)}
                        </span>
                        <span>
                          · {job.out.width}×{job.out.height}
                        </span>
                        {job.out.quality !== null && <span>· quality {Math.round(job.out.quality * 100)}%</span>}
                      </>
                    )}
                    {job.status === "working" && <span>· working…</span>}
                    {job.status === "queued" && <span>· waiting…</span>}
                  </span>
                  {job.out?.kept && (
                    <span className="mt-0.5 block text-xs text-accent-400">Already under {job.out.target} KB — original kept unchanged.</span>
                  )}
                  {job.out && !job.out.reached && (
                    <span className="mt-0.5 block text-xs text-amber-400">Could not get under {job.out.target} KB — this is the smallest it would go.</span>
                  )}
                  {job.error && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {job.error}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  {(job.status === "working" || job.status === "queued") && <Loader2 className="h-4 w-4 animate-spin text-brand-400" />}
                  {job.out && job.status === "done" && (
                    <a
                      href={job.out.url}
                      download={job.out.name}
                      onClick={() => trackEvent("download")}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-3.5 py-2 text-sm font-bold text-white"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Save</span>
                      <span className="sr-only sm:hidden">Save {job.out.name}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(job.id)}
                    aria-label={`Remove ${job.file.name}`}
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * B. photo & signature resizer for online forms
 * ------------------------------------------------------------------ */

type Kind = "photo" | "signature" | "thumb";
type Format = "jpg" | "png";

type Preset = { id: string; label: string; kind: Kind; w: number; h: number; kb: number; format: Format; note?: string };

/** Common shapes of form requirements — deliberately generic: every portal sets its own numbers. */
const PRESETS: Preset[] = [
  { id: "photo-35x45", label: "Photo 35 × 45 mm", kind: "photo", w: 413, h: 531, kb: 50, format: "jpg", note: "413×531 px (300 DPI)" },
  { id: "photo-200x230", label: "Photo 200 × 230 px", kind: "photo", w: 200, h: 230, kb: 30, format: "jpg" },
  { id: "photo-square", label: "Square photo 600 × 600 px", kind: "photo", w: 600, h: 600, kb: 100, format: "jpg" },
  { id: "sig-300x80", label: "Signature 300 × 80 px", kind: "signature", w: 300, h: 80, kb: 20, format: "jpg" },
  { id: "sig-140x60", label: "Signature 140 × 60 px", kind: "signature", w: 140, h: 60, kb: 10, format: "jpg" },
  { id: "thumb-200", label: "Thumb impression 200 × 200 px", kind: "thumb", w: 200, h: 200, kb: 20, format: "jpg" },
];

type View = { zoom: number; fx: number; fy: number };
const DEFAULT_VIEW: View = { zoom: 1, fx: 0, fy: 0 };

/** Where the source lands inside a W×H output (output pixels). fx/fy ∈ [-1, 1] pan across any overflow. */
function placement(sw: number, sh: number, W: number, H: number, v: View, fit: boolean) {
  const base = fit ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
  const dw = sw * base * v.zoom;
  const dh = sh * base * v.zoom;
  const dx = dw > W ? ((W - dw) * (1 + v.fx)) / 2 : (W - dw) / 2;
  const dy = dh > H ? ((H - dh) * (1 + v.fy)) / 2 : (H - dh) / 2;
  return { dx, dy, dw, dh };
}

/**
 * Turns a phone photo of a signature into clean ink on white: lighting is evened out by dividing
 * each pixel by a local estimate of the paper brightness, the paper is pushed to pure white and the
 * ink optionally darkened. Ink colour (blue, black) is kept.
 */
function cleanPaper(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number, darken: boolean) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const B = Math.max(12, Math.round(Math.max(w, h) / 14));
  const gw = Math.ceil(w / B);
  const gh = Math.ceil(h / B);
  const grid = new Float32Array(gw * gh);
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      lum[y * w + x] = l;
      const g = ((y / B) | 0) * gw + ((x / B) | 0);
      if (l > grid[g]) grid[g] = l; // brightest pixel ≈ paper
    }
  }
  // smooth the paper estimate so block edges don't show
  const smooth = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let s = 0;
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const yy = gy + oy;
          const xx = gx + ox;
          if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
          s += grid[yy * gw + xx];
          n++;
        }
      }
      smooth[gy * gw + gx] = Math.max(40, s / n);
    }
  }
  const hiT = 0.94 - strength * 0.0022; // above this (relative to paper) → white
  const loT = hiT - 0.38;
  const inkK = darken ? 0.5 : 1;
  for (let y = 0; y < h; y++) {
    const gyf = clamp(y / B - 0.5, 0, gh - 1);
    const gy0 = gyf | 0;
    const gy1 = Math.min(gh - 1, gy0 + 1);
    const ty = gyf - gy0;
    for (let x = 0; x < w; x++) {
      const gxf = clamp(x / B - 0.5, 0, gw - 1);
      const gx0 = gxf | 0;
      const gx1 = Math.min(gw - 1, gx0 + 1);
      const tx = gxf - gx0;
      const bg =
        (smooth[gy0 * gw + gx0] * (1 - tx) + smooth[gy0 * gw + gx1] * tx) * (1 - ty) +
        (smooth[gy1 * gw + gx0] * (1 - tx) + smooth[gy1 * gw + gx1] * tx) * ty;
      const n = lum[y * w + x] / bg;
      let v = clamp((n - loT) / (hiT - loT), 0, 1);
      v = v * v * (3 - 2 * v); // smoothstep: crisp edges without jaggies
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const ink = px[i + c] * inkK;
        px[i + c] = ink + (255 - ink) * v;
      }
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
}

type Clean = { on: boolean; strength: number; darken: boolean };

function renderForm(src: Src, sw: number, sh: number, W: number, H: number, v: View, fit: boolean, clean: Clean) {
  const p = placement(sw, sh, W, H, v, fit);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (!clean.on) {
    ctx.drawImage(src, p.dx, p.dy, p.dw, p.dh);
    return out;
  }
  // clean at up to 3× the output size (but never above the source detail), then scale down
  const k = clamp(Math.min(3, sw / p.dw, 1600 / Math.max(W, H)), 1, 3);
  const work = document.createElement("canvas");
  work.width = Math.round(W * k);
  work.height = Math.round(H * k);
  const wctx = work.getContext("2d", { willReadFrequently: true });
  if (!wctx) throw new Error("Canvas is unavailable in this browser.");
  wctx.fillStyle = "#ffffff";
  wctx.fillRect(0, 0, work.width, work.height);
  wctx.imageSmoothingQuality = "high";
  wctx.drawImage(src, p.dx * k, p.dy * k, p.dw * k, p.dh * k);
  cleanPaper(wctx, work.width, work.height, clean.strength, clean.darken);
  ctx.drawImage(work, 0, 0, W, H);
  work.width = work.height = 0;
  return out;
}

type Result = { key: string; url: string; size: number; quality: number | null; ok: boolean; name: string; w: number; h: number };

type Source = { canvas: HTMLCanvasElement; url: string; w: number; h: number; name: string };

async function canvasUrl(c: HTMLCanvasElement) {
  return URL.createObjectURL(await encode(c, "image/jpeg", 0.92));
}

function NumBox({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <span className="flex items-center rounded-xl surface pr-3 focus-within:border-brand-400">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm outline-none"
        />
        <span className="text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );
}

function FormPhoto({ tool, signatureFirst }: { tool: Tool; signatureFirst: boolean }) {
  const first = PRESETS.find((p) => p.id === (signatureFirst ? "sig-300x80" : "photo-35x45"))!;
  const [kind, setKind] = useState<Kind>(first.kind);
  const [w, setW] = useState(String(first.w));
  const [h, setH] = useState(String(first.h));
  const [maxKb, setMaxKb] = useState(String(first.kb));
  const [format, setFormat] = useState<Format>(first.format);
  const [src, setSrc] = useState<Source | null>(null);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [fit, setFit] = useState(false);
  const [clean, setClean] = useState<Clean>({ on: first.kind !== "photo", strength: 50, darken: true });
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; fx: number; fy: number; zoom: number; dist: number; fw: number } | null>(null);
  const urlRef = useRef<{ result?: string; src?: string }>({});

  const W = clamp(Math.round(Number(w) || 0), 0, 5000);
  const H = clamp(Math.round(Number(h) || 0), 0, 5000);
  const limitKb = Number(maxKb) > 0 ? Number(maxKb) : 0;
  const dimsOk = W >= 16 && H >= 16 && W * H <= MAX_AREA;
  const activePreset = PRESETS.find((p) => p.w === W && p.h === H && p.kb === limitKb && p.format === format && p.kind === kind);
  const key = src ? [src.url, W, H, limitKb, format, view.zoom, view.fx, view.fy, fit, clean.on, clean.strength, clean.darken].join("|") : "";

  useEffect(
    () => () => {
      const u = urlRef.current;
      if (u.result) URL.revokeObjectURL(u.result);
      if (u.src) URL.revokeObjectURL(u.src);
    },
    [],
  );

  useTrackOnce(tool.slug, !!result);

  // re-render and re-encode the output shortly after any change
  useEffect(() => {
    if (!src || !dimsOk) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const canvas = renderForm(src.canvas, src.w, src.h, W, H, view, fit, clean);
        let blob: Blob;
        let quality: number | null = null;
        let ok = true;
        if (format === "png") {
          blob = await encode(canvas, "image/png");
          ok = !limitKb || blob.size <= limitKb * KB;
        } else if (limitKb) {
          const r = await bestQuality(canvas, limitKb * KB, 0.3, 0.95, 7, () => !cancelled);
          blob = r.blob;
          quality = r.q;
          ok = r.ok;
        } else {
          blob = await encode(canvas, "image/jpeg", 0.92);
          quality = 0.92;
        }
        canvas.width = canvas.height = 0;
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current.result) URL.revokeObjectURL(urlRef.current.result);
        urlRef.current.result = url;
        const label = kind === "signature" ? "signature" : kind === "thumb" ? "thumb-impression" : "photo";
        setResult({ key, url, size: blob.size, quality, ok, name: `${label}-${W}x${H}.${format}`, w: W, h: H });
        setFailed(null);
      } catch (err) {
        if (cancelled || err instanceof Cancelled) return;
        setFailed(err instanceof Error ? err.message : "Could not create the image.");
      }
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [src, W, H, dimsOk, limitKb, format, view, fit, clean, kind, key]);

  function applyPreset(p: Preset) {
    setW(String(p.w));
    setH(String(p.h));
    setMaxKb(String(p.kb));
    setFormat(p.format);
    setKind(p.kind);
    setClean((c) => ({ ...c, on: p.kind !== "photo" }));
    setView(DEFAULT_VIEW);
  }

  async function setSourceCanvas(canvas: HTMLCanvasElement, name: string) {
    const url = await canvasUrl(canvas);
    if (urlRef.current.src) URL.revokeObjectURL(urlRef.current.src);
    urlRef.current.src = url;
    setSrc({ canvas, url, w: canvas.width, h: canvas.height, name });
  }

  async function openFile(files: File[]) {
    const file = files.find(isImage);
    if (!file) {
      notify.error("That isn't an image", "Choose a JPG, PNG or WEBP photo.");
      return;
    }
    setOpening(true);
    try {
      const { img, width, height } = await decodeFile(file);
      // keep a working copy at most 4000 px — plenty for any form size
      const k = Math.min(1, 4000 / Math.max(width, height));
      const c = drawScaled(img, Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k)));
      (img as ImageBitmap).close?.();
      await setSourceCanvas(c, file.name);
      setView(DEFAULT_VIEW);
      setFailed(null);
      notify.info("Photo loaded", "Drag to position it, pinch or use the slider to zoom.");
    } catch (err) {
      notify.error("Could not open this image", err instanceof Error ? err.message : "Try a JPG or PNG.");
    } finally {
      setOpening(false);
    }
  }

  async function rotate() {
    if (!src) return;
    const c = document.createElement("canvas");
    c.width = src.h;
    c.height = src.w;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src.canvas, 0, 0);
    await setSourceCanvas(c, src.name);
    setView(DEFAULT_VIEW);
  }

  function reset() {
    if (urlRef.current.src) URL.revokeObjectURL(urlRef.current.src);
    if (urlRef.current.result) URL.revokeObjectURL(urlRef.current.result);
    urlRef.current = {};
    setSrc(null);
    setResult(null);
    setView(DEFAULT_VIEW);
  }

  /* ------------------------------ pan & pinch ------------------------------ */

  function startGesture() {
    const pts = [...pointers.current.values()];
    const rect = frameRef.current?.getBoundingClientRect();
    if (!pts.length || !rect) return;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { x: cx, y: cy, fx: view.fx, fy: view.fy, zoom: view.zoom, dist, fw: rect.width };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !src || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const zoom = pts.length > 1 && g.dist > 0 ? clamp(g.zoom * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist), 1, 5) : g.zoom;
    const p = placement(src.w, src.h, W, H, { ...view, zoom }, fit);
    const k = W / g.fw; // screen px → output px
    const fx = p.dw > W ? clamp(g.fx - (2 * (cx - g.x) * k) / (p.dw - W), -1, 1) : 0;
    const fy = p.dh > H ? clamp(g.fy - (2 * (cy - g.y) * k) / (p.dh - H), -1, 1) : 0;
    setView({ zoom, fx, fy });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) startGesture();
    else gesture.current = null;
  }

  function onFrameKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.2 : 0.05;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => ({ ...v, fx: clamp(v.fx + dx, -1, 1), fy: clamp(v.fy + dy, -1, 1) }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clamp(v.zoom + 0.1, 1, 5) }));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clamp(v.zoom - 0.1, 1, 5) }));
    }
  }

  const place = src && dimsOk ? placement(src.w, src.h, W, H, view, fit) : null;
  const frameWidth = dimsOk ? Math.round(Math.min(320, (340 * W) / H)) : 320;
  const fresh = result && result.key === key;
  const shown = result;

  return (
    <Shell note="Everything happens in your browser — your photo and signature are never uploaded.">
      {/* size requirements */}
      <div>
        <span className="mb-2 block text-sm font-semibold">What does your form ask for?</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={activePreset?.id === p.id}
              className={`rounded-xl px-3.5 py-2.5 text-left text-sm transition-all ${
                activePreset?.id === p.id
                  ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                  : "surface hover:border-brand-400/60"
              }`}
            >
              <span className="block font-bold">{p.label}</span>
              <span className={`block text-xs ${activePreset?.id === p.id ? "text-white/80" : "text-muted"}`}>
                {p.note ?? `${p.w}×${p.h} px`} · under {p.kb} KB · {p.format.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          These are common examples, not any organisation&apos;s official rules. Check the exact size your form asks for and type it below.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumBox label="Width" value={w} onChange={setW} suffix="px" />
          <NumBox label="Height" value={h} onChange={setH} suffix="px" />
          <NumBox label="Max size (blank = none)" value={maxKb} onChange={setMaxKb} suffix="KB" />
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Format</span>
            <div className="flex gap-2">
              {(["jpg", "png"] as const).map((f) => (
                <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                  {f.toUpperCase()}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-muted">This is a</span>
          {(
            [
              ["photo", "Photo"],
              ["signature", "Signature"],
              ["thumb", "Thumb impression"],
            ] as const
          ).map(([k, label]) => (
            <Chip
              key={k}
              active={kind === k}
              onClick={() => {
                setKind(k);
                setClean((c) => ({ ...c, on: k !== "photo" }));
              }}
            >
              {label}
            </Chip>
          ))}
        </div>
        {!dimsOk && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> Enter a width and height of at least 16 px.
          </p>
        )}
      </div>

      <div className="mt-6">
        {!src ? (
          <DropArea
            onFiles={(f) => void openFile(f)}
            multiple={false}
            busy={opening}
            title={opening ? "Opening…" : kind === "photo" ? "Drop your photo, or tap to browse" : "Drop a photo of your signature, or tap to browse"}
            hint={kind === "photo" ? "JPG, PNG or WEBP" : "Sign on plain white paper with a dark pen, then take a straight, well-lit photo"}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* editor */}
            <div className="min-w-0">
              <div
                ref={frameRef}
                role="application"
                aria-label="Crop area. Drag or use the arrow keys to move the image; plus and minus zoom."
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onFrameKey}
                className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-md bg-white shadow-xl outline-none ring-brand-400 focus-visible:ring-2 active:cursor-grabbing"
                style={{ aspectRatio: `${W || 1} / ${H || 1}`, width: `min(100%, ${frameWidth}px)` }}
              >
                {place && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src.url}
                    alt="Your image inside the crop frame"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{
                      left: `${(place.dx / W) * 100}%`,
                      top: `${(place.dy / H) * 100}%`,
                      width: `${(place.dw / W) * 100}%`,
                      height: `${(place.dh / H) * 100}%`,
                    }}
                  />
                )}
              </div>
              <p className="mt-2 text-center text-xs text-muted">Drag to move · pinch or slider to zoom</p>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-sm font-semibold">
                    Zoom <span className="font-mono text-brand-400">{view.zoom.toFixed(1)}×</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.05}
                    value={view.zoom}
                    onChange={(e) => setView((v) => ({ ...v, zoom: Number(e.target.value) }))}
                    className="w-full accent-[var(--color-brand-500)]"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Chip active={!fit} onClick={() => setFit(false)}>
                    Fill (crop)
                  </Chip>
                  <Chip active={fit} onClick={() => setFit(true)}>
                    Fit (white edges)
                  </Chip>
                  <button
                    type="button"
                    onClick={() => void rotate()}
                    className="flex items-center gap-1.5 rounded-xl surface px-3.5 py-2 text-sm font-bold text-muted transition-colors hover:text-[var(--fg)]"
                  >
                    <RotateCw className="h-4 w-4" /> Rotate
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-xl surface px-3.5 py-2 text-sm font-bold text-muted transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" /> Change image
                  </button>
                </div>

                <div className="rounded-2xl surface p-3.5">
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
                    <span>
                      Clean up paper &amp; ink
                      <span className="block text-xs font-normal text-muted">Whitens the paper and strengthens the pen strokes — best for signatures and thumb impressions.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={clean.on}
                      onChange={(e) => setClean((c) => ({ ...c, on: e.target.checked }))}
                      className="h-5 w-5 shrink-0 accent-[var(--color-brand-500)]"
                    />
                  </label>
                  {clean.on && (
                    <div className="mt-3 space-y-3">
                      <label className="block">
                        <span className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                          Background whitening <span className="font-mono text-brand-400">{clean.strength}</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={clean.strength}
                          onChange={(e) => setClean((c) => ({ ...c, strength: Number(e.target.value) }))}
                          className="w-full accent-[var(--color-brand-500)]"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={clean.darken}
                          onChange={(e) => setClean((c) => ({ ...c, darken: e.target.checked }))}
                          className="h-4 w-4 accent-[var(--color-brand-500)]"
                        />
                        Darken the ink
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* result */}
            <div className="min-w-0">
              <span className="mb-2 block text-sm font-semibold">Result (actual size)</span>
              <div className="grid min-h-[140px] place-items-center rounded-2xl bg-[var(--bg-soft)] p-4">
                {shown ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shown.url}
                    alt="Resized result"
                    className={`border border-[var(--line)] bg-white transition-opacity ${fresh ? "" : "opacity-60"}`}
                    style={{ width: shown.w, maxWidth: "100%", height: "auto" }}
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                )}
              </div>

              {failed && (
                <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {failed}
                </p>
              )}

              {shown && (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center" aria-live="polite">
                    {[
                      ["Size", kbLabel(shown.size)],
                      ["Pixels", `${shown.w}×${shown.h}`],
                      ["Quality", shown.quality === null ? "Lossless" : `${Math.round(shown.quality * 100)}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl surface px-2 py-2.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
                        <span className="block text-sm font-extrabold">{value}</span>
                      </div>
                    ))}
                  </div>
                  {limitKb > 0 &&
                    (shown.ok ? (
                      <p className="mt-3 flex items-center gap-2 text-sm text-accent-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" /> Under {limitKb} KB and exactly {shown.w}×{shown.h} px.
                      </p>
                    ) : (
                      <p className="mt-3 flex items-start gap-2 text-sm text-amber-400">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {format === "png"
                          ? `PNG can't get under ${limitKb} KB at this size — switch to JPG if your form accepts it.`
                          : `Can't get under ${limitKb} KB at ${shown.w}×${shown.h} px even at low quality. Check the size limits again, or try a simpler background.`}
                      </p>
                    ))}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={shown.url}
                      download={shown.name}
                      onClick={() => trackEvent("download")}
                      aria-disabled={!fresh}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 sm:flex-none ${
                        fresh ? "" : "pointer-events-none opacity-60"
                      }`}
                    >
                      {fresh ? <Download className="h-[18px] w-[18px]" /> : <Loader2 className="h-[18px] w-[18px] animate-spin" />}
                      Download {format.toUpperCase()}
                    </a>
                    <ShareSheet
                      title={tool.name}
                      text={`Resized with the free ${tool.name} on SnapGrab`}
                      getFiles={async () => [blobToFile(await (await fetch(shown.url)).blob(), shown.name)]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

export default function FormPhotoStudio({ tool }: { tool: Tool }) {
  const mode = String(tool.mode ?? "compress-kb");
  if (mode.startsWith("form-photo")) return <FormPhoto tool={tool} signatureFirst={mode.endsWith(":signature")} />;
  const preset = Number(mode.split(":")[1]);
  return <CompressKb tool={tool} initialKb={Number.isFinite(preset) && preset > 0 ? preset : 100} />;
}
