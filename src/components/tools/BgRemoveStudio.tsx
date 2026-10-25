"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Download,
  Info,
  Loader2,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
} from "lucide-react";
import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * model & constants
 * ------------------------------------------------------------------ */

/** Must match the installed @mediapipe/tasks-vision version (pinned in package.json). */
const MEDIAPIPE_VERSION = "0.10.35";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

type ModelKind = "best" | "fast";

const MODELS: Record<ModelKind, { label: string; size: string; url: string }> = {
  best: {
    label: "Best quality",
    size: "16 MB",
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
  },
  fast: {
    label: "Fast / light",
    size: "0.3 MB",
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
  },
};

/** Longest side the mask is computed at; the cut-out itself is composed at full resolution. */
const WORK_MAX = 1024;
/** Longest side of the exported image — keeps phones from running out of canvas memory. */
const OUT_MAX = 4096;

const BACKGROUNDS = [
  { key: "transparent", label: "Transparent", value: "" },
  { key: "white", label: "White", value: "#ffffff" },
  { key: "blue", label: "Light blue", value: "#d6e6f5" },
  { key: "grey", label: "Light grey", value: "#e7e7e7" },
] as const;

type BgKey = (typeof BACKGROUNDS)[number]["key"] | "custom";
type Phase = "idle" | "model" | "processing" | "done";
type Source = { file: File; url: string; img: HTMLImageElement; width: number; height: number };

const CHECKER: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg,#d9d9d9 25%,transparent 25%),linear-gradient(-45deg,#d9d9d9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d9d9d9 75%),linear-gradient(-45deg,transparent 75%,#d9d9d9 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This file is not an image your browser can open."));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Your browser could not encode the image."))), type, quality),
  );
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

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Downloads the model with progress (the 16 MB file is the slow part of the first run). */
async function fetchModel(url: string, onProgress: (pct: number) => void) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The AI model could not be downloaded (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  const extra: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length <= total) out.set(value, got);
    else extra.push(value); // content-length lied (compression) — keep going
    got += value.length;
    onProgress(Math.min(99, Math.round((got / total) * 100)));
  }
  if (!extra.length) return got === total ? out : out.slice(0, got);
  const merged = new Uint8Array(got);
  merged.set(out.subarray(0, Math.min(got, total)));
  let off = total;
  for (const e of extra) {
    merged.set(e, off);
    off += e.length;
  }
  return merged;
}

/** Separable box blur on a single-channel float mask — a cheap, browser-independent feather. */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / span;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / span;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ */

