"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Allura, Caveat, Dancing_Script, Great_Vibes, Sacramento, Satisfy } from "next/font/google";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Download,
  Eraser,
  ImageUp,
  Loader2,
  PenLine,
  Scale,
  ShieldCheck,
  Type,
  Undo2,
  UploadCloud,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * fonts — self-hosted by next/font, fetched only when this tool shows them
 * ------------------------------------------------------------------ */

const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const dancing = Dancing_Script({ subsets: ["latin"], display: "swap", preload: false });
const allura = Allura({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const satisfy = Satisfy({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const sacramento = Sacramento({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const caveat = Caveat({ subsets: ["latin"], display: "swap", preload: false });

const FONTS = [
  { key: "great-vibes", label: "Great Vibes", family: greatVibes.style.fontFamily, scale: 1 },
  { key: "dancing", label: "Dancing Script", family: dancing.style.fontFamily, scale: 0.9 },
  { key: "allura", label: "Allura", family: allura.style.fontFamily, scale: 1.1 },
  { key: "satisfy", label: "Satisfy", family: satisfy.style.fontFamily, scale: 0.9 },
  { key: "sacramento", label: "Sacramento", family: sacramento.style.fontFamily, scale: 1.15 },
  { key: "caveat", label: "Caveat", family: caveat.style.fontFamily, scale: 0.95 },
];

/* ------------------------------------------------------------------ *
 * constants
 * ------------------------------------------------------------------ */

type Mode = "draw" | "type" | "upload";
type InkKey = "black" | "blue";
type UploadInk = "original" | InkKey;

const INKS: Record<InkKey, { label: string; value: string; rgb: [number, number, number] }> = {
  black: { label: "Black", value: "#111111", rgb: [17, 17, 17] },
  blue: { label: "Blue", value: "#1c3f9e", rgb: [28, 63, 158] },
};

/** Logical drawing surface — strokes are stored in these units so the pad can resize freely. */
const PAD_W = 900;
const PAD_H = 400;
/** Export scale for drawn signatures (2700 × 1200 before trimming). */
const DRAW_EXPORT = 3;

type Pt = { x: number; y: number; w: number };
type Stroke = Pt[];

type Upload = { file: File; img: HTMLImageElement };

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
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  return { c, ctx };
}

function setPen(ctx: CanvasRenderingContext2D, colour: string) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** One quadratic segment around point i, from the previous midpoint to the next (or to the stroke's ends). */
function paintSegment(ctx: CanvasRenderingContext2D, s: Stroke, i: number, last: boolean, thickness: number, scale: number) {
  const p0 = i === 1 ? s[0] : mid(s[i - 1], s[i]);
  const p1 = s[i];
  const p2 = last ? s[i + 1] : mid(s[i], s[i + 1]);
  ctx.beginPath();
  ctx.lineWidth = Math.max(0.5, thickness * p1.w * scale);
  ctx.moveTo(p0.x * scale, p0.y * scale);
  ctx.quadraticCurveTo(p1.x * scale, p1.y * scale, p2.x * scale, p2.y * scale);
  ctx.stroke();
}

function paintDot(ctx: CanvasRenderingContext2D, p: Pt, thickness: number, scale: number) {
  ctx.beginPath();
  ctx.arc(p.x * scale, p.y * scale, Math.max(0.5, (thickness * p.w * scale) / 2), 0, Math.PI * 2);
  ctx.fill();
}

/** Smooth strokes: quadratic curves through the midpoints, each segment with its own width. */
function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], colour: string, thickness: number, scale: number) {
  setPen(ctx, colour);
  for (const s of strokes) {
    if (!s.length) continue;
    if (s.length < 3) {
      paintDot(ctx, s[0], thickness, scale); // a dot, e.g. over an "i"
      if (s.length === 2) paintDot(ctx, s[1], thickness, scale);
      continue;
    }
    for (let i = 1; i < s.length - 1; i++) paintSegment(ctx, s, i, i === s.length - 2, thickness, scale);
  }
}

/** Crops a transparent canvas to its ink, plus padding. Returns null when there's no ink. */
function trim(src: HTMLCanvasElement) {
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = src;
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = Math.max(12, Math.round(Math.max(x1 - x0, y1 - y0) * 0.05));
  const out = makeCanvas(x1 - x0 + 1 + pad * 2, y1 - y0 + 1 + pad * 2);
  out.ctx.drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return out.c;
}

/**
 * Lifts ink off a photo of paper. The paper brightness is estimated locally (a large box mean via an
 * integral image), so shadows and uneven light don't turn into grey smudges.
 */
function extractInk(img: HTMLImageElement, sensitivity: number, ink: UploadInk) {
  const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const { c, ctx } = makeCanvas(w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  const grey = new Float32Array(w * h);
  for (let i = 0, j = 0; j < grey.length; i += 4, j++) grey[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

  const W1 = w + 1;
  const integral = new Float64Array(W1 * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += grey[(y - 1) * w + (x - 1)];
      integral[y * W1 + x] = integral[(y - 1) * W1 + x] + row;
    }
  }
  const r = Math.max(10, Math.round(Math.max(w, h) / 12));
  // sensitivity 0–100 → how much darker than the paper a pixel must be to count as ink
  const lo = 70 - sensitivity * 0.6; // 70 … 10
  const hi = lo + 28;
  const forced = ink === "original" ? null : INKS[ink].rgb;

  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r);
    const yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r);
      const xb = Math.min(w, x + r + 1);
      const mean = (integral[yb * W1 + xb] - integral[ya * W1 + xb] - integral[yb * W1 + xa] + integral[ya * W1 + xa]) / ((xb - xa) * (yb - ya));
      const j = y * w + x;
      const dark = mean - grey[j];
      const t = Math.min(1, Math.max(0, (dark - lo) / (hi - lo)));
      const i = j * 4;
      if (forced) {
        px[i] = forced[0];
        px[i + 1] = forced[1];
        px[i + 2] = forced[2];
      } else if (t > 0) {
        // deepen the pen colour a little — photos wash ink out
        px[i] = px[i] * 0.8;
        px[i + 1] = px[i + 1] * 0.8;
        px[i + 2] = px[i + 2] * 0.8;
      }
      px[i + 3] = Math.round(t * t * (3 - 2 * t) * 255);
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ */

export default function SignatureStudio({ tool }: { tool: Tool }) {
  const [mode, setMode] = useState<Mode>("draw");
  const [ink, setInk] = useState<InkKey>("black");
  const [thickness, setThickness] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [name, setName] = useState("");
  const [fontKey, setFontKey] = useState(FONTS[0].key);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [sensitivity, setSensitivity] = useState(55);
  const [uploadInk, setUploadInk] = useState<UploadInk>("original");
  const [busy, setBusy] = useState<null | "png" | "jpg">(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const padRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const live = useRef<{ stroke: Stroke | null; id: number; last: { x: number; y: number; t: number } | null; painted: number }>({
    stroke: null,
    id: -1,
    last: null,
    painted: 1,
  });
  const processed = useRef<{ canvas: HTMLCanvasElement | null }>({ canvas: null });

  const colour = INKS[ink].value;
  const font = FONTS.find((f) => f.key === fontKey) ?? FONTS[0];

  /* ------------------------------ draw pad ------------------------------ */

  // (re)paint committed strokes whenever they, the pen or the pad size change
  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = padRef.current;
    if (!canvas) return;
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      paintStrokes(ctx, strokes, colour, thickness, w / PAD_W);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [mode, strokes, colour, thickness]);

  function padPoint(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * PAD_W, y: ((e.clientY - rect.top) / rect.height) * PAD_H };
  }

  function onPadDown(e: PointerEvent<HTMLCanvasElement>) {
    if (live.current.stroke) return; // ignore a second finger
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = padPoint(e);
    const w = e.pointerType === "pen" && e.pressure > 0 ? 0.5 + e.pressure : 1;
    live.current = { stroke: [{ ...p, w }], id: e.pointerId, last: { ...p, t: e.timeStamp }, painted: 1 };
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) paintStrokes(ctx, [[{ ...p, w }]], colour, thickness, e.currentTarget.width / PAD_W);
  }

  function onPadMove(e: PointerEvent<HTMLCanvasElement>) {
    const l = live.current;
    if (!l.stroke || l.id !== e.pointerId || !l.last) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const rect = e.currentTarget.getBoundingClientRect();
    const samples = events.length ? events : [e.nativeEvent];
    for (const ev of samples) {
      const p = { x: ((ev.clientX - rect.left) / rect.width) * PAD_W, y: ((ev.clientY - rect.top) / rect.height) * PAD_H };
      const dist = Math.hypot(p.x - l.last.x, p.y - l.last.y);
      if (dist < 1.2) continue;
      const dt = Math.max(1, ev.timeStamp - l.last.t);
      let w: number;
      if (ev.pointerType === "pen" && ev.pressure > 0) w = 0.45 + ev.pressure * 1.1;
      else {
        // faster strokes get thinner, like a real pen; ease toward the target to avoid blobs
        const target = Math.min(1.35, Math.max(0.5, 1.4 - (dist / dt) * 0.35));
        const prev = l.stroke[l.stroke.length - 1].w;
        w = prev + (target - prev) * 0.35;
      }
      l.stroke.push({ ...p, w });
      l.last = { ...p, t: ev.timeStamp };
    }
    // paint only the segments that became final since the last move; the full repaint on release tidies the end
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) {
      setPen(ctx, colour);
      const scale = e.currentTarget.width / PAD_W;
      for (; l.painted < l.stroke.length - 1; l.painted++) paintSegment(ctx, l.stroke, l.painted, false, thickness, scale);
    }
  }

  function onPadUp(e: PointerEvent<HTMLCanvasElement>) {
    const l = live.current;
    if (l.id !== e.pointerId || !l.stroke) return;
    const stroke = l.stroke;
    live.current = { stroke: null, id: -1, last: null, painted: 1 };
    setStrokes((prev) => [...prev, stroke]);
  }

  /* ----------------------------- upload mode ---------------------------- */

  async function loadUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
      setError("Please choose a photo (JPG, PNG, WEBP…).");
      notify.error("That isn't an image", "Take a photo of your signature on white paper.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setUpload({ file, img });
      setError(null);
    } catch {
      setError("Your browser could not open this image. Try a JPG or PNG.");
      notify.error("Could not open this image");
    } finally {
      // the decoded <img> keeps its pixels; the URL itself is no longer needed
      URL.revokeObjectURL(url);
    }
  }

  // re-extract the ink (debounced) when the photo or its settings change, and paint the preview
  useEffect(() => {
    if (mode !== "upload" || !upload) return;
    const holder = processed.current;
    const id = setTimeout(() => {
      try {
        const out = extractInk(upload.img, sensitivity, uploadInk);
        if (holder.canvas) holder.canvas.width = 0;
        holder.canvas = out;
        const view = previewRef.current;
        if (view) {
          view.width = out.width;
          view.height = out.height;
          view.getContext("2d")?.drawImage(out, 0, 0);
        }
      } catch {
        notify.error("Could not process this photo", "Try a smaller image.");
      }
    }, 120);
    return () => clearTimeout(id);
  }, [mode, upload, sensitivity, uploadInk]);

  /* ------------------------------- export ------------------------------- */

  async function inkCanvas(): Promise<HTMLCanvasElement | null> {
    if (mode === "draw") {
      if (!strokes.length) return null;
      const { c, ctx } = makeCanvas(PAD_W * DRAW_EXPORT, PAD_H * DRAW_EXPORT);
      paintStrokes(ctx, strokes, colour, thickness, DRAW_EXPORT);
      return c;
    }
    if (mode === "type") {
      const text = name.trim();
      if (!text) return null;
      const size = Math.round(180 * font.scale);
      const spec = `${size}px ${font.family}`;
      try {
        await document.fonts.load(spec, text);
      } catch {}
      const probe = makeCanvas(1, 1).ctx;
      probe.font = spec;
      const width = probe.measureText(text).width;
      const { c, ctx } = makeCanvas(width + size * 2, size * 2.6);
      ctx.font = spec;
      ctx.fillStyle = colour;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, size, size * 1.6);
      return c;
    }
    const src = processed.current.canvas;
    if (!src) return null;
    const { c, ctx } = makeCanvas(src.width, src.height);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  async function build(kind: "png" | "jpg") {
    const raw = await inkCanvas();
    const cut = raw ? trim(raw) : null;
    if (raw) raw.width = 0;
    if (!cut) {
      throw new Error(
        mode === "draw" ? "Draw your signature first." : mode === "type" ? "Type your name first." : "No ink was found — raise the sensitivity.",
      );
    }
    let out = cut;
    if (kind === "jpg") {
      const flat = makeCanvas(cut.width, cut.height);
      flat.ctx.fillStyle = "#ffffff";
      flat.ctx.fillRect(0, 0, cut.width, cut.height);
      flat.ctx.drawImage(cut, 0, 0);
      cut.width = 0;
      out = flat.c;
    }
    const blob = await toBlob(out, kind === "png" ? "image/png" : "image/jpeg", kind === "jpg" ? 0.95 : undefined);
    const size = { w: out.width, h: out.height };
    out.width = 0;
    return { blob, size, name: `signature-${mode}.${kind}` };
  }

  function report(outputType: string, bytesOut: number) {
    trackEvent("download", tool.slug);
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        tool: tool.slug,
        inputType: mode === "upload" ? upload?.file.type || "image" : mode,
        outputType,
        files: 1,
        bytesIn: mode === "upload" ? (upload?.file.size ?? 0) : 0,
        bytesOut,
      }),
    }).catch(() => {});
  }

  async function download(kind: "png" | "jpg") {
    if (busy) return;
    setBusy(kind);
    trackEvent("process", tool.slug);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const { blob, size, name: file } = await build(kind);
      saveBlob(blob, file);
      report(blob.type, blob.size);
      notify.success("Signature downloaded", `${size.w} × ${size.h} px · ${formatBytes(blob.size)}`);
    } catch (err) {
      notify.error("Could not create the signature", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const ready = mode === "draw" ? strokes.length > 0 : mode === "type" ? name.trim().length > 0 : !!upload;

  /* ------------------------------- render ------------------------------- */

  const btnBase =
    "flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const pillOn = "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400";
  const pillOff = "surface text-muted hover:text-[var(--fg)]";
  const tabs: { key: Mode; label: string; icon: typeof PenLine }[] = [
    { key: "draw", label: "Draw", icon: PenLine },
    { key: "type", label: "Type", icon: Type },
    { key: "upload", label: "Upload", icon: ImageUp },
  ];

  const inkPicker = (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Ink colour">
      {(Object.keys(INKS) as InkKey[]).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={ink === k}
          onClick={() => setInk(k)}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${ink === k ? pillOn : pillOff}`}
        >
          <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: INKS[k].value }} />
          {INKS[k].label}
        </button>
      ))}
    </div>
  );

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          {/* tabs */}
          <div className="flex gap-2 rounded-2xl bg-[var(--bg-soft)] p-1" role="tablist" aria-label="How to make your signature">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => {
                  setMode(t.key);
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                  mode === t.key
                    ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                    : "text-muted hover:text-[var(--fg)]"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {/* ------------------------------ draw ------------------------------ */}
            {mode === "draw" && (
              <div>
                <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
                  <canvas
                    ref={padRef}
                    onPointerDown={onPadDown}
                    onPointerMove={onPadMove}
                    onPointerUp={onPadUp}
                    onPointerCancel={onPadUp}
                    aria-label="Signature pad — draw your signature with a finger, stylus or mouse"
                    className="block w-full cursor-crosshair touch-none select-none"
                    style={{ aspectRatio: `${PAD_W} / ${PAD_H}` }}
                  />
                  <div className="pointer-events-none absolute inset-x-[8%] bottom-[22%] border-b border-dashed border-slate-300" />
                  {!strokes.length && (
                    <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm font-semibold text-slate-400">
                      Sign here
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="mb-2 block text-sm font-semibold">Pen colour</span>
                    {inkPicker}
                  </div>
                  <div>
                    <label htmlFor="sig-thick" className="mb-2 flex items-center justify-between text-sm font-semibold">
                      Thickness <span className="font-mono text-brand-400">{thickness}</span>
                    </label>
                    <input
                      id="sig-thick"
                      type="range"
                      min={1}
                      max={10}
                      value={thickness}
                      onChange={(e) => setThickness(Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStrokes((s) => s.slice(0, -1))}
                    disabled={!strokes.length}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50 sm:flex-none"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStrokes([])}
                    disabled={!strokes.length}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-red-400 disabled:opacity-50 sm:flex-none"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------ type ------------------------------ */}
            {mode === "type" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="sig-name" className="mb-1.5 block text-sm font-semibold">
                    Your name
                  </label>
                  <input
                    id="sig-name"
                    value={name}
                    maxLength={40}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ayesha Khan"
                    autoComplete="name"
                    className="w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400"
                  />
                </div>
                <div>
                  <span className="mb-2 block text-sm font-semibold">Style</span>
                  <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Signature style">
                    {FONTS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        role="radio"
                        aria-checked={fontKey === f.key}
                        onClick={() => setFontKey(f.key)}
                        className={`min-w-0 rounded-2xl bg-white px-3 py-3 text-left transition-all ${
                          fontKey === f.key ? "ring-2 ring-brand-400" : "ring-1 ring-[var(--line)] hover:ring-brand-400/60"
                        }`}
                      >
                        <span
                          className="block truncate leading-tight"
                          style={{ fontFamily: f.family, fontSize: `${30 * f.scale}px`, color: colour }}
                        >
                          {name.trim() || "Your Name"}
                        </span>
                        <span className="mt-1 block text-[11px] font-semibold text-slate-500">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-2 block text-sm font-semibold">Ink colour</span>
                  {inkPicker}
                </div>
              </div>
            )}

            {/* ----------------------------- upload ----------------------------- */}
            {mode === "upload" && (
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void loadUpload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {!upload ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      void loadUpload(e.dataTransfer.files[0]);
                    }}
                    onClick={() => inputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label="Choose a photo of your signature"
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
                    <p className="mt-4 font-bold">Upload a photo of your signature</p>
                    <p className="mt-1 text-sm text-muted">Sign on plain white paper, photograph it in good light — the paper is removed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className="grid place-items-center overflow-hidden rounded-2xl border border-[var(--line)] p-3"
                      style={{
                        backgroundColor: "#ffffff",
                        backgroundImage:
                          "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
                        backgroundSize: "16px 16px",
                        backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                      }}
                    >
                      <canvas ref={previewRef} className="block h-auto max-h-[280px] w-auto max-w-full" aria-label="Your signature with the paper removed" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="sig-sens" className="mb-2 flex items-center justify-between text-sm font-semibold">
                          Ink sensitivity <span className="font-mono text-brand-400">{sensitivity}</span>
                        </label>
                        <input
                          id="sig-sens"
                          type="range"
                          min={0}
                          max={100}
                          value={sensitivity}
                          onChange={(e) => setSensitivity(Number(e.target.value))}
                          className="w-full accent-[var(--color-brand-500)]"
                        />
                        <p className="mt-1 text-xs text-muted">Lower it if paper texture or shadows show; raise it if faint strokes vanish.</p>
                      </div>
                      <div>
                        <span className="mb-2 block text-sm font-semibold">Ink colour</span>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ink colour">
                          {(["original", "black", "blue"] as UploadInk[]).map((k) => (
                            <button
                              key={k}
                              type="button"
                              role="radio"
                              aria-checked={uploadInk === k}
                              onClick={() => setUploadInk(k)}
                              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${uploadInk === k ? pillOn : pillOff}`}
                            >
                              {k === "original" ? "Keep original" : `Make it ${INKS[k].label.toLowerCase()}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]"
                    >
                      <UploadCloud className="h-3.5 w-3.5" /> Use another photo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ------------------------------ output ------------------------------ */}
          <div className="mt-5 rounded-2xl surface p-4">
            <p className="text-sm font-bold">Your signature</p>
            <p className="mt-0.5 text-xs text-muted">
              Trimmed to the ink with a little padding. PNG keeps a transparent background for PDFs and documents; JPG is on white.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <motion.button
                type="button"
                onClick={() => void download("png")}
                disabled={!ready || !!busy}
                whileHover={{ scale: ready && !busy ? 1.02 : 1 }}
                whileTap={{ scale: 0.97 }}
                className={`${btnBase} flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25 sm:flex-none`}
              >
                {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Transparent PNG
              </motion.button>
              <button
                type="button"
                onClick={() => void download("jpg")}
                disabled={!ready || !!busy}
                className={`${btnBase} flex-1 bg-[var(--bg-soft)] hover:text-brand-400 sm:flex-none`}
              >
                {busy === "jpg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                JPG on white
              </button>
              {ready && (
                <ShareSheet
                  title="My signature"
                  text="Made with SnapGrab's free signature maker"
                  getFiles={async () => {
                    const { blob, name: file } = await build("png");
                    report(blob.type, blob.size);
                    return [blobToFile(blob, file)];
                  }}
                />
              )}
            </div>
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
            <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
            Only create and use your own signature. Copying someone else&apos;s signature is forgery, and some documents legally
            require a handwritten or certified digital signature.
          </p>
          <p className="mt-2 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
            Everything runs in your browser — your signature is never uploaded or stored.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
