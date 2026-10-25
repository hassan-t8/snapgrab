"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Crop,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  Maximize,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * presets & constants
 * ------------------------------------------------------------------ */

type PresetKey = "free" | "original" | "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "passport";

const PRESETS: { key: PresetKey; label: string; hint?: string; ratio: number | null }[] = [
  { key: "free", label: "Free", ratio: null },
  { key: "original", label: "Original", ratio: null },
  { key: "1:1", label: "1:1", hint: "Square / profile", ratio: 1 },
  { key: "4:5", label: "4:5", hint: "Instagram post", ratio: 4 / 5 },
  { key: "9:16", label: "9:16", hint: "Story / Reels / Status", ratio: 9 / 16 },
  { key: "16:9", label: "16:9", hint: "YouTube / widescreen", ratio: 16 / 9 },
  { key: "3:4", label: "3:4", hint: "Portrait print", ratio: 3 / 4 },
  { key: "passport", label: "35×45", hint: "Passport photo", ratio: 35 / 45 },
];

type Mime = "image/jpeg" | "image/png" | "image/webp";
const FORMATS: { mime: Mime; label: string; ext: string }[] = [
  { mime: "image/jpeg", label: "JPG", ext: "jpg" },
  { mime: "image/png", label: "PNG", ext: "png" },
  { mime: "image/webp", label: "WEBP", ext: "webp" },
];

/** iOS Safari refuses canvases above ~16.7 megapixels. */
const MAX_PIXELS = 16_000_000;
/** Resolution of the on-screen preview canvas. */
const PREVIEW_MAX = 1400;

type Source = { file: File; url: string; img: HTMLImageElement; width: number; height: number };
type Rect = { x: number; y: number; w: number; h: number };
type Rot = 0 | 90 | 180 | 270;
type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type Drag = { id: number; handle: Handle; sx: number; sy: number; c0: Rect; rect: DOMRect };

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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Size of the image after the 90° rotations ("base" coordinates for the crop box). */
const baseSize = (src: Source, rot: Rot) => (rot % 180 === 0 ? { bw: src.width, bh: src.height } : { bw: src.height, bh: src.width });

/** Largest centred box with the given ratio (or the whole image). */
function fitCrop(bw: number, bh: number, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, w: bw, h: bh };
  let w = bw;
  let h = bw / ratio;
  if (h > bh) {
    h = bh;
    w = bh * ratio;
  }
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

/**
 * Draws the source in base coordinates: 90° rotation, straighten (zoomed just enough that no empty
 * corners appear) and flips — the flip is outermost so a levelled horizon stays level when mirrored.
 */
function drawBase(ctx: CanvasRenderingContext2D, src: Source, rot: Rot, flipH: boolean, flipV: boolean, angle: number) {
  const { bw, bh } = baseSize(src, rot);
  const rad = (angle * Math.PI) / 180;
  const a = Math.abs(rad);
  const s = Math.cos(a) + Math.max(bw / bh, bh / bw) * Math.sin(a);
  ctx.translate(bw / 2, bh / 2);
  ctx.scale(flipH ? -s : s, flipV ? -s : s);
  ctx.rotate(rad);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.img, -src.width / 2, -src.height / 2, src.width, src.height);
}

/* ------------------------------------------------------------------ */

