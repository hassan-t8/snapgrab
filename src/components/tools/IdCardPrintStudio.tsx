"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  FileText,
  Images,
  Info,
  Loader2,
  Lock,
  Minus,
  Move,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  UploadCloud,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { trackEvent } from "@/lib/track-event";
import {
  DPI,
  PAPERS,
  PAPER_MAP,
  PRINT_TIPS,
  drawCropMarks,
  drawCutLine,
  mmToPx,
  pagesToPdf,
  paperCanvas,
  printPages,
  type Paper,
  type PrintPage,
} from "@/lib/print";

/* ------------------------------------------------------------------ *
 * constants & types
 * ------------------------------------------------------------------ */

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";
const btnBase =
  "flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50";
const primary = "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25";
const secondary = "bg-[var(--bg-soft)] hover:text-brand-400";
const chipOn = "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400";
const chipOff = "bg-[var(--bg-soft)] text-muted hover:text-[var(--fg)]";

/** ISO/IEC 7810 ID-1 (CR80): bank cards, Pakistani CNIC, most driving licences and office cards. */
const ID1 = { w: 85.6, h: 53.98 };
/** corner radius of an ID-1 card (3.18 mm) as a fraction of its short side */
const RADIUS = 3.18 / 53.98;
/** room to cut between cards */
const GAP_MM = 4;
/** between the front and the back of one copy when both are on the same page */
const PAIR_GAP_MM = 4;
const marginFor = (p: Paper) => (Math.min(p.w, p.h) <= 130 ? 3 : 6);
/** phone photos are downscaled to this on load — far more than a card needs at 300 DPI, much less memory */
const MAX_SIDE = 3200;
/** in the crop editor the card frame takes 80 % of the stage, so you can see what lies around it */
const FRAME = 0.8;
const INSET = (1 - FRAME) / 2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;
const CALIB_KEY = "sg-duplex-calibration";
/** where the test crosshair sits on the front of the test page (mm from the top-left corner) */
const TEST_SPOT = { x: 42, y: 72 };

/** px per mm at 300 DPI, and the unrounded 300-DPI position of a millimetre value */
const DPMM = DPI / 25.4;
const P = (mm: number) => mm * DPMM;

type Side = "front" | "back";
type View = { zoom: number; fx: number; fy: number; rot: number; tilt: number };
const DEFAULT_VIEW: View = { zoom: 1, fx: 0, fy: 0, rot: 0, tilt: 0 };
type Source = { file: File; url: string; img: HTMLImageElement; width: number; height: number };

type Mode = "same-page" | "duplex" | "manual";
type Flip = "long" | "short";
type Guides = "none" | "cut" | "marks";
type CopiesPick = "1" | "2" | "4" | "8" | "fill";
type SizeKey = "id1" | "big" | "custom";
type Arrange = "auto" | "stack" | "side";
type Busy = null | "print" | "front" | "back" | "pdf" | "images" | "test" | "test1" | "test2";

type Calib = { rotateBack: boolean; dx: number; dy: number; turnOver: boolean; tested: boolean };
type CalibStore = { flip: Flip; duplex: Calib; manual: Calib };
const BLANK_CALIB: Calib = { rotateBack: false, dx: 0, dy: 0, turnOver: false, tested: false };
const DEFAULT_STORE: CalibStore = { flip: "long", duplex: BLANK_CALIB, manual: BLANK_CALIB };

const GUIDES: { key: Guides; label: string }[] = [
  { key: "cut", label: "Cut lines" },
  { key: "marks", label: "Crop marks" },
  { key: "none", label: "None" },
];

const COPIES: { key: CopiesPick; label: string }[] = [
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "4", label: "4" },
  { key: "8", label: "8" },
  { key: "fill", label: "Fill page" },
];

const MODES: { key: Mode; title: string; body: string }[] = [
  {
    key: "same-page",
    title: "Both sides on one page",
    body: "Front and back next to each other on one sheet — the usual CNIC copy for forms and applications.",
  },
  {
    key: "duplex",
    title: "Double-sided printer",
    body: "Your printer prints both sides by itself. Page 2 is placed so every back lands right behind its front.",
  },
  {
    key: "manual",
    title: "Single-sided printer",
    body: "Print the fronts, put the same sheet back in, then print the backs. We guide you step by step.",
  },
];

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clampOffset = (n: number) => (Number.isFinite(n) ? Math.round(clamp(n, -5, 5) * 2) / 2 : 0);
const isHeic = (f: File) => /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

function readCalib(): CalibStore {
  try {
    const raw = window.localStorage.getItem(CALIB_KEY);
    if (!raw) return DEFAULT_STORE;
    const v = JSON.parse(raw) as Partial<Record<keyof CalibStore, unknown>> | null;
    const fix = (c: unknown): Calib => {
      const o = (c && typeof c === "object" ? c : {}) as Partial<Calib>;
      return {
        rotateBack: o.rotateBack === true,
        dx: clampOffset(Number(o.dx)),
        dy: clampOffset(Number(o.dy)),
        turnOver: o.turnOver === true,
        tested: o.tested === true,
      };
    };
    return { flip: v?.flip === "short" ? "short" : "long", duplex: fix(v?.duplex), manual: fix(v?.manual) };
  } catch {
    return DEFAULT_STORE;
  }
}