export default function BgRemoveStudio({ tool }: { tool: Tool }) {
  const [src, setSrc] = useState<Source | null>(null);
  const [model, setModel] = useState<ModelKind>("best");
  const [phase, setPhase] = useState<Phase>("idle");
  const [modelPct, setModelPct] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [outSize, setOutSize] = useState<{ w: number; h: number } | null>(null);
  const [compare, setCompare] = useState(50);
  const [bgKey, setBgKey] = useState<BgKey>("transparent");
  const [customBg, setCustomBg] = useState("#ffd6e0");
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // stable holder: loaded segmenters, the current full-resolution cut-out and a run counter
  const store = useRef<{
    seg: Partial<Record<ModelKind, Promise<ImageSegmenter>>>;
    cutout: HTMLCanvasElement | null;
    run: number;
  }>({ seg: {}, cutout: null, run: 0 });

  useEffect(() => {
    if (!src) return;
    const url = src.url;
    return () => URL.revokeObjectURL(url);
  }, [src]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  // free the WASM segmenters when the tool is left
  useEffect(() => {
    const s = store.current;
    return () => {
      s.run++;
      Object.values(s.seg).forEach((p) => void p?.then((seg) => seg.close()).catch(() => {}));
      s.seg = {};
      if (s.cutout) s.cutout.width = 0;
      s.cutout = null;
    };
  }, []);

  function getSegmenter(kind: ModelKind) {
    const s = store.current;
    const cached = s.seg[kind];
    if (cached) return cached;
    const p = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const [fileset, buffer] = await Promise.all([
        vision.FilesetResolver.forVisionTasks(WASM_BASE),
        fetchModel(MODELS[kind].url, setModelPct),
      ]);
      return vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })();
    s.seg[kind] = p;
    p.catch(() => {
      if (s.seg[kind] === p) delete s.seg[kind]; // allow a retry after a failed download
    });
    return p;
  }

  async function removeBackground(source: Source, kind: ModelKind) {
    const s = store.current;
    const run = ++s.run;
    const stale = () => s.run !== run;
    setError(null);
    setPreview(null);
    setOutSize(null);
    setModelPct(0);
    setPhase(s.seg[kind] ? "processing" : "model");
    trackEvent("process", tool.slug);

    try {
      let seg: ImageSegmenter;
      try {
        seg = await getSegmenter(kind);
      } catch (err) {
        if (kind !== "best") throw err;
        // the big model failed (blocked, flaky network) — the light one usually still gets through
        notify.warning("Switching to the light model", "The high-quality model could not load, trying the fast one.");
        setModelPct(0);
        seg = await getSegmenter("fast");
        if (!stale()) setModel("fast");
      }
      if (stale()) return;
      setPhase("processing");
      await nextFrame();

      // 1. mask at a modest working size
      const ws = Math.min(1, WORK_MAX / Math.max(source.width, source.height));
      const ww = Math.max(1, Math.round(source.width * ws));
      const wh = Math.max(1, Math.round(source.height * ws));
      const work = makeCanvas(ww, wh);
      work.ctx.drawImage(source.img, 0, 0, ww, wh);

      // masks are only valid inside the callback, so copy what we need out of it
      const got: { fg: Float32Array | null; w: number; h: number; single: boolean } = { fg: null, w: ww, h: wh, single: false };
      seg.segment(work.c, (result) => {
        const masks = result.confidenceMasks ?? [];
        if (!masks.length) return;
        got.w = masks[0].width;
        got.h = masks[0].height;
        if (masks.length > 1) {
          // multiclass model: channel 0 is "background", everything else is the person
          const bg = masks[0].getAsFloat32Array();
          const fg = new Float32Array(bg.length);
          for (let i = 0; i < bg.length; i++) fg[i] = 1 - bg[i];
          got.fg = fg;
        } else {
          got.fg = Float32Array.from(masks[0].getAsFloat32Array());
          got.single = true;
        }
      });
      work.c.width = 0;
      if (stale()) return;
      if (!got.fg) throw new Error("The AI model returned no mask for this photo.");
      let mask: Float32Array = got.fg;
      const mw = got.w;
      const mh = got.h;

      if (got.single) {
        // single-channel model: make sure the mask means "person" (the frame edge is mostly background)
        let edge = 0;
        let centre = 0;
        let ne = 0;
        let nc = 0;
        for (let y = 0; y < mh; y++) {
          for (let x = 0; x < mw; x++) {
            const v = mask[y * mw + x];
            if (x < 3 || y < 3 || x >= mw - 3) {
              edge += v;
              ne++;
            } else if (Math.abs(x - mw / 2) < mw / 6 && Math.abs(y - mh / 2) < mh / 6) {
              centre += v;
              nc++;
            }
          }
        }
        if (edge / Math.max(1, ne) > centre / Math.max(1, nc)) for (let i = 0; i < mask.length; i++) mask[i] = 1 - mask[i];
      }

      // 2. tighten the soft probabilities, then feather the edge slightly
      let coverage = 0;
      for (let i = 0; i < mask.length; i++) {
        mask[i] = smoothstep(0.25, 0.75, mask[i]);
        coverage += mask[i];
      }
      if (coverage / mask.length < 0.01) {
        throw new Error("No person was found in this photo. This tool works best for portraits and selfies.");
      }
      mask = boxBlur(mask, mw, mh, Math.max(1, Math.round(Math.max(mw, mh) / 700)));

      const m = makeCanvas(mw, mh);
      const md = m.ctx.createImageData(mw, mh);
      for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
        md.data[j] = md.data[j + 1] = md.data[j + 2] = 255;
        md.data[j + 3] = Math.round(mask[i] * 255);
      }
      m.ctx.putImageData(md, 0, 0);

      // 3. compose the cut-out at the original resolution (capped for phone memory)
      const os = Math.min(1, OUT_MAX / Math.max(source.width, source.height));
      const W = Math.max(1, Math.round(source.width * os));
      const H = Math.max(1, Math.round(source.height * os));
      const out = makeCanvas(W, H);
      out.ctx.drawImage(source.img, 0, 0, W, H);
      out.ctx.globalCompositeOperation = "destination-in";
      out.ctx.drawImage(m.c, 0, 0, W, H);
      out.ctx.globalCompositeOperation = "source-over";
      m.c.width = 0;

      // 4. a lighter preview for the screen
      const ps = Math.min(1, 1200 / Math.max(W, H));
      const pv = makeCanvas(Math.round(W * ps), Math.round(H * ps));
      pv.ctx.drawImage(out.c, 0, 0, pv.c.width, pv.c.height);
      const pBlob = await toBlob(pv.c, "image/png");
      pv.c.width = 0;
      if (stale()) {
        out.c.width = 0;
        return;
      }

      if (s.cutout) s.cutout.width = 0;
      s.cutout = out.c;
      setPreview(URL.createObjectURL(pBlob));
      setOutSize({ w: W, h: H });
      setCompare(50);
      setPhase("done");
      notify.success("Background removed", "Pick a background, then download or share.");
    } catch (err) {
      if (stale()) return;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const msg = offline
        ? "You appear to be offline — the AI model downloads the first time you use this tool."
        : err instanceof Error && err.message
          ? err.message
          : "Something went wrong while removing the background.";
      setError(msg);
      setPhase("idle");
      notify.error("Could not remove the background", offline ? "Connect to the internet once, then try again." : undefined);
    }
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
      setError("Please choose a photo (JPG, PNG, WEBP…).");
      notify.error("That isn't an image", "Choose a JPG, PNG or WEBP photo.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const source = { file, url, img, width: img.naturalWidth, height: img.naturalHeight };
      setSrc(source);
      void removeBackground(source, model);
    } catch {
      URL.revokeObjectURL(url);
      setError("Your browser could not open this image. Try a JPG or PNG.");
      notify.error("Could not open this image", "HEIC photos may need converting to JPG first on some browsers.");
    }
  }

  function changeModel(kind: ModelKind) {
    setModel(kind);
    if (src && phase !== "model" && phase !== "processing") void removeBackground(src, kind);
  }

  function reset() {
    store.current.run++;
    if (store.current.cutout) store.current.cutout.width = 0;
    store.current.cutout = null;
    setSrc(null);
    setPreview(null);
    setOutSize(null);
    setPhase("idle");
    setError(null);
  }

  /* ------------------------------- exports -------------------------------- */

  const bgColour = bgKey === "custom" ? customBg : (BACKGROUNDS.find((b) => b.key === bgKey)?.value ?? "");
  const transparent = bgKey === "transparent";
  const ext = transparent ? "png" : format;

  async function build() {
    const cut = store.current.cutout;
    if (!cut || !src) throw new Error("Remove the background first.");
    const base = (src.file.name.replace(/\.[^.]+$/, "") || "photo") + (transparent ? "-no-bg" : "-new-bg");
    if (transparent) return { blob: await toBlob(cut, "image/png"), name: `${base}.png` };
    const out = makeCanvas(cut.width, cut.height);
    out.ctx.fillStyle = bgColour;
    out.ctx.fillRect(0, 0, cut.width, cut.height);
    out.ctx.drawImage(cut, 0, 0);
    const type = format === "jpg" ? "image/jpeg" : "image/png";
    const blob = await toBlob(out.c, type, format === "jpg" ? 0.92 : undefined);
    out.c.width = 0;
    return { blob, name: `${base}.${ext}` };
  }

  function report(outputType: string, bytesOut: number) {
    if (!src) return;
    trackEvent("download", tool.slug);
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ tool: tool.slug, inputType: src.file.type || "image", outputType, files: 1, bytesIn: src.file.size, bytesOut }),
    }).catch(() => {});
  }

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      await nextFrame();
      const { blob, name } = await build();
      saveBlob(blob, name);
      report(blob.type, blob.size);
      notify.success("Image downloaded", `${outSize?.w} × ${outSize?.h} px · ${formatBytes(blob.size)}`);
    } catch (err) {
      notify.error("Could not create the image", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  const working = phase === "model" || phase === "processing";
  const btnBase =
    "flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const pillOn = "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400";
  const pillOff = "surface text-muted hover:text-[var(--fg)]";

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
              void loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              void loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <p className="mb-4 flex items-start gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-400">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Works best for photos of people — portraits, selfies, passport and profile pictures. Products, animals and
            objects may not cut out cleanly.
          </p>

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
                  void loadFile(e.dataTransfer.files[0]);
                }}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Choose a photo"
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
                <p className="mt-4 font-bold">Drop a photo of a person, or tap to browse</p>
                <p className="mt-1 text-sm text-muted">JPG, PNG or WEBP — processed by AI in your browser, never uploaded</p>
              </div>
              <div className="mt-3 flex justify-center sm:hidden">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-2 rounded-2xl surface px-5 py-3 text-sm font-bold transition-colors hover:border-brand-400/60"
                >
                  <Camera className="h-4 w-4" /> Take a selfie
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              {/* ----------------------------- preview ----------------------------- */}
              <div className="min-w-0">
                <div
                  className="relative mx-auto overflow-hidden rounded-2xl shadow-xl"
                  style={{
                    aspectRatio: `${src.width} / ${src.height}`,
                    width: `min(100%, calc(62vh * ${src.width / src.height}))`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src.url} alt="Original photo" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
                  {preview && (
                    <div
                      className="absolute inset-0"
                      style={{
                        ...(transparent ? CHECKER : { backgroundColor: bgColour }),
                        clipPath: `inset(0 0 0 ${compare}%)`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="Photo with the background removed" draggable={false} className="h-full w-full select-none object-cover" />
                    </div>
                  )}
                  {preview && (
                    <>
                      <span
                        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                        style={{ left: `${compare}%` }}
                      />
                      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                        Before
                      </span>
                      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                        After
                      </span>
                    </>
                  )}
                  {working && (
                    <div className="absolute inset-0 grid place-items-center bg-black/45 p-4 text-center text-white backdrop-blur-[2px]" aria-live="polite">
                      <div className="w-full max-w-[260px]">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                        <p className="mt-3 text-sm font-bold">
                          {phase === "model" ? "Loading AI model (first time only)…" : "Removing background…"}
                        </p>
                        {phase === "model" && (
                          <>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                                animate={{ width: `${modelPct}%` }}
                                transition={{ duration: 0.25 }}
                              />
                            </div>
                            <p className="mt-1.5 text-xs opacity-80">
                              {modelPct}% of {MODELS[model].size} — cached for next time
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {preview && (
                  <div className="mx-auto mt-3 max-w-md">
                    <label htmlFor="bg-compare" className="mb-1 block text-center text-xs font-semibold text-muted">
                      Slide to compare before / after
                    </label>
                    <input
                      id="bg-compare"
                      type="range"
                      min={0}
                      max={100}
                      value={compare}
                      onChange={(e) => setCompare(Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                  </div>
                )}
              </div>

              {/* ----------------------------- controls ---------------------------- */}
              <div className="min-w-0 space-y-5">
                <div>
                  <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-brand-400" /> AI model
                  </span>
                  <div className="flex gap-2" role="radiogroup" aria-label="AI model">
                    {(Object.keys(MODELS) as ModelKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={model === k}
                        disabled={working}
                        onClick={() => changeModel(k)}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-60 ${model === k ? pillOn : pillOff}`}
                      >
                        {MODELS[k].label}
                        <span className="block font-normal opacity-75">{MODELS[k].size}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Best quality keeps hair edges cleaner; the light model is quicker on slow connections.</p>
                </div>

                <div>
                  <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Palette className="h-4 w-4 text-brand-400" /> New background
                  </span>
                  <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Background">
                    {BACKGROUNDS.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        role="radio"
                        aria-checked={bgKey === b.key}
                        onClick={() => setBgKey(b.key)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${bgKey === b.key ? pillOn : pillOff}`}
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-black/15"
                          style={b.value ? { backgroundColor: b.value } : { ...CHECKER, backgroundSize: "6px 6px", backgroundPosition: "0 0,0 3px,3px -3px,-3px 0" }}
                        />
                        {b.label}
                      </button>
                    ))}
                    <label className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${bgKey === "custom" ? pillOn : pillOff}`}>
                      <input
                        type="color"
                        value={customBg}
                        aria-label="Custom background colour"
                        onChange={(e) => {
                          setCustomBg(e.target.value);
                          setBgKey("custom");
                        }}
                        onClick={() => setBgKey("custom")}
                        className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                      />
                      Custom
                    </label>
                  </div>
                </div>

                {!transparent && (
                  <div>
                    <span className="mb-2 block text-sm font-semibold">Format</span>
                    <div className="flex gap-2">
                      {(["jpg", "png"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFormat(f)}
                          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                            format === f
                              ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                              : "bg-[var(--bg-soft)] text-muted hover:text-[var(--fg)]"
                          }`}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl surface p-4">
                  <p className="text-sm font-bold">{transparent ? "Transparent PNG" : `${format.toUpperCase()} with ${bgKey === "custom" ? "custom" : (BACKGROUNDS.find((b) => b.key === bgKey)?.label.toLowerCase() ?? "")} background`}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {outSize ? `${outSize.w} × ${outSize.h} px` : working ? "Working…" : "Remove the background first."}
                    {outSize && src && outSize.w < src.width ? " (scaled to fit phone memory)" : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={() => void download()}
                      disabled={phase !== "done" || busy}
                      whileHover={{ scale: phase === "done" && !busy ? 1.02 : 1 }}
                      whileTap={{ scale: 0.97 }}
                      className={`${btnBase} flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25`}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {busy ? "Creating…" : `Download ${ext.toUpperCase()}`}
                    </motion.button>
                    {phase === "done" && (
                      <ShareSheet
                        title="Photo with the background removed"
                        text="I removed a photo background for free with SnapGrab"
                        getFiles={async () => {
                          const { blob, name } = await build();
                          report(blob.type, blob.size);
                          return [blobToFile(blob, name)];
                        }}
                      />
                    )}
                  </div>
                </div>

                <Link
                  href="/tools/passport-photo-maker"
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline"
                >
                  Need a passport photo? Make one here <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={working}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> Another photo
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Start over
                  </button>
                </div>

                {phase === "done" && (
                  <p className="flex items-start gap-2 text-xs text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
                    Edges look rough or part of you is missing? Try the other AI model, or a photo with better light and a
                    plainer background.
                  </p>
                )}
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                {src && !working && (
                  <button type="button" onClick={() => void removeBackground(src, model)} className="ml-auto shrink-0 font-bold underline">
                    Retry
                  </button>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
            The AI runs in your browser — your photo is never uploaded. Only the AI model itself is downloaded (once) from
            Google&apos;s public model library.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