export default function CropStudio({ tool }: { tool: Tool }) {
  const [src, setSrc] = useState<Source | null>(null);
  const [rot, setRot] = useState<Rot>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [angle, setAngle] = useState(0);
  const [presetKey, setPresetKey] = useState<PresetKey>("free");
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const [mime, setMime] = useState<Mime>("image/jpeg");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    if (!src) return;
    const url = src.url;
    return () => URL.revokeObjectURL(url);
  }, [src]);

  const dims = src ? baseSize(src, rot) : { bw: 1, bh: 1 };
  const { bw, bh } = dims;
  const ratioOf = (key: PresetKey, w: number, h: number) =>
    key === "original" ? w / h : (PRESETS.find((p) => p.key === key)?.ratio ?? null);
  const ratio = ratioOf(presetKey, bw, bh);

  // paint the transformed image into the preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!src || !canvas) return;
    const { bw: w, bh: h } = baseSize(src, rot);
    const ps = Math.min(1, PREVIEW_MAX / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * ps));
    canvas.height = Math.max(1, Math.round(h * ps));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(canvas.width / w, canvas.height / h);
    drawBase(ctx, src, rot, flipH, flipV, angle);
  }, [src, rot, flipH, flipV, angle]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
      setError("Please choose an image (JPG, PNG, WEBP…).");
      notify.error("That isn't an image", "Choose a JPG, PNG or WEBP file.");
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const source = { file, url, img, width: img.naturalWidth, height: img.naturalHeight };
      setSrc(source);
      setRot(0);
      setFlipH(false);
      setFlipV(false);
      setAngle(0);
      setCrop(fitCrop(source.width, source.height, ratioOf(presetKey, source.width, source.height)));
      setMime(file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg");
      setError(null);
    } catch {
      URL.revokeObjectURL(url);
      setError("Your browser could not open this image. Try a JPG or PNG.");
      notify.error("Could not open this image", "HEIC photos may need converting to JPG first on some browsers.");
    } finally {
      setLoading(false);
    }
  }

  function choosePreset(key: PresetKey) {
    setPresetKey(key);
    if (key !== "free") setCrop(fitCrop(bw, bh, ratioOf(key, bw, bh)));
  }

  function rotate(dir: 1 | -1) {
    if (!src) return;
    const next = ((((rot + dir * 90) % 360) + 360) % 360) as Rot;
    setRot(next);
    const { bw: w, bh: h } = baseSize(src, next);
    setCrop(fitCrop(w, h, ratioOf(presetKey, w, h)));
  }

  function flip(axis: "h" | "v") {
    // mirror the crop box too, so it keeps framing the same part of the picture
    if (axis === "h") {
      setFlipH((v) => !v);
      setCrop((c) => ({ ...c, x: bw - c.x - c.w }));
    } else {
      setFlipV((v) => !v);
      setCrop((c) => ({ ...c, y: bh - c.y - c.h }));
    }
  }

  function resetAll() {
    if (!src) return;
    setRot(0);
    setFlipH(false);
    setFlipV(false);
    setAngle(0);
    setCrop(fitCrop(src.width, src.height, ratioOf(presetKey, src.width, src.height)));
  }

  function clearImage() {
    setSrc(null);
    setError(null);
  }

  /* --------------------------- crop interaction --------------------------- */

  const minSide = Math.max(bw, bh) * 0.04;

  function toBase(clientX: number, clientY: number, rect: DOMRect) {
    return { x: ((clientX - rect.left) / rect.width) * bw, y: ((clientY - rect.top) / rect.height) * bh };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!src || !stage || dragRef.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-handle]");
    if (!el) return;
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const p = toBase(e.clientX, e.clientY, rect);
    stage.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, handle: el.dataset.handle as Handle, sx: p.x, sy: p.y, c0: crop, rect };
    setActive(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toBase(e.clientX, e.clientY, d.rect);
    const { c0, handle } = d;

    if (handle === "move") {
      setCrop({ ...c0, x: clamp(c0.x + p.x - d.sx, 0, bw - c0.w), y: clamp(c0.y + p.y - d.sy, 0, bh - c0.h) });
      return;
    }

    const px = clamp(p.x, 0, bw);
    const py = clamp(p.y, 0, bh);
    let left = c0.x;
    let top = c0.y;
    let right = c0.x + c0.w;
    let bottom = c0.y + c0.h;

    if (!ratio) {
      if (handle.includes("w")) left = clamp(px, 0, right - minSide);
      if (handle.includes("e")) right = clamp(px, left + minSide, bw);
      if (handle.includes("n")) top = clamp(py, 0, bottom - minSide);
      if (handle.includes("s")) bottom = clamp(py, top + minSide, bh);
      setCrop({ x: left, y: top, w: right - left, h: bottom - top });
      return;
    }

    // aspect-locked: corners only, anchored on the opposite corner
    const dirX = handle.includes("w") ? -1 : 1;
    const dirY = handle.includes("n") ? -1 : 1;
    const ax = dirX > 0 ? left : right;
    const ay = dirY > 0 ? top : bottom;
    let w = Math.max(minSide, (px - ax) * dirX);
    let h = Math.max(minSide, (py - ay) * dirY);
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
    const availW = dirX > 0 ? bw - ax : ax;
    const availH = dirY > 0 ? bh - ay : ay;
    if (w > availW) {
      w = availW;
      h = w / ratio;
    }
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    setCrop({ x: dirX > 0 ? ax : ax - w, y: dirY > 0 ? ay : ay - h, w, h });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id !== e.pointerId) return;
    dragRef.current = null;
    setActive(false);
  }

  function onBoxKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = (e.shiftKey ? 0.05 : 0.01) * Math.max(bw, bh);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setCrop((c) => ({ ...c, x: clamp(c.x + m[0], 0, bw - c.w), y: clamp(c.y + m[1], 0, bh - c.h) }));
  }

  /* ------------------------------- export -------------------------------- */

  const cw = Math.max(1, Math.round(crop.w));
  const ch = Math.max(1, Math.round(crop.h));
  const outScale = Math.min(1, Math.sqrt(MAX_PIXELS / (cw * ch)));
  const ow = Math.max(1, Math.round(cw * outScale));
  const oh = Math.max(1, Math.round(ch * outScale));
  const fmt = FORMATS.find((f) => f.mime === mime) ?? FORMATS[0];
  const lossy = mime !== "image/png";

  async function build() {
    if (!src) throw new Error("Add an image first.");
    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff"; // JPG has no transparency
      ctx.fillRect(0, 0, ow, oh);
    }
    ctx.scale(ow / crop.w, oh / crop.h);
    ctx.translate(-crop.x, -crop.y);
    drawBase(ctx, src, rot, flipH, flipV, angle);
    const blob = await toBlob(canvas, mime, lossy ? quality / 100 : undefined);
    canvas.width = 0;
    // some browsers silently fall back to PNG for WEBP
    const ext = blob.type === mime ? fmt.ext : blob.type === "image/png" ? "png" : fmt.ext;
    const base = src.file.name.replace(/\.[^.]+$/, "") || "image";
    return { blob, name: `${base}-cropped-${ow}x${oh}.${ext}` };
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
    if (!src || busy) return;
    setBusy(true);
    trackEvent("process", tool.slug);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const { blob, name } = await build();
      saveBlob(blob, name);
      report(blob.type, blob.size);
      notify.success("Image downloaded", `${ow} × ${oh} px · ${formatBytes(blob.size)}`);
    } catch (err) {
      notify.error("Could not create the image", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------- render -------------------------------- */

  const btnBase =
    "flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const toolBtn =
    "flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2.5 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]";
  const handles: Handle[] = ratio ? ["nw", "ne", "sw", "se"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const handlePos: Record<Exclude<Handle, "move">, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
    sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  };

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

          {!src ? (
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
              aria-label="Choose an image"
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
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
              </motion.span>
              <p className="mt-4 font-bold">{loading ? "Opening image…" : "Drop an image to crop, or tap to browse"}</p>
              <p className="mt-1 text-sm text-muted">JPG, PNG or WEBP — edited in your browser, never uploaded</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              {/* ------------------------------ editor ------------------------------ */}
              <div className="min-w-0">
                <div
                  ref={stageRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="relative mx-auto touch-none select-none overflow-hidden rounded-xl bg-[var(--bg-soft)]"
                  style={{ aspectRatio: `${bw} / ${bh}`, width: `min(100%, calc(60vh * ${bw / bh}))` }}
                >
                  <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-label="Image preview" />
                  <div
                    data-handle="move"
                    role="application"
                    tabIndex={0}
                    aria-label={`Crop area, ${cw} by ${ch} pixels. Drag to move, drag the corners to resize, or use the arrow keys.`}
                    onKeyDown={onBoxKey}
                    className={`absolute cursor-move outline-none ring-brand-400 focus-visible:ring-2 ${active ? "" : "transition-[box-shadow]"}`}
                    style={{
                      left: `${(crop.x / bw) * 100}%`,
                      top: `${(crop.y / bh) * 100}%`,
                      width: `${(crop.w / bw) * 100}%`,
                      height: `${(crop.h / bh) * 100}%`,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                      border: "1.5px solid rgba(255,255,255,0.95)",
                    }}
                  >
                    {/* rule-of-thirds guides */}
                    <div className={`pointer-events-none absolute inset-0 transition-opacity ${active ? "opacity-100" : "opacity-50"}`}>
                      <span className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
                      <span className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
                      <span className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
                      <span className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
                    </div>
                    {handles.map((h) => (
                      <span
                        key={h}
                        data-handle={h}
                        aria-hidden="true"
                        className={`absolute grid h-9 w-9 place-items-center ${handlePos[h as Exclude<Handle, "move">]}`}
                      >
                        <span
                          className={`pointer-events-none block rounded-full border-2 border-brand-500 bg-white shadow ${
                            h.length === 2 ? "h-4 w-4" : "h-3 w-3"
                          }`}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <p className="mt-2 text-center text-xs text-muted">
                  Drag the box to move it · drag the {ratio ? "corners" : "corners or edges"} to resize
                </p>

                {/* rotate / flip */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button type="button" onClick={() => rotate(-1)} className={toolBtn}>
                    <RotateCcw className="h-4 w-4" /> Rotate left
                  </button>
                  <button type="button" onClick={() => rotate(1)} className={toolBtn}>
                    <RotateCw className="h-4 w-4" /> Rotate right
                  </button>
                  <button type="button" onClick={() => flip("h")} aria-pressed={flipH} className={`${toolBtn} ${flipH ? "!text-brand-400" : ""}`}>
                    <FlipHorizontal2 className="h-4 w-4" /> Flip horizontal
                  </button>
                  <button type="button" onClick={() => flip("v")} aria-pressed={flipV} className={`${toolBtn} ${flipV ? "!text-brand-400" : ""}`}>
                    <FlipVertical2 className="h-4 w-4" /> Flip vertical
                  </button>
                </div>

                <div className="mt-4">
                  <label htmlFor="crop-straighten" className="mb-2 flex items-center justify-between text-sm font-semibold">
                    Straighten
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-brand-400">
                        {angle > 0 ? "+" : ""}
                        {angle.toFixed(1)}°
                      </span>
                      {angle !== 0 && (
                        <button type="button" onClick={() => setAngle(0)} className="text-xs font-bold text-muted hover:text-[var(--fg)]">
                          Reset
                        </button>
                      )}
                    </span>
                  </label>
                  <input
                    id="crop-straighten"
                    type="range"
                    min={-15}
                    max={15}
                    step={0.1}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    onDoubleClick={() => setAngle(0)}
                    className="w-full accent-[var(--color-brand-500)]"
                  />
                  <p className="mt-1 text-xs text-muted">Zooms in slightly as you tilt so no empty corners appear.</p>
                </div>
              </div>

              {/* ----------------------------- controls ----------------------------- */}
              <div className="min-w-0 space-y-5">
                <div>
                  <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Crop className="h-4 w-4 text-brand-400" /> Aspect ratio
                  </span>
                  <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Aspect ratio">
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={presetKey === p.key}
                        title={p.hint}
                        onClick={() => choosePreset(p.key)}
                        className={`min-w-0 rounded-xl px-1 py-2 text-xs font-bold transition-all ${
                          presetKey === p.key ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400" : "surface text-muted hover:text-[var(--fg)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {PRESETS.find((p) => p.key === presetKey)?.hint ?? (presetKey === "free" ? "Any shape you like" : "Keeps the image's own proportions")}
                    {presetKey === "passport" && (
                      <>
                        {" "}
                        — for a print-ready photo with head guides and a print sheet, use the{" "}
                        <Link href="/tools/passport-photo-maker" className="font-semibold text-brand-400 hover:underline">
                          passport photo maker
                        </Link>
                        .
                      </>
                    )}
                  </p>
                  {presetKey === "free" && (
                    <button
                      type="button"
                      onClick={() => setCrop(fitCrop(bw, bh, null))}
                      className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted hover:text-[var(--fg)]"
                    >
                      <Maximize className="h-3.5 w-3.5" /> Select the whole image
                    </button>
                  )}
                </div>

                <div>
                  <span className="mb-2 block text-sm font-semibold">Format</span>
                  <div className="flex gap-2">
                    {FORMATS.map((f) => (
                      <button
                        key={f.mime}
                        type="button"
                        onClick={() => setMime(f.mime)}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                          mime === f.mime
                            ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                            : "surface text-muted hover:text-[var(--fg)]"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {lossy && (
                  <div>
                    <label htmlFor="crop-quality" className="mb-2 flex items-center justify-between text-sm font-semibold">
                      Quality <span className="font-mono text-brand-400">{quality}%</span>
                    </label>
                    <input
                      id="crop-quality"
                      type="range"
                      min={40}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                  </div>
                )}

                <div className="rounded-2xl surface p-4">
                  <p className="text-sm font-bold">
                    {ow} × {oh} px <span className="font-normal text-muted">· {fmt.label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    From a {src.width} × {src.height} px original
                    {outScale < 1 ? " — scaled down to stay within browser canvas limits" : ""}.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={() => void download()}
                      disabled={busy}
                      whileHover={{ scale: busy ? 1 : 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className={`${btnBase} flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25`}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {busy ? "Creating…" : `Download ${fmt.label}`}
                    </motion.button>
                    <ShareSheet
                      title="Cropped image"
                      text="Cropped for free with SnapGrab"
                      getFiles={async () => {
                        const { blob, name } = await build();
                        report(blob.type, blob.size);
                        return [blobToFile(blob, name)];
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={resetAll} className={toolBtn}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset edits
                  </button>
                  <button type="button" onClick={() => inputRef.current?.click()} className={toolBtn}>
                    <UploadCloud className="h-3.5 w-3.5" /> Change image
                  </button>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2.5 text-xs font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
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
              </motion.p>
            )}
          </AnimatePresence>

          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
            Your image is cropped, rotated and saved locally in your browser — nothing is uploaded.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