function writeCalib(store: CalibStore) {
  try {
    window.localStorage.setItem(CALIB_KEY, JSON.stringify(store));
  } catch {
    // private mode / storage full: the setting simply lasts for this visit
  }
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

/** Opens a photo; very large camera photos are scaled down first so two of them never exhaust a phone's memory. */
async function readImage(file: File): Promise<Source> {
  let url = URL.createObjectURL(file);
  try {
    let img = await loadImage(url);
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    if (long > MAX_SIDE) {
      const k = MAX_SIDE / long;
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const blob = await toBlob(c, "image/jpeg", 0.93);
        c.width = 0;
        URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        img = await loadImage(url);
      }
    }
    return { file, url, img, width: img.naturalWidth, height: img.naturalHeight };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Where the photo sits inside a W × H (mm) card frame. `cx/cy` is the photo centre, `dw/dh` its
 * unrotated size, `angle` its rotation about that centre. Shared by the editor (CSS) and the export (canvas).
 */
function placement(src: { width: number; height: number }, W: number, H: number, v: View) {
  const angle = ((v.rot * 90 + v.tilt) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const scale = Math.max(W / (src.width * c + src.height * s), H / (src.width * s + src.height * c)) * v.zoom;
  return { angle, cx: W / 2 + v.fx * W, cy: H / 2 + v.fy * H, dw: src.width * scale, dh: src.height * scale };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** SVG path of a rounded rectangle (clockwise). */
function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
}

function grayscale(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = l;
  }
  ctx.putImageData(data, 0, 0);
}

/** One side of the card as its own canvas (k = px per mm). Without a photo it is a labelled placeholder. */
function renderCard(src: Source | null, view: View, w: number, h: number, k: number, opts: { round: boolean; gray: boolean; label: string }) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create images.");
  const sx = c.width / w;
  const sy = c.height / h;
  if (opts.round) {
    roundRect(ctx, 0, 0, c.width, c.height, Math.min(w, h) * RADIUS * sx);
    ctx.clip();
  }
  ctx.fillStyle = src ? "#ffffff" : "#e8edf3";
  ctx.fillRect(0, 0, c.width, c.height);
  if (src) {
    const p = placement(src, w, h, view);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(p.cx * sx, p.cy * sy);
    ctx.rotate(p.angle);
    ctx.drawImage(src.img, (-p.dw * sx) / 2, (-p.dh * sy) / 2, p.dw * sx, p.dh * sy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts.gray) grayscale(c);
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = `bold ${Math.round(c.height * 0.2)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.label, c.width / 2, c.height / 2);
  }
  return c;
}

/* ----------------------------- page layout ----------------------------- */

type Slot = { x: number; y: number; side: Side; turned?: boolean };
type Layout = {
  landscape: boolean;
  wMm: number;
  hMm: number;
  /** page 1: everything (same-page mode) or the fronts */
  page1: Slot[];
  /** page 2 (two-sided modes): the backs, in page-2 coordinates *before* printer calibration */
  page2: Slot[];
  capacity: number;
  count: number;
};

function gridFit(W: number, H: number, uw: number, uh: number, margin: number) {
  const cols = Math.max(0, Math.floor((W - 2 * margin + GAP_MM + 1e-6) / (uw + GAP_MM)));
  const rows = Math.max(0, Math.floor((H - 2 * margin + GAP_MM + 1e-6) / (uh + GAP_MM)));
  return { cols, rows, cap: cols * rows };
}

/** Top-left corners of n units in a balanced block centred on a W × H page. */
function centredBlock(n: number, maxCols: number, uw: number, uh: number, W: number, H: number) {
  if (n < 1 || maxCols < 1) return [];
  const rows = Math.ceil(n / maxCols);
  const cols = Math.ceil(n / rows);
  const x0 = (W - (cols * uw + (cols - 1) * GAP_MM)) / 2;
  const y0 = (H - (rows * uh + (rows - 1) * GAP_MM)) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + (i % cols) * (uw + GAP_MM), y: y0 + Math.floor(i / cols) * (uh + GAP_MM) }));
}

/**
 * Where the back of a card must be printed so that it lands exactly behind its front.
 *
 * Both pages use their own upright coordinates: mm from the top-left corner of that side of the sheet,
 * looking at it the right way up. Two-sided printing always uses a portrait sheet (pageW < pageH), so:
 *
 * - Flip on long edge — the sheet turns over like a book page (around its vertical axis). Left and right
 *   swap, top stays top:  x_back = pageW − x − w,  y_back = y.
 *   Check (A4, 85.6 mm card): a front at x = 6 (touching the left margin) → x_back = 210 − 6 − 85.6 = 118.4,
 *   whose right edge is 118.4 + 85.6 = 204 = 210 − 6, i.e. touching the right margin — the same strip of paper
 *   seen from behind. A centred block stays centred, cards only swap columns.
 *
 * - Flip on short edge — the sheet turns over like a notepad (around its horizontal axis). Top and bottom
 *   swap, left/right stay:  x_back = x,  y_back = pageH − y − h.
 *   Seen this way the back of a real card would be upside down (cards turn over sideways), so each back is
 *   also turned 180° inside its slot; once cut out, the copy turns over exactly like the original card.
 *
 * Printer quirks are applied afterwards to the whole page (see withBackCalibration).
 */
function mirrorSlot(s: { x: number; y: number }, w: number, h: number, pageW: number, pageH: number, flip: Flip): Slot {
  return flip === "long"
    ? { x: pageW - s.x - w, y: s.y, side: "back" }
    : { x: s.x, y: pageH - s.y - h, side: "back", turned: true };
}

function mirrorPoint(p: { x: number; y: number }, pageW: number, pageH: number, flip: Flip) {
  return flip === "long" ? { x: pageW - p.x, y: p.y } : { x: p.x, y: pageH - p.y };
}

function computeLayout(
  paper: Paper,
  cw: number,
  ch: number,
  mode: Mode,
  want: number | "fill",
  arrange: Arrange,
  hasBack: boolean,
  flip: Flip,
): Layout {
  const margin = marginFor(paper);

  if (mode === "same-page") {
    type Shape = "stack" | "side" | "single";
    const shapes: Shape[] = !hasBack ? ["single"] : arrange === "stack" ? ["stack"] : arrange === "side" ? ["side"] : ["stack", "side"];
    const unit = (s: Shape): [number, number] =>
      s === "stack" ? [cw, 2 * ch + PAIR_GAP_MM] : s === "side" ? [2 * cw + PAIR_GAP_MM, ch] : [cw, ch];
    // order of preference: portrait page first; front above back on portrait, side by side on landscape
    const cands = [false, true].flatMap((landscape) =>
      (landscape ? [...shapes].reverse() : shapes).map((shape) => {
        const W = landscape ? paper.h : paper.w;
        const H = landscape ? paper.w : paper.h;
        const [uw, uh] = unit(shape);
        return { landscape, shape, W, H, uw, uh, ...gridFit(W, H, uw, uh, margin) };
      }),
    );
    const max = Math.max(0, ...cands.map((c) => c.cap));
    const n = want === "fill" ? max : want;
    const pick = cands.find((c) => c.cap > 0 && c.cap >= n) ?? cands.find((c) => c.cap === max) ?? cands[0];
    const count = Math.min(n, pick.cap);
    const page1 = centredBlock(count, pick.cols, pick.uw, pick.uh, pick.W, pick.H).flatMap((u): Slot[] =>
      pick.shape === "stack"
        ? [
            { x: u.x, y: u.y, side: "front" },
            { x: u.x, y: u.y + ch + PAIR_GAP_MM, side: "back" },
          ]
        : pick.shape === "side"
          ? [
              { x: u.x, y: u.y, side: "front" },
              { x: u.x + cw + PAIR_GAP_MM, y: u.y, side: "back" },
            ]
          : [{ x: u.x, y: u.y, side: "front" }],
    );
    return { landscape: pick.landscape, wMm: pick.W, hMm: pick.H, page1, page2: [], capacity: max, count };
  }

  // two-sided: always a portrait sheet, so "long edge" is unambiguously the left/right edge (see mirrorSlot)
  const W = paper.w;
  const H = paper.h;
  const g = gridFit(W, H, cw, ch, margin);
  const n = want === "fill" ? g.cap : want;
  const count = Math.min(n, g.cap);
  const fronts = centredBlock(count, g.cols, cw, ch, W, H);
  return {
    landscape: false,
    wMm: W,
    hMm: H,
    page1: fronts.map((p) => ({ ...p, side: "front" as const })),
    page2: fronts.map((p) => mirrorSlot(p, cw, ch, W, H, flip)),
    capacity: g.cap,
    count,
  };
}

type Cards = Record<Side, HTMLCanvasElement | null>;

/** Draws card slots in 300-DPI page pixels (the preview uses the same call on a scaled canvas). */
function drawSlots(ctx: CanvasRenderingContext2D, slots: Slot[], cards: Cards, cw: number, ch: number, guides: Guides) {
  const w = Math.round(P(cw));
  const h = Math.round(P(ch));
  const rects = slots.map((s) => ({ ...s, X: Math.round(P(s.x)), Y: Math.round(P(s.y)) }));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // crop marks go underneath: wherever one would run into a neighbouring card, the card covers it
  if (guides === "marks") rects.forEach((r) => drawCropMarks(ctx, r.X, r.Y, w, h));
  for (const r of rects) {
    const card = cards[r.side];
    if (!card) continue;
    if (r.turned) {
      ctx.save();
      ctx.translate(r.X + w, r.Y + h);
      ctx.rotate(Math.PI);
      ctx.drawImage(card, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(card, r.X, r.Y, w, h);
    }
  }
  if (guides === "cut") rects.forEach((r) => drawCutLine(ctx, r.X, r.Y, w, h));
}

/**
 * Printer calibration for page 2. `draw` paints the page in its upright coordinates (as you look at the
 * back of the sheet). The nudge (dx, dy) is applied in those same coordinates, so "+1 mm X" always means
 * "1 mm further right as you look at the back". If the printer feeds the second side upside down, the whole
 * page is turned 180° about its centre: (x, y) → (pageW − x, pageH − y).
 */
function withBackCalibration(ctx: CanvasRenderingContext2D, wMm: number, hMm: number, calib: Calib, draw: () => void) {
  ctx.save();
  if (calib.rotateBack) {
    ctx.translate(P(wMm), P(hMm));
    ctx.rotate(Math.PI);
  }
  ctx.translate(P(calib.dx), P(calib.dy));
  draw();
  ctx.restore();
}

/** Test sheet: a big page number with an "up" arrow, and a crosshair at a known spot. */
function drawTestPage(ctx: CanvasRenderingContext2D, wMm: number, n: 1 | 2, spot: { x: number; y: number }, scale: number) {
  // laid out for A4 and shrunk for smaller paper
  const S = (mm: number) => mm * DPMM * scale;
  const cx = P(wMm / 2);
  ctx.save();
  ctx.fillStyle = n === 1 ? "#1d4ed8" : "#047857";
  ctx.strokeStyle = ctx.fillStyle;
  // arrow pointing to the top edge
  const top = S(18);
  const aw = S(26);
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx + aw / 2, top + S(22));
  ctx.lineTo(cx + aw / 5, top + S(22));
  ctx.lineTo(cx + aw / 5, top + S(48));
  ctx.lineTo(cx - aw / 5, top + S(48));
  ctx.lineTo(cx - aw / 5, top + S(22));
  ctx.lineTo(cx - aw / 2, top + S(22));
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold ${Math.round(S(12))}px system-ui, sans-serif`;
  ctx.fillText("TOP", cx, top + S(62));
  ctx.font = `bold ${Math.round(S(70))}px system-ui, sans-serif`;
  ctx.fillText(String(n), cx, top + S(132));
  ctx.font = `${Math.round(S(5))}px system-ui, sans-serif`;
  ctx.fillStyle = "#334155";
  const lines =
    n === 1
      ? ["SnapGrab printer test — page 1 (front)", "Keep this side up. The arrow shows the top edge of the sheet."]
      : ["SnapGrab printer test — page 2 (back)", "Hold the sheet up to a light: this crosshair should sit", "exactly behind the crosshair of page 1."];
  lines.forEach((l, i) => ctx.fillText(l, cx, top + S(150 + i * 8)));

  // crosshair (spot is already in real mm)
  const x = spot.x * DPMM;
  const y = spot.y * DPMM;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = S(0.3);
  ctx.beginPath();
  ctx.moveTo(x - S(14), y);
  ctx.lineTo(x + S(14), y);
  ctx.moveTo(x, y - S(14));
  ctx.lineTo(x, y + S(14));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, S(6), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, S(1), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A small on-screen canvas that accepts the same 300-DPI coordinates as the real page. */
function previewContext(canvas: HTMLCanvasElement, wMm: number, hMm: number, cssW: number) {
  const fullW = mmToPx(wMm);
  const fullH = mmToPx(hMm);
  const k = Math.min(1, (cssW * Math.min(2, window.devicePixelRatio || 1)) / fullW);
  canvas.width = Math.max(1, Math.round(fullW * k));
  canvas.height = Math.max(1, Math.round(fullH * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, fullW, fullH);
  return ctx;
}

const pause = () => new Promise((r) => setTimeout(r, 0)); // let a spinner paint before heavy canvas work

/* ------------------------------------------------------------------ *
 * small presentational pieces
 * ------------------------------------------------------------------ */

function ModeDiagram({ mode }: { mode: Mode }) {
  const sheet = "fill-[var(--bg-soft)] stroke-current";
  if (mode === "same-page")
    return (
      <svg viewBox="0 0 64 56" className="h-14 w-16 shrink-0 text-muted" aria-hidden="true">
        <rect x="14" y="3" width="36" height="50" rx="2" className={sheet} strokeWidth="1.5" />
        <rect x="20" y="10" width="24" height="15" rx="2" className="fill-brand-500/70" />
        <rect x="20" y="29" width="24" height="15" rx="2" className="fill-accent-500/70" />
        <text x="32" y="20.5" textAnchor="middle" className="fill-white text-[8px] font-bold">F</text>
        <text x="32" y="39.5" textAnchor="middle" className="fill-white text-[8px] font-bold">B</text>
      </svg>
    );
  return (
    <svg viewBox="0 0 64 56" className="h-14 w-16 shrink-0 text-muted" aria-hidden="true">
      <rect x="22" y="9" width="30" height="42" rx="2" className={sheet} strokeWidth="1.5" strokeDasharray="3 2" />
      <rect x="27" y="22" width="20" height="12" rx="2" className="fill-accent-500/70" />
      <text x="37" y="30.5" textAnchor="middle" className="fill-white text-[7px] font-bold">B</text>
      <rect x="6" y="4" width="30" height="42" rx="2" className={sheet} strokeWidth="1.5" />
      <rect x="11" y="17" width="20" height="12" rx="2" className="fill-brand-500/70" />
      <text x="21" y="25.5" textAnchor="middle" className="fill-white text-[7px] font-bold">F</text>
      {mode === "duplex" ? (
        <path d="M40 4 q12 0 14 12" className="fill-none stroke-brand-400" strokeWidth="1.8" markerEnd={`url(#ida-${mode})`} />
      ) : (
        <>
          <path d="M28 50 q14 6 26 -4" className="fill-none stroke-brand-400" strokeWidth="1.8" markerEnd={`url(#ida-${mode})`} />
          <circle cx="56" cy="10" r="5" className="fill-brand-500/20 stroke-brand-400" strokeWidth="1.2" />
          <text x="56" y="12.5" textAnchor="middle" className="fill-brand-400 text-[7px] font-bold">2</text>
        </>
      )}
      <defs>
        <marker id={`ida-${mode}`} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L6 3L0 6Z" className="fill-brand-400" />
        </marker>
      </defs>
    </svg>
  );
}

/** Step 2 of the manual flip: mark the top, turn the sheet over like a book page, load it again. */
function FlipIllustration() {
  return (
    <svg viewBox="0 0 330 120" className="h-auto w-full max-w-[460px] text-muted" role="img" aria-labelledby="flip-ill-title">
      <title id="flip-ill-title">
        Mark the top edge, turn the sheet over from left to right like a book page with the top edge still at the top, then load it again.
      </title>
      <defs>
        <marker id="flipa" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L6 3L0 6Z" className="fill-brand-400" />
        </marker>
      </defs>
      {/* 1. mark the top edge */}
      <rect x="20" y="16" width="62" height="86" rx="3" className="fill-[var(--bg-soft)] stroke-current" strokeWidth="1.5" />
      <rect x="30" y="34" width="42" height="26" rx="3" className="fill-brand-500/70" />
      <text x="51" y="51" textAnchor="middle" className="fill-white text-[11px] font-bold">1</text>
      <path d="M46 20 l10 0" className="stroke-red-500" strokeWidth="3" strokeLinecap="round" />
      <text x="51" y="12" textAnchor="middle" className="fill-current text-[9px] font-semibold">mark the top</text>
      <text x="51" y="115" textAnchor="middle" className="fill-current text-[9px]">printed side up</text>

      {/* 2. turn it over like a book page */}
      <path d="M96 58 q18 -26 36 0" className="fill-none stroke-brand-400" strokeWidth="2" markerEnd="url(#flipa)" />
      <rect x="140" y="16" width="62" height="86" rx="3" className="fill-[var(--bg)] stroke-current" strokeWidth="1.5" />
      <path d="M166 20 l10 0" className="stroke-red-500/60" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 2" />
      <text x="171" y="62" textAnchor="middle" className="fill-current text-[9px]">blank side</text>
      <text x="171" y="12" textAnchor="middle" className="fill-current text-[9px] font-semibold">top still at top</text>
      <text x="171" y="115" textAnchor="middle" className="fill-current text-[9px]">left ↔ right, like a book</text>

      {/* 3. load it, marked edge first */}
      <path d="M216 58 h22" className="fill-none stroke-brand-400" strokeWidth="2" markerEnd="url(#flipa)" />
      <rect x="250" y="56" width="64" height="34" rx="5" className="fill-[var(--bg-soft)] stroke-current" strokeWidth="1.5" />
      <rect x="258" y="22" width="48" height="40" rx="2" className="fill-[var(--bg)] stroke-current" strokeWidth="1.2" />
      <path d="M270 26 l10 0" className="stroke-red-500" strokeWidth="3" strokeLinecap="round" />
      <path d="M282 10 v12" className="stroke-brand-400" strokeWidth="2" markerEnd="url(#flipa)" />
      <text x="282" y="104" textAnchor="middle" className="fill-current text-[9px]">same edge goes in first</text>
    </svg>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  cols = 3,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold transition-all sm:text-sm ${value === o.key ? chipOn : chipOff}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--color-brand-500)]" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Nudge({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center justify-between text-xs font-semibold">
        {label} <span className="font-mono text-brand-400">{value > 0 ? "+" : ""}{value.toFixed(1)} mm</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label}: minus 0.5 mm`}
          onClick={() => onChange(clampOffset(value - 0.5))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl surface text-muted hover:text-[var(--fg)]"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          id={id}
          type="range"
          min={-5}
          max={5}
          step={0.5}
          value={value}
          onChange={(e) => onChange(clampOffset(Number(e.target.value)))}
          className="w-full accent-[var(--color-brand-500)]"
        />
        <button
          type="button"
          aria-label={`${label}: plus 0.5 mm`}
          onClick={() => onChange(clampOffset(value + 0.5))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl surface text-muted hover:text-[var(--fg)]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * crop editor for one side of the card
 * ------------------------------------------------------------------ */

function CardSideEditor({
  side,
  src,
  view,
  setView,
  cw,
  ch,
  loading,
  onFile,
  onRemove,
}: {
  side: Side;
  src: Source | null;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  cw: number;
  ch: number;
  loading: boolean;
  onFile: (f: File | undefined) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: View; last: View; x: number; y: number; dist: number; w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);
  const name = side === "front" ? "Front" : "Back";

  const sw = cw / FRAME;
  const sh = ch / FRAME;
  const fx0 = sw * INSET;
  const fy0 = sh * INSET;
  const radius = Math.min(cw, ch) * RADIUS;
  const frameRect = roundRectPath(fx0, fy0, cw, ch, radius);
  const place = src ? placement(src, cw, ch, view) : null;

  function begin(v: View) {
    const el = stageRef.current;
    const pts = [...pointers.current.values()];
    if (!el || !pts.length) {
      gesture.current = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { start: v, last: v, x, y, dist, w: rect.width * FRAME, h: rect.height * FRAME };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    begin(gesture.current?.last ?? view);
    setPanning(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let zoom = g.start.zoom;
    if (pts.length > 1 && g.dist > 0) zoom = clamp(g.start.zoom * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist), MIN_ZOOM, MAX_ZOOM);
    const next = { ...g.start, zoom, fx: clamp(g.start.fx + (x - g.x) / g.w, -2, 2), fy: clamp(g.start.fy + (y - g.y) / g.h, -2, 2) };
    g.last = next;
    setView(next);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(e.pointerId)) return;
    const last = gesture.current?.last ?? view;
    begin(last); // carry on with the remaining finger, if any
    if (!pointers.current.size) setPanning(false);
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!src) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => ({ ...v, fx: clamp(v.fx + dx, -2, 2), fy: clamp(v.fy + dy, -2, 2) }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clamp(v.zoom * 1.05, MIN_ZOOM, MAX_ZOOM) }));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clamp(v.zoom / 1.05, MIN_ZOOM, MAX_ZOOM) }));
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      setView((v) => ({ ...v, rot: (v.rot + (e.shiftKey ? 3 : 1)) % 4 }));
    }
  }

  const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-xl surface text-muted transition-colors hover:text-[var(--fg)]";
  const smallBtn =
    "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]";

  return (
    <div className="min-w-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
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
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="mb-2 flex items-center justify-between text-sm font-bold">
        <span>
          {name} side{side === "back" && <span className="ml-1 text-xs font-normal text-muted">(optional for one-sided cards)</span>}
        </span>
        {src && <Check className="h-4 w-4 text-accent-400" aria-label="added" />}
      </p>

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
            onFile(e.dataTransfer.files[0]);
          }}
          className={`grid place-items-center rounded-2xl border-2 border-dashed p-3 text-center transition-all ${
            dragging ? "border-brand-400 bg-brand-500/10" : "border-[var(--line)]"
          }`}
          style={{ aspectRatio: `${sw} / ${sh}` }}
        >
          <div>
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
            </span>
            <p className="mt-2 text-sm font-bold">{loading ? "Opening photo…" : `Add the ${name.toUpperCase()} of the card`}</p>
            <p className="mt-0.5 hidden text-xs text-muted sm:block">Drop a photo or scan here</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                className="flex min-h-10 items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold hover:border-brand-400/60"
              >
                <UploadCloud className="h-4 w-4" /> Choose photo
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => cameraRef.current?.click()}
                className="flex min-h-10 items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold hover:border-brand-400/60"
              >
                <Camera className="h-4 w-4" /> Camera
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={stageRef}
            role="application"
            tabIndex={0}
            aria-label={`${name} side crop area. Drag, or use the arrow keys, to line the card up with the frame. Plus and minus zoom, R rotates.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKey}
            className={`relative w-full touch-none select-none overflow-hidden rounded-2xl bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              panning ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ aspectRatio: `${sw} / ${sh}` }}
          >
            {place && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  left: `${((fx0 + place.cx - place.dw / 2) / sw) * 100}%`,
                  top: `${((fy0 + place.cy - place.dh / 2) / sh) * 100}%`,
                  width: `${(place.dw / sw) * 100}%`,
                  height: `${(place.dh / sh) * 100}%`,
                  transform: `rotate(${place.angle}rad)`,
                }}
              />
            )}
            <svg viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <path d={`M0 0H${sw}V${sh}H0Z${frameRect}`} fillRule="evenodd" fill="rgba(2,6,23,0.62)" />
              <path d={frameRect} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
              <path d={frameRect} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="pointer-events-none absolute left-2 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {name}
            </span>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <Move className="h-3.5 w-3.5 shrink-0" /> Drag (pinch on phones) until the card edges meet the dashed frame
          </p>

          <div className="mt-3">
            <label htmlFor={`idc-zoom-${side}`} className="mb-1 flex items-center justify-between text-xs font-semibold">
              Zoom <span className="font-mono text-brand-400">{Math.round(view.zoom * 100)}%</span>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Zoom out ${name}`} onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom / 1.1, MIN_ZOOM, MAX_ZOOM) }))} className={iconBtn}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <input
                id={`idc-zoom-${side}`}
                type="range"
                min={MIN_ZOOM * 100}
                max={MAX_ZOOM * 100}
                value={Math.round(view.zoom * 100)}
                onChange={(e) => setView((v) => ({ ...v, zoom: Number(e.target.value) / 100 }))}
                className="w-full accent-[var(--color-brand-500)]"
              />
              <button type="button" aria-label={`Zoom in ${name}`} onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom * 1.1, MIN_ZOOM, MAX_ZOOM) }))} className={iconBtn}>
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor={`idc-tilt-${side}`} className="mb-1 flex items-center justify-between text-xs font-semibold">
              Straighten <span className="font-mono text-brand-400">{view.tilt > 0 ? "+" : ""}{view.tilt.toFixed(1)}°</span>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Rotate ${name} 90° left`} onClick={() => setView((v) => ({ ...v, rot: (v.rot + 3) % 4 }))} className={iconBtn}>
                <RotateCcw className="h-4 w-4" />
              </button>
              <input
                id={`idc-tilt-${side}`}
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={view.tilt}
                onChange={(e) => setView((v) => ({ ...v, tilt: Number(e.target.value) }))}
                className="w-full accent-[var(--color-brand-500)]"
              />
              <button type="button" aria-label={`Rotate ${name} 90° right`} onClick={() => setView((v) => ({ ...v, rot: (v.rot + 1) % 4 }))} className={iconBtn}>
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setView(DEFAULT_VIEW)} className={smallBtn}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className={smallBtn}>
              <UploadCloud className="h-3.5 w-3.5" /> Replace
            </button>
            <button type="button" onClick={onRemove} className={`${smallBtn} hover:!text-red-400`}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function IdCardPrintStudio({ tool }: { tool: Tool }) {
  const [front, setFront] = useState<Source | null>(null);
  const [back, setBack] = useState<Source | null>(null);
  const [frontView, setFrontView] = useState<View>(DEFAULT_VIEW);
  const [backView, setBackView] = useState<View>(DEFAULT_VIEW);
  const [loadingSide, setLoadingSide] = useState<Side | null>(null);

  const [sizeKey, setSizeKey] = useState<SizeKey>("id1");
  const [vertical, setVertical] = useState(false);
  const [customW, setCustomW] = useState("85.6");
  const [customH, setCustomH] = useState("54");
  const [paperId, setPaperId] = useState("a4");
  const [copies, setCopies] = useState<CopiesPick>("1");
  const [guides, setGuides] = useState<Guides>("cut");
  const [arrange, setArrange] = useState<Arrange>("auto");
  const [rounded, setRounded] = useState(true);
  const [gray, setGray] = useState(false);
  const [mode, setMode] = useState<Mode>("same-page");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [store, setStore] = useState<CalibStore>(DEFAULT_STORE);
  const [testOpen, setTestOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const page1Ref = useRef<HTMLCanvasElement>(null);
  const page2Ref = useRef<HTMLCanvasElement>(null);

  // object URLs live exactly as long as the photo they belong to
  useEffect(() => {
    if (!front) return;
    const url = front.url;
    return () => URL.revokeObjectURL(url);
  }, [front]);
  useEffect(() => {
    if (!back) return;
    const url = back.url;
    return () => URL.revokeObjectURL(url);
  }, [back]);

  // saved printer calibration — read after mount so server and client markup match
  useEffect(() => {
    const raf = requestAnimationFrame(() => setStore(readCalib()));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ------------------------------ derived ------------------------------ */

  const cW = Number(customW);
  const cH = Number(customH);
  const sizeError =
    sizeKey === "custom" && (!Number.isFinite(cW) || !Number.isFinite(cH) || cW < 20 || cH < 20 || cW > 200 || cH > 200)
      ? "Enter a width and height between 20 and 200 mm."
      : null;
  const base = sizeKey === "custom" && !sizeError ? { w: cW, h: cH } : sizeKey === "big" ? { w: ID1.w * 1.5, h: ID1.h * 1.5 } : ID1;
  const cw = vertical ? base.h : base.w;
  const ch = vertical ? base.w : base.h;

  const paper = PAPER_MAP[paperId] ?? PAPERS[0];
  const paperName = paper.label.replace(/\s*\(.*\)$/, "");
  const twoSided = mode !== "same-page";
  const calibKey: "duplex" | "manual" = mode === "duplex" ? "duplex" : "manual";
  const calib = store[calibKey];
  const flip: Flip = mode === "duplex" ? store.flip : "long"; // a sheet turned over by hand like a book page = long edge
  const hasBack = !!back || !front;
  const want = copies === "fill" ? "fill" : Number(copies);

  const layout = useMemo(
    () => computeLayout(paper, cw, ch, mode, want, arrange, hasBack, flip),
    [paper, cw, ch, mode, want, arrange, hasBack, flip],
  );
  const clamped = want !== "fill" && want > layout.count && layout.capacity > 0;
  const canPrint = !!front && !sizeError && layout.count > 0 && (!twoSided || !!back);

  // live preview: the same drawing code as the export, on small canvases
  useEffect(() => {
    const c1 = page1Ref.current;
    const c2 = page2Ref.current;
    if (!c1) return;
    const t = window.setTimeout(() => {
      const k = 4; // px per mm is plenty for a thumbnail
      const cards: Cards = {
        front: renderCard(front, frontView, cw, ch, k, { round: rounded, gray, label: "FRONT" }),
        back: renderCard(back, backView, cw, ch, k, { round: rounded, gray, label: "BACK" }),
      };
      const ctx1 = previewContext(c1, layout.wMm, layout.hMm, 260);
      if (ctx1) drawSlots(ctx1, layout.page1, cards, cw, ch, guides);
      if (c2 && layout.page2.length) {
        const ctx2 = previewContext(c2, layout.wMm, layout.hMm, 260);
        if (ctx2) withBackCalibration(ctx2, layout.wMm, layout.hMm, calib, () => drawSlots(ctx2, layout.page2, cards, cw, ch, "none"));
      }
      if (cards.front) cards.front.width = 0;
      if (cards.back) cards.back.width = 0;
    }, 80);
    return () => window.clearTimeout(t);
  }, [front, back, frontView, backView, cw, ch, rounded, gray, layout, guides, calib, twoSided]);

  /* ------------------------------ loading ------------------------------ */

  async function loadSide(side: Side, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
      notify.error("That isn't an image", "Choose a JPG, PNG or WEBP photo or scan of the card.");
      return;
    }
    setLoadingSide(side);
    try {
      const src = await readImage(file);
      if (Math.min(src.width, src.height) < 250) {
        URL.revokeObjectURL(src.url);
        notify.error("Photo is too small", `It is only ${src.width} × ${src.height} px. Use the original camera photo, not a thumbnail.`);
        return;
      }
      if (side === "front") {
        setFront(src);
        setFrontView(DEFAULT_VIEW);
      } else {
        setBack(src);
        setBackView(DEFAULT_VIEW);
      }
      setStep(1);
      notify.info(`${side === "front" ? "Front" : "Back"} added`, "Drag and zoom until the card fills the dashed frame. Use Rotate if it is sideways.");
    } catch {
      notify.error(
        "Could not open this image",
        isHeic(file)
          ? "This browser can't read HEIC photos. On iPhone, set Camera → Formats → Most Compatible, or share the photo as JPG."
          : "The file may be damaged or in an unsupported format. Try a JPG or PNG.",
      );
    } finally {
      setLoadingSide(null);
    }
  }

  /* ---------------------------- calibration ---------------------------- */

  function updateStore(next: CalibStore) {
    setStore(next);
    writeCalib(next);
  }
  const updateCalib = (patch: Partial<Calib>) => updateStore({ ...store, [calibKey]: { ...store[calibKey], ...patch } });

  function answer(a: "ok" | "upside" | "same") {
    if (a === "ok") {
      updateCalib({ tested: true, turnOver: false });
      notify.success("Printer checked", "Saved on this device. Your card backs will be placed the same way.");
    } else if (a === "upside") {
      updateCalib({ tested: true, rotateBack: !calib.rotateBack, turnOver: false });
      notify.success("Fixed: back side turned 180°", "Saved. Run the test once more to confirm, if you like.");
    } else if (mode === "duplex") {
      notify.warning(
        "The printer didn't print on both sides",
        "In the print dialog turn on “Print on both sides” (or “Two-sided”). If there is no such option, choose “Single-sided printer” above.",
      );
    } else {
      updateCalib({ tested: true, turnOver: true });
      notify.warning("Load the sheet the other way up", "Next time turn the sheet over compared with what you did in the test. Then test again.");
    }
  }

  /* ------------------------------ building ----------------------------- */

  function renderCards(): Cards {
    const opts = { round: rounded, gray };
    return {
      front: front ? renderCard(front, frontView, cw, ch, DPMM, { ...opts, label: "FRONT" }) : null,
      back: back ? renderCard(back, backView, cw, ch, DPMM, { ...opts, label: "BACK" }) : null,
    };
  }

  function buildPages(which: "all" | "front" | "back"): PrintPage[] {
    if (!front) throw new Error("Add the front of the card first.");
    if (!layout.count) throw new Error("The card does not fit on this paper.");
    const cards = renderCards();
    const pages: PrintPage[] = [];
    try {
      if (which !== "back") {
        const p = paperCanvas(paper, layout.landscape);
        drawSlots(p.ctx, layout.page1, cards, cw, ch, guides);
        pages.push({ canvas: p.canvas, wMm: p.wMm, hMm: p.hMm });
      }
      if (twoSided && which !== "front") {
        const p = paperCanvas(paper, false);
        // guides only on the front: on the back they would show through if the alignment is off by a hair
        withBackCalibration(p.ctx, p.wMm, p.hMm, calib, () => drawSlots(p.ctx, layout.page2, cards, cw, ch, "none"));
        pages.push({ canvas: p.canvas, wMm: p.wMm, hMm: p.hMm });
      }
    } finally {
      if (cards.front) cards.front.width = 0;
      if (cards.back) cards.back.width = 0;
    }
    return pages;
  }

  function buildTestPages(which: "all" | "1" | "2"): PrintPage[] {
    const pages: PrintPage[] = [];
    const scale = Math.min(1, paper.w / 210, paper.h / 297);
    const front = { x: TEST_SPOT.x * scale, y: TEST_SPOT.y * scale };
    if (which !== "2") {
      const p = paperCanvas(paper, false);
      drawTestPage(p.ctx, p.wMm, 1, front, scale);
      pages.push({ canvas: p.canvas, wMm: p.wMm, hMm: p.hMm });
    }
    if (which !== "1") {
      const p = paperCanvas(paper, false);
      const spot = mirrorPoint(front, p.wMm, p.hMm, flip);
      withBackCalibration(p.ctx, p.wMm, p.hMm, calib, () => drawTestPage(p.ctx, p.wMm, 2, spot, scale));
      pages.push({ canvas: p.canvas, wMm: p.wMm, hMm: p.hMm });
    }
    return pages;
  }

  const free = (pages: PrintPage[]) => pages.forEach((p) => (p.canvas.width = 0));
  const fileBase = () => `id-card-${twoSided ? "two-sided" : "copy"}-${paperId}-${layout.count}x`;

  function report(outputType: string, bytesOut: number) {
    if (!front) return;
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        tool: tool.slug,
        inputType: front.file.type || "image",
        outputType,
        files: back ? 2 : 1,
        bytesIn: front.file.size + (back?.file.size ?? 0),
        bytesOut,
      }),
    }).catch(() => {});
  }

  async function doPrint(which: "all" | "front" | "back") {
    if (!canPrint || busy) return;
    setBusy(which === "all" ? "print" : which);
    try {
      await pause();
      const pages = buildPages(which);
      try {
        await printPages(pages, "ID card — SnapGrab");
      } finally {
        free(pages);
      }
      trackEvent("print", tool.slug);
      report("print", 0);
      if (mode === "manual" && which === "front") setStep(2);
    } catch (err) {
      notify.error("Could not open the print dialog", err instanceof Error ? err.message : "Download the PDF and print that instead.");
    } finally {
      setBusy(null);
    }
  }

  async function pdfFile() {
    const pages = buildPages("all");
    try {
      return blobToFile(await pagesToPdf(pages), `${fileBase()}.pdf`);
    } finally {
      free(pages);
    }
  }

  async function downloadPdf() {
    if (!canPrint || busy) return;
    setBusy("pdf");
    trackEvent("process", tool.slug);
    try {
      await pause();
      const file = await pdfFile();
      saveBlob(file, file.name);
      trackEvent("download", tool.slug);
      report("application/pdf", file.size);
      notify.success(
        "PDF downloaded",
        twoSided ? "Page 1 = fronts, page 2 = backs. Print at 100% / actual size." : `${paperName}, exact size. Print at 100% / actual size.`,
      );
    } catch (err) {
      notify.error("Could not create the PDF", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function downloadImages() {
    if (!canPrint || busy) return;
    setBusy("images");
    trackEvent("process", tool.slug);
    try {
      await pause();
      const pages = buildPages("all");
      let bytes = 0;
      try {
        for (let i = 0; i < pages.length; i++) {
          const blob = await toBlob(pages[i].canvas, "image/jpeg", 0.92);
          bytes += blob.size;
          const suffix = !twoSided ? "" : i === 0 ? "-page1-fronts" : "-page2-backs";
          saveBlob(blob, `${fileBase()}${suffix}.jpg`);
          if (i < pages.length - 1) await new Promise((r) => setTimeout(r, 400)); // some browsers block rapid downloads
        }
      } finally {
        free(pages);
      }
      trackEvent("download", tool.slug);
      report("image/jpeg", bytes);
      notify.success(pages.length > 1 ? "2 images downloaded" : "Image downloaded", "300 DPI. Print at 100% / actual size.");
    } catch (err) {
      notify.error("Could not create the images", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function printTest(which: "all" | "1" | "2") {
    if (busy) return;
    setBusy(which === "all" ? "test" : which === "1" ? "test1" : "test2");
    try {
      await pause();
      const pages = buildTestPages(which);
      try {
        await printPages(pages, "Printer test — SnapGrab");
      } finally {
        free(pages);
      }
      trackEvent("print", `${tool.slug}:test`);
    } catch (err) {
      notify.error("Could not open the print dialog", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  function changeMode(m: Mode) {
    setMode(m);
    setStep(1);
  }

  /* ------------------------------- render ------------------------------- */

  const spin = (b: Busy, icon: ReactNode) => (busy === b ? <Loader2 className="h-4 w-4 animate-spin" /> : icon);
  const calibSummary = calib.tested
    ? `Checked${calib.rotateBack ? " · back turned 180°" : ""}${calib.dx || calib.dy ? ` · nudged ${calib.dx > 0 ? "+" : ""}${calib.dx} / ${calib.dy > 0 ? "+" : ""}${calib.dy} mm` : ""}`
    : "Not tested yet — worth one plain sheet before you use card stock";

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass space-y-6 rounded-[26px] p-4 sm:p-6">
          <p className="flex items-start gap-2 rounded-xl border border-accent-500/30 bg-accent-500/10 px-3 py-2.5 text-xs text-[var(--fg)]">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
            <span>
              <strong>Private by design.</strong> ID cards are sensitive: your photos are cropped and printed right here in your browser.
              Nothing is uploaded or saved on our servers.
            </span>
          </p>

          {/* --------------------------- 1. photos --------------------------- */}
          <section aria-labelledby="idc-photos">
            <h2 id="idc-photos" className="mb-3 text-base font-bold">
              1. Add the front and back
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <CardSideEditor
                side="front"
                src={front}
                view={frontView}
                setView={setFrontView}
                cw={cw}
                ch={ch}
                loading={loadingSide === "front"}
                onFile={(f) => void loadSide("front", f)}
                onRemove={() => setFront(null)}
              />
              <CardSideEditor
                side="back"
                src={back}
                view={backView}
                setView={setBackView}
                cw={cw}
                ch={ch}
                loading={loadingSide === "back"}
                onFile={(f) => void loadSide("back", f)}
                onRemove={() => setBack(null)}
              />
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
              Best results: lay the card on a dark table, shoot straight from above in daylight without flash, then zoom so the card
              exactly fills the frame. A flatbed scan is even better.
            </p>
          </section>

          {/* --------------------------- 2. options --------------------------- */}
          <section aria-labelledby="idc-options" className="grid gap-5 lg:grid-cols-2">
            <h2 id="idc-options" className="text-base font-bold lg:col-span-2">
              2. Size, paper and copies
            </h2>
            <div className="min-w-0 space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Card size</span>
                <Segmented
                  label="Card size"
                  value={sizeKey}
                  onChange={setSizeKey}
                  options={[
                    { key: "id1", label: "ID card 85.6×54" },
                    { key: "big", label: "Bigger copy 1.5×" },
                    { key: "custom", label: "Custom (mm)" },
                  ]}
                />
                {sizeKey === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted">Width (mm)</span>
                      <input inputMode="decimal" value={customW} onChange={(e) => setCustomW(e.target.value)} className={field} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted">Height (mm)</span>
                      <input inputMode="decimal" value={customH} onChange={(e) => setCustomH(e.target.value)} className={field} />
                    </label>
                  </div>
                )}
                <p className={`mt-2 text-xs ${sizeError ? "text-red-400" : "text-muted"}`}>
                  {sizeError ??
                    (sizeKey === "id1"
                      ? "Exact ID-1 / CR80 size: CNIC, bank cards, most driving licences and office cards."
                      : sizeKey === "big"
                        ? `${Math.round(cw * 10) / 10} × ${Math.round(ch * 10) / 10} mm, easier to read, like an enlarged photocopy.`
                        : `${Math.round(cw * 10) / 10} × ${Math.round(ch * 10) / 10} mm.`)}
                </p>
                <div className="mt-2">
                  <Toggle checked={vertical} onChange={setVertical}>
                    Vertical card (portrait layout, e.g. some student or staff cards)
                  </Toggle>
                </div>
              </div>

              <div>
                <label htmlFor="idc-paper" className="mb-1.5 block text-xs font-semibold text-muted">
                  Paper
                </label>
                <select id="idc-paper" value={paperId} onChange={(e) => setPaperId(e.target.value)} className={field}>
                  {PAPERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">
                  {twoSided ? "Cards per sheet" : "Copies per sheet (each = front + back)"}
                </span>
                <Segmented label="Copies per sheet" value={copies} onChange={setCopies} options={COPIES} cols={5} />
                <p className="mt-2 text-xs text-muted" aria-live="polite">
                  {layout.capacity ? (
                    <>
                      Fits up to <strong className="text-[var(--fg)]">{layout.capacity}</strong> on {paperName}. This sheet:{" "}
                      <strong className="text-[var(--fg)]">{layout.count}</strong>.
                    </>
                  ) : (
                    <span className="text-red-400">This card size is too big for {paperName}.</span>
                  )}
                </p>
                {clamped && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Only {layout.count} fit on {paperName}, so the sheet has {layout.count}. Print it again for more.
                  </p>
                )}
              </div>
              {!twoSided && hasBack && (
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Arrangement</span>
                  <Segmented
                    label="Arrangement"
                    value={arrange}
                    onChange={setArrange}
                    options={[
                      { key: "auto", label: "Auto" },
                      { key: "stack", label: "Back below" },
                      { key: "side", label: "Side by side" },
                    ]}
                  />
                </div>
              )}
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Scissors className="h-3.5 w-3.5" /> Cutting guides
                </span>
                <Segmented label="Cutting guides" value={guides} onChange={setGuides} options={GUIDES} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle checked={rounded} onChange={setRounded}>
                  Rounded corners
                </Toggle>
                <Toggle checked={gray} onChange={setGray}>
                  Black &amp; white
                </Toggle>
              </div>
            </div>
          </section>

          {/* ---------------------------- 3. mode ---------------------------- */}
          <section aria-labelledby="idc-mode">
            <h2 id="idc-mode" className="mb-3 text-base font-bold">
              3. How will you print?
            </h2>
            <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-labelledby="idc-mode">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.key}
                  onClick={() => changeMode(m.key)}
                  className={`flex items-start gap-3 rounded-2xl p-3 text-left transition-all ${
                    mode === m.key ? "bg-brand-500/10 ring-2 ring-brand-400" : "surface hover:border-brand-400/60"
                  }`}
                >
                  <ModeDiagram mode={m.key} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{m.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{m.body}</span>
                  </span>
                </button>
              ))}
            </div>

            {twoSided && !back && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Add the back of the card above to print on both sides.
              </p>
            )}

            {mode === "duplex" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-muted">Binding / flip setting in the print dialog</span>
                  <Segmented
                    label="Flip edge"
                    value={store.flip}
                    onChange={(f) => updateStore({ ...store, flip: f })}
                    cols={2}
                    options={[
                      { key: "long", label: "Flip on long edge" },
                      { key: "short", label: "Flip on short edge" },
                    ]}
                  />
                </div>
                <div className="self-end">
                  <Toggle checked={calib.rotateBack} onChange={(v) => updateCalib({ rotateBack: v })}>
                    Rotate back side 180° (if backs came out upside down)
                  </Toggle>
                </div>
              </div>
            )}

            {twoSided && (
              <div className="mt-4 rounded-2xl surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <Wrench className="h-4 w-4 text-brand-400" /> Printer check
                  </p>
                  <button
                    type="button"
                    onClick={() => setTestOpen((v) => !v)}
                    aria-expanded={testOpen}
                    className="min-h-10 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-xs font-bold hover:text-brand-400"
                  >
                    {testOpen ? "Hide" : "Test my printer"}
                  </button>
                </div>
                <p className={`mt-1 text-xs ${calib.tested ? "text-accent-400" : "text-muted"}`}>{calibSummary}</p>

                <AnimatePresence initial={false}>
                  {testOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <ol className="mt-3 space-y-3 text-sm">
                        {mode === "duplex" ? (
                          <li>
                            <p>
                              <strong>1.</strong> Print the 2-page test on a plain sheet with <em>Print on both sides</em> turned on (flip on{" "}
                              {store.flip} edge).
                            </p>
                            <button type="button" disabled={!!busy} onClick={() => void printTest("all")} className={`${btnBase} ${secondary} mt-2`}>
                              {spin("test", <Crosshair className="h-4 w-4" />)} Print test page
                            </button>
                          </li>
                        ) : (
                          <>
                            <li>
                              <p>
                                <strong>1.</strong> Print test page 1 on a plain sheet.
                              </p>
                              <button type="button" disabled={!!busy} onClick={() => void printTest("1")} className={`${btnBase} ${secondary} mt-2`}>
                                {spin("test1", <Crosshair className="h-4 w-4" />)} Print test page 1
                              </button>
                            </li>
                            <li>
                              <p>
                                <strong>2.</strong> Put the same sheet back the way described in step 2 of the guide below, then print page 2.
                              </p>
                              <button type="button" disabled={!!busy} onClick={() => void printTest("2")} className={`${btnBase} ${secondary} mt-2`}>
                                {spin("test2", <Crosshair className="h-4 w-4" />)} Print test page 2
                              </button>
                            </li>
                          </>
                        )}
                        <li>
                          <p>
                            <strong>{mode === "duplex" ? "2." : "3."}</strong> Look at the sheet. What do you see?
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <button type="button" onClick={() => answer("ok")} className={`${btnBase} ${secondary} !px-3 text-xs`}>
                              <Check className="h-4 w-4 text-accent-400" /> 2 is on the back and upright
                            </button>
                            <button type="button" onClick={() => answer("upside")} className={`${btnBase} ${secondary} !px-3 text-xs`}>
                              <RotateCw className="h-4 w-4" /> 2 is upside down
                            </button>
                            <button type="button" onClick={() => answer("same")} className={`${btnBase} ${secondary} !px-3 text-xs`}>
                              <AlertCircle className="h-4 w-4" />
                              {mode === "duplex" ? "2 came out on a separate sheet" : "2 printed on the same side as 1"}
                            </button>
                          </div>
                        </li>
                        <li>
                          <p>
                            <strong>{mode === "duplex" ? "3." : "4."}</strong> Fine alignment: hold the sheet up to a window. Looking at the
                            back (page 2), if its crosshair sits 1 mm to the <em>left</em> of the one showing through, set X to +1. Same for up
                            / down with Y.
                          </p>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            <Nudge id="idc-dx" label="Back X (→ right)" value={calib.dx} onChange={(v) => updateCalib({ dx: v })} />
                            <Nudge id="idc-dy" label="Back Y (↓ down)" value={calib.dy} onChange={(v) => updateCalib({ dy: v })} />
                          </div>
                          {mode === "manual" && (
                            <div className="mt-2">
                              <Toggle checked={calib.rotateBack} onChange={(v) => updateCalib({ rotateBack: v })}>
                                Rotate back side 180°
                              </Toggle>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              updateCalib({ ...BLANK_CALIB });
                              notify.info("Printer settings reset");
                            }}
                            className="mt-2 text-xs font-semibold text-muted underline-offset-2 hover:text-red-400 hover:underline"
                          >
                            Reset printer settings
                          </button>
                        </li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* --------------------------- 4. preview --------------------------- */}
          <section aria-labelledby="idc-preview">
            <h2 id="idc-preview" className="mb-3 text-base font-bold">
              4. Preview
            </h2>
            <div className={`mx-auto grid gap-4 ${twoSided ? "max-w-[560px] grid-cols-2" : "max-w-[280px] grid-cols-1"}`}>
              <figure className="min-w-0">
                <canvas
                  ref={page1Ref}
                  role="img"
                  aria-label={twoSided ? "Page 1 preview: fronts" : "Page preview"}
                  className="block h-auto w-full rounded-sm bg-white shadow-lg ring-1 ring-black/10"
                  style={{ aspectRatio: `${layout.wMm} / ${layout.hMm}` }}
                />
                <figcaption className="mt-2 text-center text-xs text-muted">
                  {twoSided ? (
                    <>
                      <strong className="text-[var(--fg)]">Page 1</strong> · fronts
                    </>
                  ) : (
                    `${paperName}${layout.landscape ? " (landscape)" : ""}`
                  )}
                </figcaption>
              </figure>
              {twoSided && (
                <figure className="min-w-0">
                  <canvas
                    ref={page2Ref}
                    role="img"
                    aria-label="Page 2 preview: backs, mirrored so each lands behind its front"
                    className="block h-auto w-full rounded-sm bg-white shadow-lg ring-1 ring-black/10"
                    style={{ aspectRatio: `${layout.wMm} / ${layout.hMm}` }}
                  />
                  <figcaption className="mt-2 text-center text-xs text-muted">
                    <strong className="text-[var(--fg)]">Page 2</strong> · backs, mirrored to sit behind the fronts
                    {calib.rotateBack ? " (turned 180° for your printer)" : ""}
                  </figcaption>
                </figure>
              )}
            </div>
            {!front && <p className="mt-3 text-center text-xs text-muted">Add the front of your card to fill the preview.</p>}
            {front && !back && !twoSided && <p className="mt-3 text-center text-xs text-muted">No back added: only the front will print.</p>}
          </section>

          {/* --------------------------- 5. print --------------------------- */}
          <section aria-labelledby="idc-print" className="space-y-4">
            <h2 id="idc-print" className="text-base font-bold">
              5. Print or download
            </h2>

            <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 px-3 py-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-bold text-brand-400">
                <Info className="h-3.5 w-3.5" /> Before you print
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
                {PRINT_TIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
                {mode === "duplex" && (
                  <li className="font-semibold text-[var(--fg)]">
                    Turn on “Print on both sides” → “Flip on {store.flip} edge” (may be under More settings or Printer properties).
                  </li>
                )}
                {mode === "manual" && <li>Turn off “Print on both sides”; you will feed the sheet back in yourself.</li>}
              </ul>
            </div>

            {mode === "manual" ? (
              <div className="rounded-2xl surface p-4">
                <ol className="flex items-center gap-2 text-xs font-bold" aria-label="Steps">
                  {(["Print fronts", "Put sheet back", "Print backs"] as const).map((label, i) => (
                    <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStep((i + 1) as 1 | 2 | 3)}
                        aria-current={step === i + 1 ? "step" : undefined}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${step === i + 1 ? primary : step > i + 1 ? "bg-accent-500/20 text-accent-400" : "bg-[var(--bg-soft)] text-muted"}`}
                      >
                        {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
                      </button>
                      <span className={`hidden truncate sm:inline ${step === i + 1 ? "" : "text-muted"}`}>{label}</span>
                    </li>
                  ))}
                </ol>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="mt-4"
                  >
                    {step === 1 && (
                      <>
                        <p className="text-sm font-bold">Step 1: print the front side</p>
                        <p className="mt-1 text-sm text-muted">Load one sheet of {paperName}. This prints page 1 (the fronts) only.</p>
                        <button type="button" onClick={() => void doPrint("front")} disabled={!canPrint || !!busy} className={`${btnBase} ${primary} mt-3 w-full sm:w-auto`}>
                          {spin("front", <Printer className="h-4 w-4" />)} Print the front side
                        </button>
                        <button type="button" onClick={() => setStep(2)} className="ml-0 mt-2 block text-xs font-semibold text-muted hover:text-brand-400 sm:ml-3 sm:inline sm:mt-0">
                          Already printed? Next step →
                        </button>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        <p className="text-sm font-bold">Step 2: put the same sheet back</p>
                        <div className="mt-3">
                          <FlipIllustration />
                        </div>
                        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
                          <li>Wait for the ink to dry. With a pen, put a small tick on the top edge of the printed side.</li>
                          <li>
                            Turn the sheet over <strong className="text-[var(--fg)]">like turning a page of a book</strong> (left ↔ right).
                            The marked top edge stays at the top.
                          </li>
                          <li>Load it so the blank side gets printed and the marked edge goes into the printer first, like the first time.</li>
                        </ol>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div className="rounded-xl bg-[var(--bg-soft)] p-3">
                            <p className="font-bold">Rear / top-feed inkjets</p>
                            <p className="mt-1 text-muted">
                              e.g. Epson L-series, Canon G-series. The sheet stands up behind the printer, marked edge pointing down into
                              the slot. Most print on the side facing you, so the printed side faces away — but some models are the
                              other way round.
                            </p>
                          </div>
                          <div className="rounded-xl bg-[var(--bg-soft)] p-3">
                            <p className="font-bold">Bottom-tray printers</p>
                            <p className="mt-1 text-muted">
                              e.g. many HP LaserJets. The paper turns over inside the printer, so the side facing down gets printed: put
                              the sheet in printed side face up, top edge toward the back. Check the paper symbol on your tray.
                            </p>
                          </div>
                        </div>
                        {store.manual.turnOver && (
                          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            In your printer test, page 2 landed on the already printed side. Load the sheet the other way up this time
                            (turned over compared with the test).
                          </p>
                        )}
                        <p className="mt-3 text-xs text-muted">
                          Not sure which way your printer takes it? Use <strong>Test my printer</strong> above with a plain sheet first.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setStep(1)} className={`${btnBase} ${secondary}`}>
                            <ChevronLeft className="h-4 w-4" /> Back
                          </button>
                          <button type="button" onClick={() => setStep(3)} className={`${btnBase} ${primary} flex-1 sm:flex-none`}>
                            The sheet is back in <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                    {step === 3 && (
                      <>
                        <p className="text-sm font-bold">Step 3: print the back side</p>
                        <p className="mt-1 text-sm text-muted">
                          This prints page 2 only, mirrored so each back lands behind its front. Don&apos;t change any settings since step 1.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setStep(2)} className={`${btnBase} ${secondary}`}>
                            <ChevronLeft className="h-4 w-4" /> Back
                          </button>
                          <button type="button" onClick={() => void doPrint("back")} disabled={!canPrint || !!busy} className={`${btnBase} ${primary} flex-1 sm:flex-none`}>
                            {spin("back", <Printer className="h-4 w-4" />)} Print the back side
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : (
              <motion.button
                type="button"
                onClick={() => void doPrint("all")}
                disabled={!canPrint || !!busy}
                whileTap={{ scale: 0.97 }}
                className={`${btnBase} ${primary} w-full sm:w-auto`}
              >
                {spin("print", <Printer className="h-4 w-4" />)}
                {busy === "print" ? "Preparing…" : mode === "duplex" ? "Print both sides" : "Print"}
              </motion.button>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadPdf()} disabled={!canPrint || !!busy} className={`${btnBase} ${secondary} flex-1 sm:flex-none`}>
                {spin("pdf", <FileText className="h-4 w-4" />)} Download PDF
              </button>
              <button type="button" onClick={() => void downloadImages()} disabled={!canPrint || !!busy} className={`${btnBase} ${secondary} flex-1 sm:flex-none`}>
                {spin("images", twoSided ? <Images className="h-4 w-4" /> : <Download className="h-4 w-4" />)}
                {twoSided ? "Download images" : "Download JPG"}
              </button>
              {canPrint && (
                <ShareSheet
                  label="Share PDF"
                  title="ID card copy"
                  text="ID card ready to print (print at 100%)"
                  getFiles={async () => [await pdfFile()]}
                />
              )}
            </div>
            <p className="text-xs text-muted">
              The PDF is exactly {paperName}
              {twoSided ? " with 2 pages (fronts, then backs, including your printer settings)" : ""}. Handy for a print shop. Only
              share ID copies with people and offices you trust.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
