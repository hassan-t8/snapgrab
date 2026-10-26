"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import {
  Amiri,
  Aref_Ruqaa,
  Cinzel,
  Cormorant_Garamond,
  Dancing_Script,
  Great_Vibes,
  Noto_Nastaliq_Urdu,
  Playfair_Display,
  Poppins,
  Reem_Kufi,
} from "next/font/google";
import { motion } from "framer-motion";
import {
  Download,
  FileDown,
  ImagePlus,
  Loader2,
  Printer,
  Sparkles,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash2,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import ShareSheet, { canvasToFile } from "@/components/ShareSheet";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import { PAPER_MAP, drawCropMarks, mmToPx, pagesToPdf, paperCanvas, printPages } from "@/lib/print";

/* ------------------------------------------------------------------ *
 * fonts — self-hosted by next/font, fetched only when a card uses them.
 * The canvas can only draw with a face that has finished loading, so every
 * render waits for document.fonts.load() first (see useFonts / ensureFonts).
 * ------------------------------------------------------------------ */

const nastaliqFont = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "700"], display: "swap", preload: false });
const ruqaaFont = Aref_Ruqaa({ subsets: ["arabic"], weight: ["400", "700"], display: "swap", preload: false });
const amiriFont = Amiri({ subsets: ["arabic"], weight: ["400", "700"], display: "swap", preload: false });
const kufiFont = Reem_Kufi({ subsets: ["arabic"], display: "swap", preload: false });
const playfairFont = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], display: "swap", preload: false });
const cormorantFont = Cormorant_Garamond({ subsets: ["latin"], style: ["normal", "italic"], display: "swap", preload: false });
const cinzelFont = Cinzel({ subsets: ["latin"], display: "swap", preload: false });
const vibesFont = Great_Vibes({ weight: "400", subsets: ["latin"], display: "swap", preload: false });
const dancingFont = Dancing_Script({ subsets: ["latin"], display: "swap", preload: false });
const poppinsFont = Poppins({ weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap", preload: false });

const NASTALIQ_BASE = nastaliqFont.style.fontFamily;
const FAM = {
  nastaliq: `${NASTALIQ_BASE}, serif`,
  ruqaa: `${ruqaaFont.style.fontFamily}, ${NASTALIQ_BASE}, serif`,
  naskh: `${amiriFont.style.fontFamily}, ${NASTALIQ_BASE}, serif`,
  kufi: `${kufiFont.style.fontFamily}, ${NASTALIQ_BASE}, sans-serif`,
  playfair: `${playfairFont.style.fontFamily}, Georgia, serif`,
  cormorant: `${cormorantFont.style.fontFamily}, Georgia, serif`,
  cinzel: `${cinzelFont.style.fontFamily}, Georgia, serif`,
  vibes: `${vibesFont.style.fontFamily}, cursive`,
  dancing: `${dancingFont.style.fontFamily}, cursive`,
  poppins: `${poppinsFont.style.fontFamily}, system-ui, sans-serif`,
};

const AR_SAMPLE = "عید مبارک ہے ۔ گ";
/** "font~sample text" — what document.fonts.load() needs to fetch the right face and subset */
const fs = (weight: number, family: string, sample = "Aa", italic = false) =>
  `${italic ? "italic " : ""}${weight} 40px ${family}~${sample}`;

const BASE_SPECS = [
  fs(700, FAM.nastaliq, AR_SAMPLE),
  fs(400, FAM.nastaliq, AR_SAMPLE),
  fs(700, FAM.naskh, "بسم الله الرحمن الرحيم"),
  fs(700, FAM.playfair),
  fs(600, FAM.playfair),
  fs(500, FAM.playfair),
  fs(400, FAM.playfair, "Aa", true),
  fs(600, FAM.playfair, "Aa", true),
  fs(500, FAM.cormorant, "Aa", true),
  fs(700, FAM.cinzel),
  fs(400, FAM.vibes),
  fs(700, FAM.dancing),
  fs(500, FAM.poppins),
  fs(600, FAM.poppins),
  fs(700, FAM.poppins),
];

const loadedSpecs = new Set<string>();

function loadSpec(spec: string) {
  const [font, text] = spec.split("~");
  return document.fonts
    .load(font, text)
    .then(() => {
      loadedSpecs.add(spec);
    })
    .catch(() => {});
}

/** Waits for the given faces before an export (cached after the first time). */
async function ensureFonts(specs: string[]) {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(specs.filter((s) => !loadedSpecs.has(s)).map(loadSpec));
}

/** Loads the faces a card needs and returns a counter that changes once they are ready (to redraw). */
function useFonts(specs: string[]) {
  const key = specs.join("|");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!document.fonts) return;
    const list = key.split("|").filter((s) => s && !loadedSpecs.has(s));
    if (!list.length) return;
    let alive = true;
    void Promise.all(list.map(loadSpec)).then(() => {
      if (alive) setTick((t) => t + 1);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return tick;
}

/* ------------------------------------------------------------------ *
 * small helpers
 * ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;
type Rand = () => number;
type Renderer<S> = (ctx: Ctx, W: number, H: number, scene: S) => void;

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";
const TAU = Math.PI * 2;
const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const isRtl = (s: string) => RTL_RE.test(s);

function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not a photo your browser can open."));
    };
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

function renderCanvas<S>(render: Renderer<S>, scene: S, W: number, H: number, scale = 1) {
  const c = document.createElement("canvas");
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create images.");
  ctx.scale(scale, scale);
  render(ctx, W, H, scene);
  return c;
}

/** Records one anonymous use per page view, once the user saves or shares a card. */
function useTrackOnce(slug: string, ready: boolean) {
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ tool: slug, files: 1 }),
    }).catch(() => {});
  }, [slug, ready]);
}

/* ------------------------------------------------------------------ *
 * text layout — wrap, shrink-to-fit and a vertical stack of blocks
 * ------------------------------------------------------------------ */

type Align = "left" | "center" | "right";
/** blur and offset are fractions of the font size */
type Shadow = { color: string; blur: number; y: number };
type TextItem = {
  kind: "text";
  text: string;
  family: string;
  weight?: number;
  italic?: boolean;
  /** largest size in px; the block shrinks until it fits */
  size: number;
  color: string;
  lh?: number;
  maxLines?: number;
  /** keep the typed line breaks (poetry): shrink before wrapping a line */
  keepLines?: boolean;
  tracking?: number;
  shadow?: Shadow | null;
  gap?: number;
};
type DrawItem = { kind: "draw"; h: number; gap?: number; draw: (ctx: Ctx, x: number, y: number, w: number, h: number) => void };
type PhotoItem = { kind: "photo"; img: HTMLImageElement; d: number; ring: string; gap?: number };
type Item = TextItem | DrawItem | PhotoItem;
type Box = { x: number; y: number; w: number; h: number };

const SHADOW: Shadow = { color: "rgba(0,0,0,0.35)", blur: 0.14, y: 0.035 };

const T = (t: Omit<TextItem, "kind">): TextItem => ({ kind: "text", ...t });

/** A text block that switches to Nastaliq (and its taller line height) when the text is Urdu. */
function TA(text: string, latinFamily: string, o: Omit<TextItem, "kind" | "text" | "family">): TextItem {
  if (!isRtl(text)) return T({ text, family: latinFamily, ...o });
  return T({
    ...o,
    text,
    family: FAM.nastaliq,
    italic: false,
    tracking: 0,
    weight: (o.weight ?? 400) >= 600 ? 700 : 400,
    lh: Math.max(o.lh ?? 1.25, 1.8),
  });
}

function applyText(ctx: Ctx, t: TextItem, size: number) {
  ctx.font = `${t.italic ? "italic " : ""}${t.weight ?? 400} ${size.toFixed(2)}px ${t.family}`;
  ctx.direction = isRtl(t.text) ? "rtl" : "ltr";
  ctx.letterSpacing = `${t.tracking ? ((t.tracking * size) / t.size).toFixed(2) : 0}px`;
}

function wrapLines(ctx: Ctx, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width <= maxW) line = test;
      else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out;
}

type Placed = { item: Item; h: number; size: number; lines: string[] };

function measureItem(ctx: Ctx, it: Item, s: number, maxW: number): Placed {
  if (it.kind === "photo") return { item: it, h: it.d * s, size: 0, lines: [] };
  if (it.kind === "draw") return { item: it, h: it.h * s, size: 0, lines: [] };
  let size = it.size * s;
  const floor = size * 0.22;
  const hard = it.text.split("\n").length;
  let lines: string[] = [];
  for (let i = 0; i < 60; i++) {
    applyText(ctx, it, size);
    lines = wrapLines(ctx, it.text, maxW);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    const limit = it.keepLines && size > floor * 1.6 ? hard : it.maxLines;
    if ((widest <= maxW && (!limit || lines.length <= limit)) || size <= floor) break;
    size *= 0.95;
  }
  return { item: it, h: lines.length * size * (it.lh ?? 1.25), size, lines };
}

function drawPlaced(ctx: Ctx, p: Placed, box: Box, y: number, align: Align) {
  const it = p.item;
  const ax = align === "center" ? box.x + box.w / 2 : align === "left" ? box.x : box.x + box.w;
  if (it.kind === "draw") {
    it.draw(ctx, box.x, y, box.w, p.h);
    return;
  }
  if (it.kind === "photo") {
    const r = p.h / 2;
    const cx = align === "center" ? ax : align === "left" ? box.x + r : box.x + box.w - r;
    const cy = y + r;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = r * 0.18;
    ctx.fillStyle = it.ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    const ir = r * 0.93;
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, TAU);
    ctx.clip();
    const iw = it.img.naturalWidth || it.img.width;
    const ih = it.img.naturalHeight || it.img.height;
    const sc = Math.max((ir * 2) / iw, (ir * 2) / ih);
    ctx.drawImage(it.img, cx - (iw * sc) / 2, cy - (ih * sc) / 2, iw * sc, ih * sc);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = r * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, TAU);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  applyText(ctx, it, p.size);
  ctx.fillStyle = it.color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = align;
  const probe = ctx.measureText(p.lines.join(" ") || "M");
  // centre the ink (not the em box) on each line — Nastaliq's metrics are very tall
  const off = (probe.actualBoundingBoxAscent - probe.actualBoundingBoxDescent) / 2;
  const lh = p.size * (it.lh ?? 1.25);
  if (it.shadow) {
    ctx.shadowColor = it.shadow.color;
    ctx.shadowBlur = it.shadow.blur * p.size;
    ctx.shadowOffsetY = it.shadow.y * p.size;
  }
  p.lines.forEach((line, k) => {
    if (line) ctx.fillText(line, ax, y + lh * k + lh / 2 + off);
  });
  ctx.restore();
}

/** Lays the blocks out top to bottom inside the box, shrinking everything until it fits, then centres it. */
function layoutStack(ctx: Ctx, items: Item[], box: Box, align: Align = "center") {
  if (!items.length) return;
  let s = 1;
  let placed: Placed[] = [];
  let total = 0;
  for (let iter = 0; iter < 18; iter++) {
    placed = items.map((it) => measureItem(ctx, it, s, box.w));
    total = 0;
    for (let i = 0; i < placed.length; i++) total += placed[i].h + (i < placed.length - 1 ? (placed[i].item.gap ?? 0) * s : 0);
    if (total <= box.h) break;
    s *= Math.max(0.72, Math.min(0.97, box.h / total));
  }
  const n = placed.length;
  const free = Math.max(0, box.h - total);
  const extra = n > 1 ? Math.min(free * 0.4, box.h * 0.025 * (n - 1)) / (n - 1) : 0;
  let y = box.y + (free - extra * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    drawPlaced(ctx, placed[i], box, y, align);
    y += placed[i].h + (placed[i].item.gap ?? 0) * s + extra;
  }
}

/* ------------------------------------------------------------------ *
 * vector ornaments
 * ------------------------------------------------------------------ */

function star5(ctx: Ctx, cx: number, cy: number, R: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.42 : R;
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function sparkle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** Crescent whose opening faces the direction `rot` (radians, 0 = right). */
function crescent(ctx: Ctx, cx: number, cy: number, R: number, rot: number) {
  const d = R * 0.4;
  const r = R * 0.86;
  const x = (d * d - r * r + R * R) / (2 * d);
  const y = Math.sqrt(Math.max(0, R * R - x * x));
  const a = Math.atan2(y, x);
  const b = Math.atan2(y, x - d);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.arc(0, 0, R, a, TAU - a, false);
  ctx.arc(d, 0, r, -b, b, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function crescentStar(ctx: Ctx, cx: number, cy: number, R: number, rot: number) {
  crescent(ctx, cx, cy, R, rot);
  star5(ctx, cx + Math.cos(rot) * R * 0.62, cy + Math.sin(rot) * R * 0.62, R * 0.3, rot + Math.PI / 2);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function starField(ctx: Ctx, W: number, h: number, m: number, rand: Rand, color: string, n: number) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = rand() * h;
    const r = (0.6 + rand() * 1.9) * (m / 1080);
    ctx.globalAlpha = 0.25 + rand() * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const x = rand() * W;
    const y = rand() * h;
    ctx.globalAlpha = 0.5 + rand() * 0.5;
    sparkle(ctx, x, y, (6 + rand() * 10) * (m / 1080));
  }
  ctx.restore();
}

function speckle(ctx: Ctx, W: number, H: number, rand: Rand, color: string, n: number, size: number) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = rand() * 0.5;
    ctx.fillRect(rand() * W, rand() * H, size * (0.5 + rand()), size * (0.5 + rand()));
  }
  ctx.restore();
}

function vignette(ctx: Ctx, W: number, H: number, alpha: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Interlaced eight-pointed-star lattice (khatam) — a classic Islamic geometric pattern. */
function starPattern(ctx: Ctx, W: number, H: number, cell: number, color: string, alpha: number, lw: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  const r = cell * 0.5;
  for (let y = 0; y <= H + cell; y += cell) {
    for (let x = 0; x <= W + cell; x += cell) {
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i <= 4; i++) {
          const a = (k * Math.PI) / 4 + (i * Math.PI) / 2;
          const px = x + r * Math.cos(a);
          const py = y + r * Math.sin(a);
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
      }
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        const px = x + r * 0.42 * Math.cos(a);
        const py = y + r * 0.42 * Math.sin(a);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      // small diamond where four cells meet
      const qx = x + cell / 2;
      const qy = y + cell / 2;
      const q = cell * 0.12;
      ctx.moveTo(qx, qy - q);
      ctx.lineTo(qx + q, qy);
      ctx.lineTo(qx, qy + q);
      ctx.lineTo(qx - q, qy);
      ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.restore();
}

function ornateFrame(ctx: Ctx, W: number, H: number, i: number, color: string, m: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = m * 0.0045;
  ctx.strokeRect(i, i, W - 2 * i, H - 2 * i);
  const j = i + m * 0.016;
  ctx.lineWidth = m * 0.0016;
  ctx.strokeRect(j, j, W - 2 * j, H - 2 * j);
  const s = m * 0.09;
  const corners: [number, number, number, number][] = [
    [i, i, 1, 1],
    [W - i, i, -1, 1],
    [i, H - i, 1, -1],
    [W - i, H - i, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.lineWidth = m * 0.0028;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI / 2);
    ctx.stroke();
    ctx.lineWidth = m * 0.0016;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.72, 0, Math.PI / 2);
    ctx.stroke();
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      const px = Math.cos(a) * s * 0.86;
      const py = Math.sin(a) * s * 0.86;
      const d = s * (k === 2 ? 0.1 : 0.06);
      ctx.beginPath();
      ctx.moveTo(px, py - d);
      ctx.lineTo(px + d, py);
      ctx.lineTo(px, py + d);
      ctx.lineTo(px - d, py);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(s * 0.3, s * 0.3, s * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** ── ◆ ── divider */
function ornamentLine(ctx: Ctx, cx: number, cy: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, h * 0.07);
  const g = h * 0.62;
  const lg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  lg.addColorStop(0, hexA(color, 0));
  lg.addColorStop(0.35, color);
  lg.addColorStop(0.65, color);
  lg.addColorStop(1, hexA(color, 0));
  ctx.strokeStyle = lg;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx - g, cy);
  ctx.moveTo(cx + g, cy);
  ctx.lineTo(cx + w / 2, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.4);
  ctx.lineTo(cx + h * 0.28, cy);
  ctx.lineTo(cx, cy + h * 0.4);
  ctx.lineTo(cx - h * 0.28, cy);
  ctx.closePath();
  ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + sx * h * 0.45, cy, h * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const divider = (color: string, w: number, h: number, gap: number): DrawItem => ({
  kind: "draw",
  h,
  gap,
  draw: (ctx, x, y, bw, hh) => ornamentLine(ctx, x + bw / 2, y + hh / 2, Math.min(bw, (w * hh) / h), hh, color),
});

function onionDome(ctx: Ctx, cx: number, by: number, w: number, h: number) {
  ctx.moveTo(cx - w / 2, by);
  ctx.bezierCurveTo(cx - w * 0.64, by - h * 0.55, cx - w * 0.1, by - h * 0.72, cx, by - h);
  ctx.bezierCurveTo(cx + w * 0.1, by - h * 0.72, cx + w * 0.64, by - h * 0.55, cx + w / 2, by);
  ctx.closePath();
}

/** Mosque in the middle of a row of small domed buildings, along the bottom edge. */
function skyline(ctx: Ctx, W: number, H: number, h: number, color: string) {
  const u = h / 64;
  const cx = W / 2;
  const base = H;
  ctx.save();
  const g = ctx.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, color);
  g.addColorStop(1, hexA(color, 0.75));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.rect(0, base - 5 * u, W, 5 * u);
  // side buildings
  for (let k = 0; ; k++) {
    const off = 64 * u + k * 19 * u;
    if (off > W / 2 + 20 * u) break;
    const bh = (k % 3 === 1 ? 15 : k % 2 ? 9 : 12) * u;
    for (const sx of [-1, 1]) {
      const x = cx + sx * off;
      ctx.rect(x - 8 * u, base - 5 * u - bh, 16 * u, bh);
      onionDome(ctx, x, base - 5 * u - bh, 13 * u, 11 * u);
      if (k % 3 === 2) {
        ctx.rect(x + 9 * u, base - 5 * u - bh - 14 * u, 2.6 * u, bh + 14 * u);
        ctx.moveTo(x + 8.6 * u, base - 5 * u - bh - 14 * u);
        ctx.lineTo(x + 10.3 * u, base - 5 * u - bh - 19 * u);
        ctx.lineTo(x + 12 * u, base - 5 * u - bh - 14 * u);
        ctx.closePath();
      }
    }
  }
  // main hall, drum and dome
  ctx.rect(cx - 30 * u, base - 21 * u, 60 * u, 16 * u);
  ctx.rect(cx - 44 * u, base - 13 * u, 14 * u, 8 * u);
  ctx.rect(cx + 30 * u, base - 13 * u, 14 * u, 8 * u);
  ctx.rect(cx - 15 * u, base - 25 * u, 30 * u, 4 * u);
  onionDome(ctx, cx, base - 25 * u, 32 * u, 28 * u);
  onionDome(ctx, cx - 37 * u, base - 13 * u, 12 * u, 10 * u);
  onionDome(ctx, cx + 37 * u, base - 13 * u, 12 * u, 10 * u);
  onionDome(ctx, cx - 20 * u, base - 21 * u, 9 * u, 8 * u);
  onionDome(ctx, cx + 20 * u, base - 21 * u, 9 * u, 8 * u);
  // minarets
  for (const sx of [-1, 1]) {
    const mx = cx + sx * 52 * u;
    ctx.rect(mx - 2.2 * u, base - 50 * u, 4.4 * u, 45 * u);
    ctx.rect(mx - 3.6 * u, base - 36 * u, 7.2 * u, 2 * u);
    ctx.rect(mx - 3.6 * u, base - 48 * u, 7.2 * u, 1.8 * u);
    ctx.moveTo(mx - 2.8 * u, base - 50 * u);
    ctx.lineTo(mx, base - 58 * u);
    ctx.lineTo(mx + 2.8 * u, base - 50 * u);
    ctx.closePath();
  }
  ctx.fill();
  // finials
  ctx.fillStyle = color;
  ctx.fillRect(cx - 0.5 * u, base - 57 * u, u, 4 * u);
  crescent(ctx, cx, base - 59 * u, 2.6 * u, -Math.PI / 2);
  ctx.restore();
}

function lantern(ctx: Ctx, x: number, top: number, len: number, s: number, color: string) {
  const y = top + len;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, y);
  ctx.stroke();
  glow(ctx, x, y + s * 0.62, s * 1.3, "rgba(255, 210, 110, 0.42)");
  ctx.beginPath();
  ctx.arc(x, y + s * 0.04, s * 0.05, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y + s * 0.24);
  ctx.quadraticCurveTo(x, y - s * 0.04, x + s * 0.3, y + s * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - s * 0.34, y + s * 0.22, s * 0.68, s * 0.05);
  const by0 = y + s * 0.27;
  const by1 = y + s * 1.0;
  const mid = y + s * 0.62;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.26, by0);
  ctx.lineTo(x + s * 0.26, by0);
  ctx.lineTo(x + s * 0.38, mid);
  ctx.lineTo(x + s * 0.24, by1);
  ctx.lineTo(x - s * 0.24, by1);
  ctx.lineTo(x - s * 0.38, mid);
  ctx.closePath();
  const lg = ctx.createRadialGradient(x, mid, s * 0.02, x, mid, s * 0.44);
  lg.addColorStop(0, "#fff8dc");
  lg.addColorStop(0.5, "#ffcb5c");
  lg.addColorStop(1, "#d9861a");
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.lineWidth = s * 0.035;
  ctx.stroke();
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(x, by0);
  ctx.lineTo(x, by1);
  for (const sx of [-1, 1]) {
    ctx.moveTo(x + sx * s * 0.13, by0);
    ctx.lineTo(x + sx * s * 0.2, mid);
    ctx.lineTo(x + sx * s * 0.12, by1);
  }
  ctx.moveTo(x - s * 0.38, mid);
  ctx.lineTo(x + s * 0.38, mid);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(x - s * 0.28, by1, s * 0.56, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.18, by1 + s * 0.05);
  ctx.lineTo(x + s * 0.18, by1 + s * 0.05);
  ctx.lineTo(x, by1 + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, by1 + s * 0.24, s * 0.04, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function archPath(ctx: Ctx, x: number, y: number, w: number, bottom: number) {
  const spring = y + w * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, spring);
  ctx.bezierCurveTo(x, spring - w * 0.32, x + w * 0.25, y + w * 0.05, x + w / 2, y);
  ctx.bezierCurveTo(x + w * 0.75, y + w * 0.05, x + w, spring - w * 0.32, x + w, spring);
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
}

function kaaba(ctx: Ctx, cx: number, base: number, w: number) {
  const f = w * 0.64;
  const sd = w * 0.36;
  const h = w * 0.78;
  const sk = sd * 0.42;
  const x0 = cx - w / 2;
  const x1 = x0 + f;
  const top = base - h;
  const gold = "#d9b25f";
  ctx.save();
  const gg = ctx.createRadialGradient(cx, base, 0, cx, base, w * 1.2);
  gg.addColorStop(0, "rgba(255,255,255,0.4)");
  gg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.ellipse(cx, base, w * 1.2, w * 0.17, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#141414";
  ctx.fillRect(x0, top, f, h);
  ctx.fillStyle = "#060606";
  ctx.beginPath();
  ctx.moveTo(x1, top);
  ctx.lineTo(x1 + sd, top - sk);
  ctx.lineTo(x1 + sd, base - sk);
  ctx.lineTo(x1, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2c2c2c";
  ctx.beginPath();
  ctx.moveTo(x0, top);
  ctx.lineTo(x0 + sd, top - sk);
  ctx.lineTo(x1 + sd, top - sk);
  ctx.lineTo(x1, top);
  ctx.closePath();
  ctx.fill();
  const by = top + h * 0.2;
  const bh = h * 0.075;
  ctx.fillStyle = gold;
  ctx.fillRect(x0, by, f, bh);
  ctx.fillStyle = "#a9823a";
  ctx.beginPath();
  ctx.moveTo(x1, by);
  ctx.lineTo(x1 + sd, by - sk);
  ctx.lineTo(x1 + sd, by - sk + bh);
  ctx.lineTo(x1, by + bh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < 12; i++) ctx.fillRect(x0 + f * (0.04 + i * 0.08), by + bh * 0.35, f * 0.05, bh * 0.3);
  const dx = x0 + f * 0.66;
  const dw = f * 0.18;
  const dy = base - h * 0.62;
  const dh = h * 0.44;
  ctx.fillStyle = gold;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = w * 0.006;
  ctx.strokeRect(dx + dw * 0.12, dy + dh * 0.06, dw * 0.76, dh * 0.88);
  ctx.beginPath();
  ctx.moveTo(dx + dw / 2, dy + dh * 0.06);
  ctx.lineTo(dx + dw / 2, dy + dh * 0.94);
  ctx.stroke();
  ctx.restore();
}

const PETALS = ["#f9a8d4", "#fda4af", "#fecdd3", "#fbcfe8"];
const LEAVES = ["#6f8f5a", "#8fae74", "#557a46"];

function flower(ctx: Ctx, x: number, y: number, r: number, n: number, petal: string, centre: string, rot: number) {
  for (let layer = 0; layer < 2; layer++) {
    const rr = layer ? r * 0.62 : r;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot + (i * TAU) / n + (layer * Math.PI) / n);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      g.addColorStop(0, layer ? "#ffffff" : "#fff5f8");
      g.addColorStop(1, petal);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -rr * 0.52, rr * 0.32, rr * 0.52, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = centre;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.27, y + Math.sin(a) * r * 0.27, r * 0.03, 0, TAU);
    ctx.fill();
  }
}

function leaf(ctx: Ctx, x: number, y: number, len: number, ang: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.3, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = len * 0.02;
  ctx.beginPath();
  ctx.moveTo(len * 0.05, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

/** A bunch of flowers and leaves growing out of a corner; rot turns it to the right corner. */
function floralCorner(ctx: Ctx, cx: number, cy: number, s: number, rot: number, rand: Rand, centre: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  for (let i = 0; i < 8; i++) {
    const a = -0.15 + (i / 7) * (Math.PI / 2 + 0.3);
    leaf(ctx, s * 0.12 * Math.cos(a), s * 0.12 * Math.sin(a), s * (0.42 + rand() * 0.28), a, LEAVES[i % LEAVES.length]);
  }
  const spots: [number, number, number][] = [
    [0.24, 0.24, 0.19],
    [0.56, 0.08, 0.12],
    [0.08, 0.56, 0.12],
    [0.47, 0.4, 0.08],
  ];
  spots.forEach(([fx, fy, fr], k) => flower(ctx, s * fx, s * fy, s * fr, k === 0 ? 6 : 5, PETALS[k % PETALS.length], centre, rand() * TAU));
  ctx.fillStyle = PETALS[1];
  for (const [bx, by] of [
    [0.72, 0.22],
    [0.22, 0.72],
    [0.66, 0.34],
  ]) {
    ctx.beginPath();
    ctx.arc(s * bx, s * by, s * 0.03, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const FESTIVE = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#facc15", "#ec4899", "#22d3ee"];
const PK_FESTIVE = ["#ffffff", "#22c55e", "#bbf7d0", "#facc15", "#15803d"];

function confetti(ctx: Ctx, W: number, H: number, rand: Rand, cols: string[], n: number, size: number, keepClear = 0.36) {
  let placed = 0;
  for (let i = 0; i < n * 4 && placed < n; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r1 = rand();
    const r2 = rand();
    const r3 = rand();
    if (((x - W / 2) / (W * keepClear)) ** 2 + ((y - H / 2) / (H * keepClear)) ** 2 < 1) continue;
    placed++;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r1 * TAU);
    const c = cols[Math.floor(r2 * cols.length)];
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    const s = size * (0.6 + r3 * 0.8);
    if (r3 < 0.45) ctx.fillRect(-s, -s * 0.42, s * 2, s * 0.84);
    else if (r3 < 0.75) {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.55, 0, TAU);
      ctx.fill();
    } else {
      ctx.lineWidth = s * 0.34;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-s * 1.4, 0);
      ctx.bezierCurveTo(-s * 0.5, -s, s * 0.5, s, s * 1.4, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function balloon(ctx: Ctx, x: number, y: number, r: number, color: string, len: number, sway: number, stringColor: string) {
  ctx.save();
  ctx.strokeStyle = stringColor;
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  const sy = y + r * 1.24;
  ctx.moveTo(x, sy);
  ctx.bezierCurveTo(x + sway, sy + len * 0.33, x - sway, sy + len * 0.66, x + sway * 0.5, sy + len);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y + r * 1.26);
  ctx.lineTo(x + r * 0.12, y + r * 1.26);
  ctx.lineTo(x, y + r * 1.12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.18, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, "rgba(255,255,255,0.25)");
  g.addColorStop(0.6, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.15, r * 0.3, 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function bunting(ctx: Ctx, W: number, y0: number, sag: number, n: number, cols: string[], s: number, line: string) {
  const P = (t: number) => ({
    x: t * W,
    y: (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * (y0 + sag * 2) + t * t * y0,
  });
  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.quadraticCurveTo(W / 2, y0 + sag * 2, W, y0);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const a = P(t - 0.01);
    const b = P(t + 0.01);
    const p = P(t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.moveTo(-s / 2, 0);
    ctx.lineTo(s / 2, 0);
    ctx.lineTo(0, s * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drip(ctx: Ctx, x: number, y: number, w: number, d: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + d * 0.5);
  const n = 7;
  for (let i = n; i > 0; i--) {
    const x1 = x + (w * i) / n;
    const x0 = x + (w * (i - 1)) / n;
    const deep = i % 2 ? d * 1.5 : d * 0.9;
    ctx.bezierCurveTo(x1, y + deep, x0, y + deep, x0, y + d * 0.5);
  }
  ctx.closePath();
  ctx.fill();
}

function cake(ctx: Ctx, cx: number, base: number, w: number, orn: string) {
  const h1 = w * 0.3;
  const w1 = w * 0.86;
  const h2 = w * 0.24;
  const w2 = w * 0.6;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(cx, base, w * 0.56, w * 0.06, 0, 0, TAU);
  ctx.fill();
  const y1 = base - h1;
  const g1 = ctx.createLinearGradient(cx - w1 / 2, 0, cx + w1 / 2, 0);
  g1.addColorStop(0, "#f472b6");
  g1.addColorStop(0.5, "#f9a8d4");
  g1.addColorStop(1, "#ec4899");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.roundRect(cx - w1 / 2, y1, w1, h1, w * 0.03);
  ctx.fill();
  drip(ctx, cx - w1 / 2, y1, w1, w * 0.05, "#fff7fb");
  ctx.fillStyle = orn;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(cx - w1 / 2 + (w1 * (i + 0.5)) / 7, y1 + h1 * 0.68, w * 0.016, 0, TAU);
    ctx.fill();
  }
  const y2 = y1 - h2;
  const g2 = ctx.createLinearGradient(cx - w2 / 2, 0, cx + w2 / 2, 0);
  g2.addColorStop(0, "#fbbf24");
  g2.addColorStop(0.5, "#fde68a");
  g2.addColorStop(1, "#f59e0b");
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.roundRect(cx - w2 / 2, y2, w2, h2, w * 0.025);
  ctx.fill();
  drip(ctx, cx - w2 / 2, y2, w2, w * 0.04, "#ffffff");
  const ch = w * 0.14;
  for (const k of [-1, 0, 1]) {
    const x = cx + k * w2 * 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - w * 0.014, y2 - ch, w * 0.028, ch);
    ctx.fillStyle = "#38bdf8";
    for (let s = 0; s < 3; s++) ctx.fillRect(x - w * 0.014, y2 - ch + (s * ch) / 3 + ch * 0.06, w * 0.028, ch * 0.1);
    glow(ctx, x, y2 - ch - w * 0.035, w * 0.08, "rgba(255,200,80,0.55)");
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(x, y2 - ch - w * 0.07);
    ctx.quadraticCurveTo(x + w * 0.028, y2 - ch - w * 0.02, x, y2 - ch - w * 0.004);
    ctx.quadraticCurveTo(x - w * 0.028, y2 - ch - w * 0.02, x, y2 - ch - w * 0.07);
    ctx.fill();
  }
  ctx.restore();
}

function firework(ctx: Ctx, x: number, y: number, r: number, color: string, rand: Rand) {
  ctx.save();
  glow(ctx, x, y, r * 0.9, hexA(color, 0.22));
  const n = 26 + Math.floor(rand() * 10);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand() * 0.08;
    const r0 = r * 0.16;
    const r1 = r * (0.72 + rand() * 0.28);
    const g = ctx.createLinearGradient(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    g.addColorStop(0, hexA(color, 0));
    g.addColorStop(1, color);
    ctx.strokeStyle = g;
    ctx.lineWidth = r * 0.014;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r1 * 1.07, y + Math.sin(a) * r1 * 1.07, r * 0.017, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function bokeh(ctx: Ctx, W: number, H: number, rand: Rand, cols: string[], n: number, m: number) {
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = m * (0.02 + rand() * 0.08);
    const c = cols[Math.floor(rand() * cols.length)];
    const a = 0.06 + rand() * 0.2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(c, a));
    g.addColorStop(0.75, hexA(c, a * 0.7));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

function cloud(ctx: Ctx, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [dx, dy, r] of [
    [0, 0, 0.18],
    [0.22, -0.1, 0.24],
    [0.48, -0.03, 0.2],
    [0.66, 0.03, 0.14],
  ]) {
    ctx.moveTo(x + dx * w + r * w, y + dy * w);
    ctx.arc(x + dx * w, y + dy * w, r * w, 0, TAU);
  }
  ctx.rect(x, y, w * 0.66, w * 0.17);
  ctx.fill();
}

function rosette(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.03;
  for (let i = 0; i < 16; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 8);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 0.12, r * 0.36, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4 + Math.PI / 8);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.3, r * 0.08, r * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, TAU);
  ctx.fill();
  ctx.lineWidth = r * 0.02;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.0, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + Math.PI / 16;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0, r * 0.035, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * palettes and designs (shared by greetings and invitations)
 * ------------------------------------------------------------------ */

type Pal = { id: string; label: string; bg: [string, string]; title: string; ink: string; soft: string; orn: string; light?: boolean };

const PALETTES: Pal[] = [
  { id: "emerald", label: "Emerald & gold", bg: ["#0b6b4f", "#022c22"], title: "#f5d77a", ink: "#ffffff", soft: "#d8f3e6", orn: "#e9c46a" },
  { id: "midnight", label: "Midnight blue", bg: ["#2a2466", "#070b1f"], title: "#f8d57e", ink: "#ffffff", soft: "#d6dcff", orn: "#f2c86b" },
  { id: "royal", label: "Royal purple", bg: ["#5b21b6", "#1a0938"], title: "#fcd772", ink: "#ffffff", soft: "#eadcff", orn: "#f4c25b" },
  { id: "maroon", label: "Maroon", bg: ["#8a1c2b", "#2e060c"], title: "#f6d58b", ink: "#fff7ed", soft: "#fde2c8", orn: "#e7b75f" },
  { id: "teal", label: "Teal", bg: ["#0f766e", "#042f2e"], title: "#fde68a", ink: "#ffffff", soft: "#d5f5ef", orn: "#f2cf6b" },
  { id: "black-gold", label: "Black & gold", bg: ["#2a2622", "#050505"], title: "#e8c372", ink: "#faf7f2", soft: "#d9d3ca", orn: "#d4a64a" },
  { id: "ivory", label: "Ivory", bg: ["#fffaf0", "#f1e2c6"], title: "#8a5a14", ink: "#3f2d1c", soft: "#6b5440", orn: "#b8893a", light: true },
  { id: "mint", label: "Mint", bg: ["#f2fdf7", "#c6efd9"], title: "#0b6b4f", ink: "#123d2e", soft: "#2f5d4b", orn: "#c08f2e", light: true },
  { id: "rose", label: "Rose", bg: ["#fff1f4", "#f9c6d8"], title: "#b0175a", ink: "#4a1d33", soft: "#7a3b58", orn: "#e0558f", light: true },
  { id: "sky", label: "Baby blue", bg: ["#f0f7ff", "#bcd9fb"], title: "#1d4ed8", ink: "#0f2350", soft: "#33507e", orn: "#4b8ef0", light: true },
  { id: "sunset", label: "Sunset", bg: ["#f97316", "#be185d"], title: "#fff3c4", ink: "#ffffff", soft: "#ffe4e6", orn: "#fde68a" },
  { id: "pakistan", label: "Pakistan green", bg: ["#04612c", "#01411c"], title: "#ffffff", ink: "#ffffff", soft: "#dff5e7", orn: "#ffffff" },
  { id: "party", label: "Party", bg: ["#6d28d9", "#db2777"], title: "#fff7d6", ink: "#ffffff", soft: "#fde8f3", orn: "#fde047" },
];
const PAL: Record<string, Pal> = Object.fromEntries(PALETTES.map((p) => [p.id, p]));

type Insets = { t: number; b: number; l: number; r: number };
type DesignFn = (ctx: Ctx, W: number, H: number, p: Pal, rand: Rand) => Insets;

function paintBg(ctx: Ctx, W: number, H: number, p: Pal) {
  const g = ctx.createLinearGradient(0, 0, W * 0.45, H);
  g.addColorStop(0, p.bg[0]);
  g.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.7);
  r.addColorStop(0, p.light ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
}

const tallOf = (W: number, H: number) => H / W > 1.3;

const DESIGN_FNS: Record<string, DesignFn> = {
  crescent(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    starField(ctx, W, H * 0.75, m, rand, p.light ? p.orn : "#ffffff", Math.round(110 * (H / W)));
    const R = m * 0.085;
    const cy = m * 0.15;
    glow(ctx, W / 2, cy, R * 3.2, hexA(p.orn, 0.25));
    ctx.fillStyle = p.orn;
    crescentStar(ctx, W / 2, cy, R, -0.55);
    const mh = m * (tallOf(W, H) ? 0.25 : 0.19);
    skyline(ctx, W, H, mh, p.orn);
    return { t: cy + R + m * 0.05, b: mh + m * 0.045, l: W * 0.08, r: W * 0.08 };
  },
  lanterns(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    bokeh(ctx, W, H, rand, [p.orn, "#ffffff"], 18, m);
    starField(ctx, W, H, m, rand, p.light ? p.orn : "#ffffff", 50);
    lantern(ctx, W * 0.1, 0, m * 0.2, m * 0.13, p.orn);
    lantern(ctx, W * 0.9, 0, m * 0.1, m * 0.15, p.orn);
    lantern(ctx, W * 0.23, 0, m * 0.05, m * 0.085, p.orn);
    lantern(ctx, W * 0.77, 0, m * 0.26, m * 0.085, p.orn);
    ctx.fillStyle = hexA(p.orn, 0.9);
    crescentStar(ctx, W / 2, H - m * 0.07, m * 0.03, -0.55);
    return { t: m * 0.11, b: m * 0.13, l: W * 0.17, r: W * 0.17 };
  },
  arabesque(ctx, W, H, p) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    starPattern(ctx, W, H, m * 0.12, p.orn, p.light ? 0.2 : 0.14, m * 0.0025);
    const r = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55);
    r.addColorStop(0, hexA(p.light ? p.bg[0] : p.bg[1], 0.85));
    r.addColorStop(0.7, hexA(p.light ? p.bg[0] : p.bg[1], 0.5));
    r.addColorStop(1, hexA(p.light ? p.bg[0] : p.bg[1], 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
    ornateFrame(ctx, W, H, m * 0.045, p.orn, m);
    ctx.fillStyle = p.orn;
    crescentStar(ctx, W / 2, m * 0.12, m * 0.035, -0.55);
    return { t: m * 0.18, b: m * 0.12, l: m * 0.12, r: m * 0.12 };
  },
  arch(ctx, W, H, p) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    starPattern(ctx, W, H, m * 0.1, p.orn, p.light ? 0.18 : 0.12, m * 0.002);
    const aw = W * 0.8;
    const ax = (W - aw) / 2;
    const ay = m * 0.06;
    const bottom = H - m * 0.05;
    ctx.save();
    archPath(ctx, ax, ay, aw, bottom);
    const g = ctx.createLinearGradient(0, ay, 0, bottom);
    g.addColorStop(0, p.light ? "#ffffff" : hexA(p.bg[0], 1));
    g.addColorStop(1, p.light ? p.bg[0] : p.bg[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = p.orn;
    ctx.lineWidth = m * 0.008;
    ctx.stroke();
    const ins = m * 0.02;
    archPath(ctx, ax + ins, ay + ins * 1.4, aw - ins * 2, bottom - ins);
    ctx.lineWidth = m * 0.0025;
    ctx.stroke();
    ctx.restore();
    lantern(ctx, W / 2, ay + m * 0.03, m * 0.04, m * 0.085, p.orn);
    return { t: ay + m * 0.22, b: m * 0.1, l: ax + m * 0.09, r: ax + m * 0.09 };
  },
  kaaba(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    starField(ctx, W, H * 0.6, m, rand, p.light ? p.orn : "#ffffff", 80);
    const kw = m * (tallOf(W, H) ? 0.34 : 0.27);
    const base = H - m * 0.05;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = p.orn;
    const ox = W / 2;
    const oy = base - kw * 0.5;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a - 0.05) * H * 1.5, oy + Math.sin(a - 0.05) * H * 1.5);
      ctx.lineTo(ox + Math.cos(a + 0.05) * H * 1.5, oy + Math.sin(a + 0.05) * H * 1.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    glow(ctx, ox, oy, kw * 1.3, hexA(p.orn, 0.3));
    kaaba(ctx, W / 2 - kw * 0.08, base, kw);
    ctx.fillStyle = p.orn;
    crescentStar(ctx, W / 2, m * 0.09, m * 0.03, -0.55);
    return { t: m * 0.14, b: m * 0.05 + kw * 0.95 + m * 0.04, l: W * 0.08, r: W * 0.08 };
  },
  floral(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    speckle(ctx, W, H, rand, p.light ? "#a08060" : "#ffffff", 900, m * 0.002);
    ctx.save();
    ctx.strokeStyle = hexA(p.orn, 0.75);
    ctx.lineWidth = m * 0.003;
    ctx.strokeRect(m * 0.035, m * 0.035, W - m * 0.07, H - m * 0.07);
    ctx.restore();
    floralCorner(ctx, 0, 0, m * 0.36, 0, rand, p.orn);
    floralCorner(ctx, W, H, m * 0.36, Math.PI, rand, p.orn);
    floralCorner(ctx, W, 0, m * 0.18, Math.PI / 2, rand, p.orn);
    floralCorner(ctx, 0, H, m * 0.18, -Math.PI / 2, rand, p.orn);
    return { t: m * 0.2, b: m * 0.2, l: W * 0.12, r: W * 0.12 };
  },
  confetti(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    confetti(ctx, W, H, rand, p.id === "pakistan" ? PK_FESTIVE : FESTIVE, Math.round(150 * (H / W)), m * 0.014, 0.45);
    return { t: m * 0.1, b: m * 0.1, l: W * 0.1, r: W * 0.1 };
  },
  balloons(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    confetti(ctx, W, H, rand, FESTIVE, 50, m * 0.01, 0.42);
    const xs = [0.06, 0.2, 0.35, 0.5, 0.65, 0.8, 0.94];
    const ys = [0.17, 0.11, 0.07, 0.05, 0.07, 0.11, 0.17];
    const rs = [0.075, 0.065, 0.055, 0.05, 0.055, 0.065, 0.075];
    const cols = p.id === "pakistan" ? PK_FESTIVE : ["#f43f5e", "#f59e0b", "#3b82f6", "#a855f7", "#10b981", "#ec4899", "#facc15"];
    xs.forEach((x, i) => balloon(ctx, x * W, ys[i] * m, rs[i] * m, cols[i % cols.length], m * 0.08, m * 0.012 * (i % 2 ? 1 : -1), p.light ? hexA(p.ink, 0.4) : "rgba(255,255,255,0.6)"));
    return { t: m * 0.25, b: m * 0.09, l: W * 0.12, r: W * 0.12 };
  },
  cake(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    confetti(ctx, W, H, rand, FESTIVE, 60, m * 0.01, 0.42);
    bunting(ctx, W, m * 0.015, m * 0.05, 13, FESTIVE, m * 0.05, p.light ? hexA(p.ink, 0.4) : "rgba(255,255,255,0.6)");
    const cw = m * (tallOf(W, H) ? 0.38 : 0.3);
    cake(ctx, W / 2, H - m * 0.06, cw, p.orn);
    return { t: m * 0.17, b: m * 0.06 + cw * 0.87 + m * 0.04, l: W * 0.09, r: W * 0.09 };
  },
  fireworks(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    starField(ctx, W, H, m, rand, "#ffffff", 70);
    const cols = p.id === "pakistan" ? ["#ffffff", "#4ade80", "#fde68a", "#ffffff", "#86efac"] : ["#fde68a", "#f472b6", "#60a5fa", "#fbbf24", "#a78bfa"];
    const bursts: [number, number, number][] = [
      [0.17, 0.12, 0.14],
      [0.83, 0.15, 0.17],
      [0.5, 0.06, 0.08],
      [0.1, 0.86, 0.1],
      [0.9, 0.9, 0.12],
    ];
    bursts.forEach(([bx, by, br], i) => firework(ctx, bx * W, by * H, br * m, cols[i % cols.length], rand));
    return { t: m * 0.13, b: m * 0.1, l: W * 0.09, r: W * 0.09 };
  },
  flag(ctx, W, H, p) {
    const m = Math.min(W, H);
    const band = W * 0.24;
    const g = ctx.createLinearGradient(0, 0, W * 0.45, H);
    g.addColorStop(0, "#03602b");
    g.addColorStop(1, "#01411c");
    ctx.fillStyle = p.id === "pakistan" ? g : p.bg[1];
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, band, H);
    // fabric folds
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * W;
      const fg = ctx.createLinearGradient(x, 0, x + W / 6, 0);
      fg.addColorStop(0, "rgba(0,0,0,0.07)");
      fg.addColorStop(0.5, "rgba(255,255,255,0.06)");
      fg.addColorStop(1, "rgba(0,0,0,0.07)");
      ctx.fillStyle = fg;
      ctx.fillRect(x, 0, W / 6, H);
    }
    const cx = band + (W - band) / 2;
    ctx.fillStyle = "#ffffff";
    crescentStar(ctx, cx, m * 0.15, m * 0.075, -Math.PI / 4);
    return { t: m * 0.27, b: m * 0.09, l: band + W * 0.05, r: W * 0.05 };
  },
  bokeh(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    bokeh(ctx, W, H, rand, [p.orn, p.title, "#ffffff"], Math.round(55 * (H / W)), m);
    ctx.save();
    ctx.fillStyle = p.light ? p.orn : "#ffffff";
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.4 + rand() * 0.6;
      sparkle(ctx, rand() * W, rand() * H, m * (0.006 + rand() * 0.012));
    }
    ctx.restore();
    return { t: m * 0.1, b: m * 0.1, l: W * 0.09, r: W * 0.09 };
  },
  minimal(ctx, W, H, p) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    ctx.save();
    ctx.strokeStyle = p.orn;
    ctx.lineWidth = m * 0.004;
    ctx.strokeRect(m * 0.04, m * 0.04, W - m * 0.08, H - m * 0.08);
    ctx.lineWidth = m * 0.0015;
    ctx.strokeRect(m * 0.055, m * 0.055, W - m * 0.11, H - m * 0.11);
    ctx.restore();
    ornamentLine(ctx, W / 2, m * 0.12, m * 0.34, m * 0.035, p.orn);
    ornamentLine(ctx, W / 2, H - m * 0.12, m * 0.34, m * 0.035, p.orn);
    return { t: m * 0.17, b: m * 0.17, l: W * 0.1, r: W * 0.1 };
  },
  royal(ctx, W, H, p) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    starPattern(ctx, W, H, m * 0.11, p.orn, p.light ? 0.14 : 0.09, m * 0.002);
    if (!p.light) vignette(ctx, W, H, 0.35);
    ornateFrame(ctx, W, H, m * 0.04, p.orn, m);
    rosette(ctx, W / 2, m * 0.15, m * 0.065, p.orn);
    return { t: m * 0.25, b: m * 0.11, l: m * 0.12, r: m * 0.12 };
  },
  baby(ctx, W, H, p, rand) {
    const m = Math.min(W, H);
    paintBg(ctx, W, H, p);
    const c = p.light ? "#ffffff" : "rgba(255,255,255,0.14)";
    cloud(ctx, -m * 0.05, H - m * 0.05, m * 0.42, c);
    cloud(ctx, W - m * 0.3, H - m * 0.02, m * 0.36, c);
    cloud(ctx, W * 0.62, m * 0.2, m * 0.2, hexA("#ffffff", p.light ? 0.75 : 0.1));
    ctx.save();
    ctx.strokeStyle = hexA(p.orn, 0.7);
    ctx.lineWidth = m * 0.002;
    ctx.fillStyle = p.orn;
    const hang: [number, number, number][] = [
      [0.14, 0.09, 0.028],
      [0.3, 0.15, 0.022],
      [0.7, 0.12, 0.024],
      [0.86, 0.07, 0.03],
    ];
    for (const [hx, hl, hr] of hang) {
      ctx.beginPath();
      ctx.moveTo(hx * W, 0);
      ctx.lineTo(hx * W, hl * m);
      ctx.stroke();
      star5(ctx, hx * W, hl * m + hr * m, hr * m, 0);
    }
    crescent(ctx, W / 2, m * 0.11, m * 0.06, -0.4);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 14; i++) sparkle(ctx, rand() * W, rand() * H, m * (0.005 + rand() * 0.01));
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = hexA(p.orn, 0.6);
    ctx.setLineDash([m * 0.012, m * 0.01]);
    ctx.lineWidth = m * 0.003;
    ctx.strokeRect(m * 0.035, m * 0.035, W - m * 0.07, H - m * 0.07);
    ctx.restore();
    return { t: m * 0.22, b: m * 0.13, l: W * 0.1, r: W * 0.1 };
  },
};

type EnFontId = "vibes" | "playfair" | "cinzel" | "poppins" | "dancing";
type UrFontId = "nastaliq" | "ruqaa" | "kufi" | "naskh";

const DESIGNS: Record<string, { label: string; en: EnFontId; body: "serif" | "sans" }> = {
  crescent: { label: "Moon & mosque", en: "playfair", body: "serif" },
  lanterns: { label: "Lanterns", en: "vibes", body: "serif" },
  arabesque: { label: "Arabesque", en: "cinzel", body: "serif" },
  arch: { label: "Mihrab arch", en: "playfair", body: "serif" },
  kaaba: { label: "Kaaba", en: "cinzel", body: "serif" },
  floral: { label: "Floral", en: "vibes", body: "serif" },
  confetti: { label: "Confetti", en: "poppins", body: "sans" },
  balloons: { label: "Balloons", en: "dancing", body: "sans" },
  cake: { label: "Cake", en: "dancing", body: "sans" },
  fireworks: { label: "Fireworks", en: "poppins", body: "sans" },
  flag: { label: "Flag", en: "poppins", body: "sans" },
  bokeh: { label: "Glow", en: "vibes", body: "serif" },
  minimal: { label: "Minimal", en: "cinzel", body: "serif" },
  royal: { label: "Royal", en: "cinzel", body: "serif" },
  baby: { label: "Moon & stars", en: "dancing", body: "sans" },
};

const EN_FONTS: Record<EnFontId, { label: string; family: string; weight: number; scale: number; lh: number; tracking?: number }> = {
  vibes: { label: "Script", family: FAM.vibes, weight: 400, scale: 1.25, lh: 1.15 },
  playfair: { label: "Serif", family: FAM.playfair, weight: 700, scale: 1, lh: 1.15 },
  cinzel: { label: "Classic", family: FAM.cinzel, weight: 700, scale: 0.82, lh: 1.25, tracking: 4 },
  poppins: { label: "Bold", family: FAM.poppins, weight: 700, scale: 0.9, lh: 1.15 },
  dancing: { label: "Playful", family: FAM.dancing, weight: 700, scale: 1.08, lh: 1.15 },
};

const UR_FONTS: Record<UrFontId, { label: string; family: string; weight: number; scale: number; lh: number; spec: string }> = {
  nastaliq: { label: "Nastaliq", family: FAM.nastaliq, weight: 700, scale: 1, lh: 1.75, spec: fs(700, FAM.nastaliq, AR_SAMPLE) },
  ruqaa: { label: "Ruqaa", family: FAM.ruqaa, weight: 700, scale: 1.08, lh: 1.45, spec: fs(700, FAM.ruqaa, AR_SAMPLE) },
  kufi: { label: "Kufi", family: FAM.kufi, weight: 700, scale: 0.95, lh: 1.4, spec: fs(700, FAM.kufi, AR_SAMPLE) },
  naskh: { label: "Naskh", family: FAM.naskh, weight: 700, scale: 1.05, lh: 1.5, spec: fs(700, FAM.naskh, AR_SAMPLE) },
};

/* ------------------------------------------------------------------ *
 * 1. greeting cards
 * ------------------------------------------------------------------ */

type Occasion = {
  id: string;
  label: string;
  ur: string;
  en: string;
  tag?: string;
  file: string;
  designs: { d: string; pal: string }[];
  msgs: { en: string[]; ur: string[] };
};

const OCCASIONS: Occasion[] = [
  {
    id: "eid-ul-fitr",
    label: "Eid ul Fitr",
    ur: "عید مبارک",
    en: "Eid Mubarak",
    file: "eid-mubarak",
    designs: [
      { d: "crescent", pal: "emerald" },
      { d: "lanterns", pal: "midnight" },
      { d: "arabesque", pal: "royal" },
      { d: "arch", pal: "teal" },
      { d: "floral", pal: "ivory" },
      { d: "minimal", pal: "black-gold" },
    ],
    msgs: {
      en: [
        "May Allah accept your fasts and prayers, and fill your home with peace, joy and barakah. Eid Mubarak!",
        "Wishing you and your family a blessed Eid full of happiness, good health and sweet moments together.",
      ],
      ur: [
        "اللہ تعالیٰ آپ کے روزے اور عبادات قبول فرمائے۔ آپ کو اور آپ کے گھر والوں کو عید کی ڈھیروں خوشیاں مبارک ہوں۔",
        "عید کا چاند آپ کی زندگی میں خوشیوں کی روشنی لے کر آئے۔ عید مبارک!",
      ],
    },
  },
  {
    id: "eid-ul-adha",
    label: "Eid ul Adha",
    ur: "عید الاضحیٰ مبارک",
    en: "Eid ul Adha Mubarak",
    file: "eid-ul-adha-mubarak",
    designs: [
      { d: "kaaba", pal: "midnight" },
      { d: "crescent", pal: "teal" },
      { d: "arabesque", pal: "maroon" },
      { d: "arch", pal: "emerald" },
      { d: "floral", pal: "ivory" },
      { d: "minimal", pal: "black-gold" },
    ],
    msgs: {
      en: [
        "May Allah accept your sacrifice and bless you with happiness, peace and prosperity. Eid ul Adha Mubarak!",
        "On this blessed Eid, may your home be filled with faith, gratitude and the joy of sharing.",
      ],
      ur: [
        "اللہ تعالیٰ آپ کی قربانی قبول فرمائے اور آپ کو ڈھیروں خوشیاں عطا کرے۔ عید الاضحیٰ مبارک!",
        "قربانی کا یہ تہوار آپ کے گھر میں برکت، محبت اور سکون لائے۔",
      ],
    },
  },
  {
    id: "jumma",
    label: "Jumma Mubarak",
    ur: "جمعہ مبارک",
    en: "Jumma Mubarak",
    file: "jumma-mubarak",
    designs: [
      { d: "arch", pal: "emerald" },
      { d: "crescent", pal: "midnight" },
      { d: "arabesque", pal: "teal" },
      { d: "floral", pal: "mint" },
      { d: "minimal", pal: "black-gold" },
    ],
    msgs: {
      en: [
        "May Allah bless your Friday with peace, accept your duas and forgive your sins. Jumma Mubarak!",
        "Don't forget Surah Al-Kahf and plenty of durood today. Remember me in your prayers.",
      ],
      ur: [
        "اللہ تعالیٰ آپ کے جمعہ کو برکتوں سے بھر دے اور آپ کی تمام دعائیں قبول فرمائے۔",
        "آج سورۃ الکہف کی تلاوت اور کثرت سے درود شریف پڑھنا نہ بھولیں۔ دعاؤں میں یاد رکھیے گا۔",
      ],
    },
  },
  {
    id: "ramadan",
    label: "Ramadan",
    ur: "رمضان مبارک",
    en: "Ramadan Mubarak",
    file: "ramadan-mubarak",
    designs: [
      { d: "lanterns", pal: "royal" },
      { d: "crescent", pal: "midnight" },
      { d: "arabesque", pal: "emerald" },
      { d: "arch", pal: "maroon" },
      { d: "minimal", pal: "ivory" },
    ],
    msgs: {
      en: [
        "May this Ramadan bring you closer to Allah and fill your days with patience, mercy and light.",
        "Wishing you a blessed month of fasting, forgiveness and good deeds. Ramadan Kareem!",
      ],
      ur: [
        "اللہ تعالیٰ اس رمضان کو آپ کے لیے رحمتوں، برکتوں اور مغفرت کا ذریعہ بنائے۔",
        "رمضان کا مبارک مہینہ آپ اور آپ کے گھر والوں کو مبارک ہو۔ دعاؤں میں یاد رکھیں۔",
      ],
    },
  },
  {
    id: "birthday",
    label: "Birthday",
    ur: "سالگرہ مبارک",
    en: "Happy Birthday",
    file: "happy-birthday",
    designs: [
      { d: "balloons", pal: "sky" },
      { d: "confetti", pal: "party" },
      { d: "cake", pal: "rose" },
      { d: "bokeh", pal: "royal" },
      { d: "floral", pal: "ivory" },
      { d: "minimal", pal: "black-gold" },
    ],
    msgs: {
      en: [
        "Wishing you a day full of laughter, love and cake — and a year full of good news. Happy Birthday!",
        "May all your dreams come true. Have the happiest of birthdays!",
      ],
      ur: [
        "آپ کو سالگرہ بہت بہت مبارک ہو! اللہ تعالیٰ آپ کو لمبی، صحت مند اور خوشیوں بھری زندگی عطا فرمائے۔",
        "سالگرہ کا یہ دن آپ کی زندگی میں ڈھیروں خوشیاں لائے۔",
      ],
    },
  },
  {
    id: "14-august",
    label: "14 August",
    ur: "جشنِ آزادی مبارک",
    en: "Happy Independence Day",
    tag: "14 August",
    file: "14-august-independence-day",
    designs: [
      { d: "flag", pal: "pakistan" },
      { d: "fireworks", pal: "pakistan" },
      { d: "crescent", pal: "pakistan" },
      { d: "confetti", pal: "pakistan" },
      { d: "arabesque", pal: "pakistan" },
    ],
    msgs: {
      en: [
        "Celebrating the land we love. May Pakistan always shine with peace, unity and progress. Pakistan Zindabad!",
        "Proud to be Pakistani. Happy 14th August to you and your family!",
      ],
      ur: [
        "یومِ آزادی کی ڈھیروں مبارکباد! اللہ تعالیٰ پاکستان کو ہمیشہ سلامت اور شاد و آباد رکھے۔ پاکستان زندہ باد!",
        "آئیے مل کر اپنے پیارے وطن کو مضبوط اور خوشحال بنائیں۔ جشنِ آزادی مبارک!",
      ],
    },
  },
  {
    id: "new-year",
    label: "New Year",
    ur: "نیا سال مبارک",
    en: "Happy New Year",
    file: "happy-new-year",
    designs: [
      { d: "fireworks", pal: "midnight" },
      { d: "bokeh", pal: "black-gold" },
      { d: "confetti", pal: "party" },
      { d: "balloons", pal: "sunset" },
      { d: "minimal", pal: "ivory" },
    ],
    msgs: {
      en: [
        "May the new year bring you good health, new chances and plenty of reasons to smile.",
        "Cheers to new beginnings! Wishing you a peaceful and successful year ahead.",
      ],
      ur: [
        "نیا سال آپ کے لیے صحت، کامیابی اور ڈھیروں خوشیاں لے کر آئے۔",
        "اللہ کرے یہ سال آپ کی زندگی کا سب سے خوبصورت سال ثابت ہو۔",
      ],
    },
  },
];
const OCC: Record<string, Occasion> = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

const PREFIXES = [
  { value: "From:", label: "From:" },
  { value: "With love,", label: "With love," },
  { value: "Best wishes,", label: "Best wishes," },
  { value: "منجانب:", label: "منجانب" },
  { value: "", label: "Name only" },
];

/** The year a New Year card is most likely for (from July onwards: next year). */
function newYearNumber() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

type GreetScene = {
  occ: Occasion;
  design: string;
  pal: Pal;
  ur: string;
  en: string;
  showUr: boolean;
  showEn: boolean;
  urFont: UrFontId;
  enFont: EnFontId;
  to: string;
  msg: string;
  from: string;
  prefix: string;
  photo: HTMLImageElement | null;
};

const renderGreeting: Renderer<GreetScene> = (ctx, W, H, s) => {
  const m = Math.min(W, H);
  const u = m / 1080;
  const k = tallOf(W, H) ? 1.12 : 1;
  const p = s.pal;
  const ins = DESIGN_FNS[s.design](ctx, W, H, p, rng(hashStr(s.design + p.id)));
  const box = { x: ins.l, y: ins.t, w: W - ins.l - ins.r, h: H - ins.t - ins.b };
  const sh = p.light ? null : SHADOW;
  const uf = UR_FONTS[s.urFont];
  const ef = EN_FONTS[s.enFont];
  const d = DESIGNS[s.design];
  const body = d.body === "sans" ? { family: FAM.poppins, weight: 500, italic: false } : { family: FAM.playfair, weight: 400, italic: true };
  const items: Item[] = [];
  const ur = s.showUr ? s.ur.trim() : "";
  const en = s.showEn ? s.en.trim() : "";
  if (s.occ.tag) items.push(T({ text: s.occ.tag.toUpperCase(), family: FAM.cinzel, weight: 700, size: 34 * u, color: p.soft, tracking: 8 * u, maxLines: 1, gap: 12 * u }));
  if (ur) items.push(T({ text: ur, family: uf.family, weight: uf.weight, size: 168 * u * k * uf.scale, color: p.title, lh: uf.lh, maxLines: 2, keepLines: true, shadow: sh, gap: 4 * u }));
  if (en) {
    const big = !ur;
    items.push(
      isRtl(en)
        ? TA(en, FAM.nastaliq, { weight: 700, size: (big ? 150 : 90) * u * k, color: big ? p.title : p.ink, maxLines: 2, shadow: sh, gap: 26 * u })
        : T({
            text: en,
            family: ef.family,
            weight: ef.weight,
            size: (big ? 136 : 92) * u * k * ef.scale,
            color: big ? p.title : p.ink,
            lh: ef.lh,
            maxLines: 2,
            tracking: ef.tracking ? ef.tracking * u : 0,
            shadow: sh,
            gap: 26 * u,
          }),
    );
  }
  if (s.photo) items.push({ kind: "photo", img: s.photo, d: 300 * u * k, ring: p.orn, gap: 26 * u });
  if (s.to.trim()) items.push(TA(s.to.trim(), FAM.vibes, { size: 84 * u * k, color: p.title, maxLines: 1, lh: 1.15, shadow: sh, gap: 12 * u }));
  if (s.msg.trim()) items.push(TA(s.msg.trim(), body.family, { weight: body.weight, italic: body.italic, size: 48 * u * k, color: p.soft, lh: 1.42, gap: 24 * u }));
  const name = s.from.trim();
  if (name) {
    const line = s.prefix ? `${s.prefix} ${name}` : name;
    items.push(divider(p.orn, 300 * u, 26 * u, 16 * u));
    items.push(TA(line, FAM.playfair, { weight: 600, italic: true, size: 52 * u * k, color: p.title, maxLines: 2, shadow: sh }));
  }
  layoutStack(ctx, items, box, "center");
};

/* ------------------------------------------------------------------ *
 * 2. quotes and Urdu poetry
 * ------------------------------------------------------------------ */

type QuoteBg = {
  id: string;
  label: string;
  ink: string;
  soft: string;
  accent: string;
  light: boolean;
  /** extra left padding (fraction of the short side), e.g. the notebook margin */
  padL?: number;
  draw: (ctx: Ctx, W: number, H: number, rand: Rand) => void;
};

function linear(ctx: Ctx, W: number, H: number, stops: string[], vertical = false) {
  const g = vertical ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, H);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

const QUOTE_BGS: QuoteBg[] = [
  {
    id: "emerald",
    label: "Emerald",
    ink: "#fdf6e3",
    soft: "#d8f3e6",
    accent: "#e9c46a",
    light: false,
    draw: (ctx, W, H) => {
      linear(ctx, W, H, ["#0b6b4f", "#03382a"]);
      glow(ctx, W / 2, H * 0.35, Math.max(W, H) * 0.6, "rgba(255,255,255,0.09)");
    },
  },
  {
    id: "midnight",
    label: "Night sky",
    ink: "#ffffff",
    soft: "#d6dcff",
    accent: "#f8d57e",
    light: false,
    draw: (ctx, W, H, rand) => {
      linear(ctx, W, H, ["#1e1b4b", "#070b1f"], true);
      starField(ctx, W, H, Math.min(W, H), rand, "#ffffff", Math.round(140 * (H / W)));
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    ink: "#ffffff",
    soft: "#ffe4e6",
    accent: "#fff3c4",
    light: false,
    draw: (ctx, W, H) => linear(ctx, W, H, ["#f97316", "#db2777", "#7c3aed"]),
  },
  {
    id: "ocean",
    label: "Ocean",
    ink: "#ffffff",
    soft: "#e0f2fe",
    accent: "#a5f3fc",
    light: false,
    draw: (ctx, W, H) => linear(ctx, W, H, ["#06b6d4", "#2563eb", "#1e3a8a"]),
  },
  {
    id: "charcoal",
    label: "Charcoal",
    ink: "#fafafa",
    soft: "#a1a1aa",
    accent: "#e4e4e7",
    light: false,
    draw: (ctx, W, H, rand) => {
      ctx.fillStyle = "#1c1c1f";
      ctx.fillRect(0, 0, W, H);
      speckle(ctx, W, H, rand, "#ffffff", 2500, 1.4);
      vignette(ctx, W, H, 0.55);
    },
  },
  {
    id: "paper",
    label: "Old paper",
    ink: "#3b2a1a",
    soft: "#6b5440",
    accent: "#8b5e34",
    light: true,
    draw: (ctx, W, H, rand) => {
      ctx.fillStyle = "#f3e7cc";
      ctx.fillRect(0, 0, W, H);
      speckle(ctx, W, H, rand, "#8b6b45", 3000, 1.6);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(120,80,30,0)");
      g.addColorStop(1, "rgba(120,80,30,0.35)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
  },
  {
    id: "notebook",
    label: "Notebook",
    ink: "#1e293b",
    soft: "#475569",
    accent: "#2563eb",
    light: true,
    padL: 0.08,
    draw: (ctx, W, H) => {
      const m = Math.min(W, H);
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(96,165,250,0.45)";
      ctx.lineWidth = m * 0.002;
      ctx.beginPath();
      for (let y = m * 0.12; y < H; y += m * 0.06) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(239,68,68,0.55)";
      ctx.lineWidth = m * 0.003;
      ctx.beginPath();
      ctx.moveTo(m * 0.12, 0);
      ctx.lineTo(m * 0.12, H);
      ctx.stroke();
    },
  },
  {
    id: "rose",
    label: "Rose",
    ink: "#831843",
    soft: "#9d4b73",
    accent: "#db2777",
    light: true,
    draw: (ctx, W, H) => linear(ctx, W, H, ["#fff1f2", "#fbcfe8"]),
  },
  {
    id: "lavender",
    label: "Lavender",
    ink: "#3b0764",
    soft: "#6b4b8a",
    accent: "#7c3aed",
    light: true,
    draw: (ctx, W, H) => linear(ctx, W, H, ["#f5f3ff", "#c4b5fd"]),
  },
  {
    id: "pattern",
    label: "Islamic pattern",
    ink: "#fff7d6",
    soft: "#d5f5ef",
    accent: "#e9c46a",
    light: false,
    draw: (ctx, W, H) => {
      const m = Math.min(W, H);
      linear(ctx, W, H, ["#115e59", "#042f2e"]);
      starPattern(ctx, W, H, m * 0.11, "#e9c46a", 0.18, m * 0.0025);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55);
      g.addColorStop(0, "rgba(4,47,46,0.9)");
      g.addColorStop(1, "rgba(4,47,46,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
  },
  {
    id: "dots",
    label: "Polka dots",
    ink: "#422006",
    soft: "#78350f",
    accent: "#d97706",
    light: true,
    draw: (ctx, W, H) => {
      const m = Math.min(W, H);
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(245,158,11,0.22)";
      const step = m * 0.07;
      for (let y = 0, row = 0; y < H + step; y += step * 0.87, row++) {
        for (let x = row % 2 ? step / 2 : 0; x < W + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, m * 0.012, 0, TAU);
          ctx.fill();
        }
      }
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
      g.addColorStop(0, "rgba(254,243,199,0.95)");
      g.addColorStop(1, "rgba(254,243,199,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
  },
  {
    id: "goldframe",
    label: "Gold frame",
    ink: "#f5e7c4",
    soft: "#cbbf9f",
    accent: "#d4a64a",
    light: false,
    draw: (ctx, W, H) => {
      const m = Math.min(W, H);
      linear(ctx, W, H, ["#26221f", "#050505"]);
      ornateFrame(ctx, W, H, m * 0.04, "#d4a64a", m);
    },
  },
  {
    id: "mesh",
    label: "Aurora",
    ink: "#ffffff",
    soft: "#e2e8f0",
    accent: "#f0abfc",
    light: false,
    draw: (ctx, W, H) => {
      const m = Math.max(W, H);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);
      glow(ctx, W * 0.15, H * 0.2, m * 0.6, "rgba(34,211,238,0.55)");
      glow(ctx, W * 0.9, H * 0.35, m * 0.55, "rgba(168,85,247,0.55)");
      glow(ctx, W * 0.4, H * 0.95, m * 0.6, "rgba(244,114,182,0.5)");
      ctx.fillStyle = "rgba(15,23,42,0.25)";
      ctx.fillRect(0, 0, W, H);
    },
  },
  {
    id: "mint",
    label: "Mint",
    ink: "#064e3b",
    soft: "#2f5d4b",
    accent: "#059669",
    light: true,
    draw: (ctx, W, H) => linear(ctx, W, H, ["#ecfdf5", "#a7f3d0"]),
  },
];
const QBG: Record<string, QuoteBg> = Object.fromEntries(QUOTE_BGS.map((b) => [b.id, b]));

type QFontId = "nastaliq" | "naskh" | "playfair" | "cormorant" | "poppins" | "vibes" | "cinzel";
/** cw: average glyph width in em (Nastaliq is very compact), used to pick a starting size */
const Q_FONTS: Record<QFontId, { label: string; family: string; weight: number; italic?: boolean; lh: number; cw: number; urdu: boolean }> = {
  nastaliq: { label: "Nastaliq", family: FAM.nastaliq, weight: 400, lh: 1.95, cw: 0.24, urdu: true },
  naskh: { label: "Naskh", family: FAM.naskh, weight: 400, lh: 1.6, cw: 0.34, urdu: true },
  playfair: { label: "Playfair", family: FAM.playfair, weight: 500, lh: 1.3, cw: 0.5, urdu: false },
  cormorant: { label: "Cormorant", family: FAM.cormorant, weight: 500, italic: true, lh: 1.25, cw: 0.4, urdu: false },
  poppins: { label: "Poppins", family: FAM.poppins, weight: 600, lh: 1.3, cw: 0.56, urdu: false },
  vibes: { label: "Script", family: FAM.vibes, weight: 400, lh: 1.2, cw: 0.36, urdu: false },
  cinzel: { label: "Cinzel", family: FAM.cinzel, weight: 700, lh: 1.35, cw: 0.66, urdu: false },
};

/** Classical verses (19th and early 20th century) — long in the public domain. */
const SAMPLES: { label: string; text: string; author: string; font: QFontId }[] = [
  {
    label: "Iqbal — Khudi",
    text: "خودی کو کر بلند اتنا کہ ہر تقدیر سے پہلے\nخدا بندے سے خود پوچھے بتا تیری رضا کیا ہے",
    author: "علامہ محمد اقبال",
    font: "nastaliq",
  },
  {
    label: "Iqbal — Sitaron se aage",
    text: "ستاروں سے آگے جہاں اور بھی ہیں\nابھی عشق کے امتحاں اور بھی ہیں",
    author: "علامہ محمد اقبال",
    font: "nastaliq",
  },
  {
    label: "Iqbal — Zara nam ho",
    text: "نہیں ہے ناامید اقبالؔ اپنی کشتِ ویراں سے\nذرا نم ہو تو یہ مٹی بہت زرخیز ہے ساقی",
    author: "علامہ محمد اقبال",
    font: "nastaliq",
  },
  {
    label: "Ghalib — Hazaron khwahishen",
    text: "ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے\nبہت نکلے مرے ارمان لیکن پھر بھی کم نکلے",
    author: "مرزا غالبؔ",
    font: "nastaliq",
  },
  {
    label: "Ghalib — Dil-e-nadan",
    text: "دلِ ناداں تجھے ہوا کیا ہے\nآخر اس درد کی دوا کیا ہے",
    author: "مرزا غالبؔ",
    font: "nastaliq",
  },
  {
    label: "Ghalib — Jannat ki haqeeqat",
    text: "ہم کو معلوم ہے جنت کی حقیقت لیکن\nدل کے خوش رکھنے کو غالبؔ یہ خیال اچھا ہے",
    author: "مرزا غالبؔ",
    font: "nastaliq",
  },
  {
    label: "Shakespeare",
    text: "This above all: to thine own self be true.",
    author: "William Shakespeare, Hamlet",
    font: "playfair",
  },
  {
    label: "Emily Dickinson",
    text: "“Hope” is the thing with feathers\nThat perches in the soul",
    author: "Emily Dickinson",
    font: "cormorant",
  },
];

type QuoteScene = {
  text: string;
  author: string;
  bg: QuoteBg;
  font: QFontId;
  align: Align;
  size: number;
  shadow: boolean;
  marks: boolean;
  watermark: boolean;
};

const renderQuote: Renderer<QuoteScene> = (ctx, W, H, s) => {
  const m = Math.min(W, H);
  const u = m / 1080;
  const bg = s.bg;
  bg.draw(ctx, W, H, rng(hashStr(bg.id)));
  const text = s.text.trim();
  const rtl = isRtl(text);
  // Urdu typed with a Latin font would fall back glyph by glyph — use a real Urdu face instead
  const f = Q_FONTS[rtl && !Q_FONTS[s.font].urdu ? "nastaliq" : s.font];
  const pad = m * (bg.id === "goldframe" ? 0.14 : 0.1);
  const padL = (bg.padL ?? 0) * m;
  const wm = s.watermark ? 54 * u : 0;
  const box = { x: pad + padL, y: pad, w: W - pad * 2 - padL, h: H - pad * 2 - wm };
  const k = tallOf(W, H) ? 1.15 : 1;
  // starting size: what would fill about half the box at this font's average glyph width;
  // poetry may start larger because each misra is then fitted to the width on its own line
  const len = Math.max(10, text.replace(/\s+/g, " ").length);
  const poem = text.includes("\n");
  const fill = Math.sqrt((box.w * box.h * 0.5) / (len * f.cw * f.lh));
  const cap = Math.min(190 * u * k, fill * (poem ? 1.5 : 1)) * (s.size / 100);
  const sh = s.shadow ? (bg.light ? { color: "rgba(0,0,0,0.18)", blur: 0.1, y: 0.03 } : SHADOW) : null;
  const items: Item[] = [];
  if (s.marks && text) {
    if (rtl) items.push(divider(bg.accent, 260 * u, 30 * u, 26 * u));
    else items.push(T({ text: "“", family: FAM.playfair, weight: 700, size: 190 * u, color: bg.accent, lh: 0.62, maxLines: 1, gap: 18 * u }));
  }
  if (text)
    items.push(
      T({
        text,
        family: f.family,
        weight: f.weight,
        italic: f.italic,
        size: cap,
        color: bg.ink,
        lh: f.lh,
        keepLines: text.includes("\n") && text.split("\n").length <= 8,
        shadow: sh,
        gap: 30 * u,
      }),
    );
  const author = s.author.trim();
  if (author) {
    const line = isRtl(author) || /^[—–-]/.test(author) ? author : `— ${author}`;
    items.push(TA(line, FAM.playfair, { weight: 500, italic: true, size: 44 * u * k, color: bg.soft, maxLines: 2, lh: 1.3, shadow: sh }));
  }
  layoutStack(ctx, items, box, s.align);
  if (s.watermark) {
    ctx.save();
    ctx.font = `500 ${26 * u}px ${FAM.poppins}`;
    ctx.letterSpacing = `${2 * u}px`;
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = hexA(bg.light ? "#000000" : "#ffffff", 0.5);
    ctx.fillText("made with SnapGrab", W / 2, H - pad * 0.55);
    ctx.restore();
  }
};

/* ------------------------------------------------------------------ *
 * 3. invitations
 * ------------------------------------------------------------------ */

type InvType = "wedding" | "birthday" | "aqiqa";
type Lang = "en" | "ur";
type InvFields = {
  name1: string;
  name2: string;
  hosts: string;
  event: string;
  gender: "son" | "daughter";
  age: string;
  date: string;
  time: string;
  venue: string;
  rsvp: string;
  note: string;
};

const INV_TYPES: { id: InvType; label: string; file: string; templates: { d: string; pal: string }[] }[] = [
  {
    id: "wedding",
    label: "Wedding",
    file: "wedding-invitation",
    templates: [
      { d: "royal", pal: "maroon" },
      { d: "floral", pal: "ivory" },
      { d: "arch", pal: "emerald" },
      { d: "minimal", pal: "black-gold" },
      { d: "arabesque", pal: "midnight" },
    ],
  },
  {
    id: "birthday",
    label: "Birthday",
    file: "birthday-invitation",
    templates: [
      { d: "balloons", pal: "sky" },
      { d: "confetti", pal: "party" },
      { d: "floral", pal: "rose" },
      { d: "bokeh", pal: "royal" },
      { d: "minimal", pal: "ivory" },
    ],
  },
  {
    id: "aqiqa",
    label: "Aqiqa",
    file: "aqiqa-invitation",
    templates: [
      { d: "baby", pal: "sky" },
      { d: "floral", pal: "ivory" },
      { d: "arch", pal: "teal" },
      { d: "baby", pal: "rose" },
      { d: "minimal", pal: "mint" },
    ],
  },
];
const INV: Record<InvType, (typeof INV_TYPES)[number]> = Object.fromEntries(INV_TYPES.map((t) => [t.id, t])) as Record<
  InvType,
  (typeof INV_TYPES)[number]
>;

const WEDDING_EVENTS = [
  { id: "shadi", en: "Wedding Ceremony", ur: "تقریبِ شادی" },
  { id: "nikah", en: "Nikah Ceremony", ur: "تقریبِ نکاح" },
  { id: "mehndi", en: "Mehndi Night", ur: "رسمِ مہندی" },
  { id: "baraat", en: "Baraat", ur: "بارات" },
  { id: "walima", en: "Walima Reception", ur: "دعوتِ ولیمہ" },
];

const BLANK: InvFields = { name1: "", name2: "", hosts: "", event: "shadi", gender: "son", age: "", date: "", time: "", venue: "", rsvp: "", note: "" };

/** Sample values in each language — swapped when the language changes, unless the user edited them. */
const INV_SAMPLES: Record<InvType, Record<Lang, Partial<InvFields>>> = {
  wedding: {
    en: { name1: "Ali", name2: "Ayesha", hosts: "Mr. & Mrs. Tariq Mehmood", venue: "Pearl Banquet Hall, Main Boulevard, Lahore", note: "Dinner will be served" },
    ur: { name1: "علی", name2: "عائشہ", hosts: "جناب و بیگم طارق محمود", venue: "پرل بینکوئٹ ہال، مین بلیوارڈ، لاہور", note: "کھانے کا اہتمام کیا گیا ہے" },
  },
  birthday: {
    en: { name1: "Zara", hosts: "Ahmed & Sana", venue: "House 12, Street 4, Islamabad", note: "Fun, games & cake!" },
    ur: { name1: "زارا", hosts: "احمد اور ثنا", venue: "مکان نمبر 12، گلی نمبر 4، اسلام آباد", note: "کیک، کھیل اور ڈھیر ساری خوشیاں!" },
  },
  aqiqa: {
    en: { name1: "Muhammad Ibrahim", hosts: "Mr. & Mrs. Usman Ali", venue: "Pearl Banquet Hall, Shahrah-e-Faisal, Karachi", note: "Your presence and duas are the best gift." },
    ur: { name1: "محمد ابراہیم", hosts: "جناب و بیگم عثمان علی", venue: "پرل بینکوئٹ ہال، شاہراہِ فیصل، کراچی", note: "آپ کی شرکت اور دعائیں ہمارے لیے بہترین تحفہ ہیں۔" },
  },
};

const INV_DEFAULTS: Record<InvType, InvFields> = {
  wedding: { ...BLANK, ...INV_SAMPLES.wedding.en, time: "19:30", rsvp: "0300 1234567" },
  birthday: { ...BLANK, ...INV_SAMPLES.birthday.en, age: "5", time: "16:00", rsvp: "0300 1234567" },
  aqiqa: { ...BLANK, ...INV_SAMPLES.aqiqa.en, time: "13:00", rsvp: "0300 1234567" },
};

const BISMILLAH = "بسم الله الرحمن الرحيم";

function ordinalEn(n: number) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
const UR_ORD: Record<number, string> = { 1: "پہلی", 2: "دوسری", 3: "تیسری", 4: "چوتھی", 5: "پانچویں", 6: "چھٹی", 7: "ساتویں", 8: "آٹھویں", 9: "نویں", 10: "دسویں" };
const ordinalUr = (n: number) => UR_ORD[n] ?? `${n}ویں`;

function fmtDate(iso: string, lang: Lang) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtTime(hm: string, lang: Lang) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  if (!m) return "";
  const h = Number(m[1]);
  const h12 = h % 12 || 12;
  if (lang === "en") return `${h12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
  const part = h < 5 ? "رات" : h < 12 ? "صبح" : h < 16 ? "دوپہر" : h < 20 ? "شام" : "رات";
  return `${part} ${h12}:${m[2]} بجے`;
}

type InvScene = { type: InvType; tpl: string; pal: Pal; lang: Lang; bismillah: boolean; f: InvFields };

function inviteItems(s: InvScene, u: number): Item[] {
  const p = s.pal;
  const f = s.f;
  const ur = s.lang === "ur";
  const sh = p.light ? null : { ...SHADOW, color: "rgba(0,0,0,0.28)" };
  const it: Item[] = [];
  const add = (text: string, family: string, o: Omit<TextItem, "kind" | "text" | "family">) => {
    if (text.trim()) it.push(TA(text.trim(), family, o));
  };
  const date = fmtDate(f.date, s.lang);
  const time = fmtTime(f.time, s.lang);
  const names = () => {
    add(f.name1, FAM.vibes, { size: 150 * u, color: p.title, maxLines: 1, lh: 1.12, shadow: sh, gap: 0 });
    if (f.name1.trim() && f.name2.trim()) add("&", FAM.vibes, { size: 90 * u, color: p.orn, maxLines: 1, lh: 0.95, gap: 0 });
    add(f.name2, FAM.vibes, { size: 150 * u, color: p.title, maxLines: 1, lh: 1.12, shadow: sh, gap: 0 });
  };
  const details = () => {
    it.push(divider(p.orn, 420 * u, 34 * u, 30 * u));
    if (ur) {
      add(date && `تاریخ: ${date}`, FAM.nastaliq, { weight: 700, size: 42 * u, color: p.ink, maxLines: 2, gap: 2 * u });
      add(time && `وقت: ${time}`, FAM.nastaliq, { weight: 700, size: 42 * u, color: p.ink, maxLines: 1, gap: 2 * u });
      add(f.venue && `بمقام: ${f.venue}`, FAM.nastaliq, { size: 40 * u, color: p.ink, maxLines: 3, gap: 22 * u });
    } else {
      add(date.toUpperCase(), FAM.cinzel, { weight: 700, size: 44 * u, color: p.ink, tracking: 3 * u, maxLines: 2, lh: 1.3, gap: 8 * u });
      add(time && `at ${time}`, FAM.cormorant, { weight: 500, italic: true, size: 46 * u, color: p.soft, maxLines: 1, gap: 22 * u });
      add(f.venue, FAM.playfair, { weight: 500, size: 42 * u, color: p.ink, maxLines: 3, lh: 1.3, gap: 26 * u });
    }
  };
  const tail = (hostLine?: string) => {
    add(f.note, FAM.cormorant, { weight: 500, italic: true, size: 42 * u, color: p.soft, maxLines: 3, lh: 1.25, gap: 18 * u });
    if (hostLine) add(hostLine, FAM.playfair, { weight: 500, italic: true, size: 38 * u, color: p.soft, maxLines: 2, gap: 14 * u });
    const rsvp = f.rsvp.trim();
    // the isolate keeps "0300 1234567" in left-to-right order inside an Urdu line
    if (rsvp) add(ur ? `رابطہ: ⁦${rsvp}⁩` : `RSVP · ${rsvp}`, FAM.poppins, { weight: 600, size: 32 * u, color: p.title, tracking: 2 * u, maxLines: 1 });
  };
  const bism = () => {
    if (s.bismillah) it.push(T({ text: BISMILLAH, family: FAM.naskh, weight: 700, size: 60 * u, color: p.title, lh: 1.6, maxLines: 1, gap: 26 * u }));
  };

  if (s.type === "wedding") {
    const ev = WEDDING_EVENTS.find((e) => e.id === f.event) ?? WEDDING_EVENTS[0];
    bism();
    if (ur) {
      add(ev.ur, FAM.nastaliq, { weight: 700, size: 100 * u, color: p.title, maxLines: 1, shadow: sh, gap: 10 * u });
      names();
      it.push({ kind: "draw", h: 26 * u, draw: () => {} });
      add(f.hosts, FAM.playfair, { weight: 700, size: 44 * u, color: p.ink, maxLines: 2, gap: 2 * u });
      add(
        f.hosts.trim() ? "آپ کو اس پُرمسرت موقع پر شرکت کی پُرخلوص دعوت دیتے ہیں" : "آپ کو اس پُرمسرت موقع پر شرکت کی پُرخلوص دعوت دی جاتی ہے",
        FAM.nastaliq,
        { size: 40 * u, color: p.soft, maxLines: 2, gap: 6 * u },
      );
    } else {
      add(f.hosts, FAM.playfair, { weight: 600, size: 46 * u, color: p.ink, maxLines: 2, lh: 1.25, gap: 10 * u });
      add(f.hosts.trim() ? "request the pleasure of your company at the" : "You are cordially invited to the", FAM.cormorant, {
        weight: 500,
        italic: true,
        size: 44 * u,
        color: p.soft,
        maxLines: 2,
        gap: 24 * u,
      });
      add(ev.en.toUpperCase(), FAM.cinzel, { weight: 700, size: 62 * u, color: p.title, tracking: 6 * u, maxLines: 2, shadow: sh, gap: 14 * u });
      if (f.name1.trim() || f.name2.trim()) add("of", FAM.cormorant, { weight: 500, italic: true, size: 40 * u, color: p.soft, maxLines: 1, gap: 4 * u });
      names();
    }
    details();
    tail();
  } else if (s.type === "birthday") {
    const n = parseInt(f.age, 10);
    const has = Number.isFinite(n) && n > 0 && n < 150;
    if (ur) {
      add("دعوتِ سالگرہ", FAM.nastaliq, { weight: 700, size: 96 * u, color: p.title, maxLines: 1, shadow: sh, gap: 6 * u });
      add(f.name1, FAM.dancing, { weight: 700, size: 130 * u, color: p.title, maxLines: 1, lh: 1.15, shadow: sh, gap: 6 * u });
      add(has ? `کی ${ordinalUr(n)} سالگرہ کے موقع پر آپ مدعو ہیں` : "کی سالگرہ کے موقع پر آپ مدعو ہیں", FAM.nastaliq, { size: 44 * u, color: p.soft, maxLines: 2, gap: 6 * u });
      details();
      tail(f.hosts.trim() ? `منجانب: ${f.hosts.trim()}` : undefined);
    } else {
      add("YOU'RE INVITED", FAM.poppins, { weight: 700, size: 40 * u, color: p.orn, tracking: 8 * u, maxLines: 1, gap: 14 * u });
      add("Join us to celebrate", FAM.cormorant, { weight: 500, italic: true, size: 50 * u, color: p.soft, maxLines: 1, gap: 8 * u });
      add(f.name1, FAM.dancing, { weight: 700, size: 150 * u, color: p.title, maxLines: 1, lh: 1.15, shadow: sh, gap: 6 * u });
      add(has ? `${ordinalEn(n)} Birthday` : "Birthday Party", FAM.cinzel, { weight: 700, size: 64 * u, color: p.ink, tracking: 4 * u, maxLines: 1, shadow: sh, gap: 8 * u });
      details();
      tail(f.hosts.trim() ? `Hosted by ${f.hosts.trim()}` : undefined);
    }
  } else {
    bism();
    const son = f.gender === "son";
    if (ur) {
      add("تقریبِ عقیقہ", FAM.nastaliq, { weight: 700, size: 96 * u, color: p.title, maxLines: 1, shadow: sh, gap: 10 * u });
      add(f.hosts, FAM.playfair, { weight: 700, size: 44 * u, color: p.ink, maxLines: 2, gap: 2 * u });
      add(son ? "اپنے بیٹے" : "اپنی بیٹی", FAM.nastaliq, { size: 40 * u, color: p.soft, maxLines: 1, gap: 4 * u });
      add(f.name1, FAM.vibes, { size: 130 * u, color: p.title, maxLines: 1, lh: 1.15, shadow: sh, gap: 4 * u });
      add("کے عقیقہ کی تقریب میں آپ کو شرکت کی پُرخلوص دعوت دیتے ہیں", FAM.nastaliq, { size: 40 * u, color: p.soft, maxLines: 2, gap: 4 * u });
    } else {
      add("With the blessings of Allah", FAM.cormorant, { weight: 500, italic: true, size: 46 * u, color: p.soft, maxLines: 1, gap: 16 * u });
      add(f.hosts, FAM.playfair, { weight: 600, size: 48 * u, color: p.ink, maxLines: 2, lh: 1.25, gap: 10 * u });
      add(
        f.hosts.trim() ? `invite you to the Aqiqa of their beloved ${son ? "son" : "daughter"}` : `You are invited to the Aqiqa of our beloved ${son ? "son" : "daughter"}`,
        FAM.cormorant,
        { weight: 500, italic: true, size: 44 * u, color: p.soft, maxLines: 2, gap: 14 * u },
      );
      add(f.name1, FAM.vibes, { size: 140 * u, color: p.title, maxLines: 2, lh: 1.12, shadow: sh, gap: 4 * u });
    }
    details();
    tail();
  }
  return it;
}

const renderInvite: Renderer<InvScene> = (ctx, W, H, s) => {
  const m = Math.min(W, H);
  const u = m / 1080;
  const ins = DESIGN_FNS[s.tpl](ctx, W, H, s.pal, rng(hashStr(s.tpl + s.pal.id) + 3));
  const box = { x: ins.l, y: ins.t, w: W - ins.l - ins.r, h: H - ins.t - ins.b };
  layoutStack(ctx, inviteItems(s, u), box, "center");
};

/* ------------------------------------------------------------------ *
 * shared UI
 * ------------------------------------------------------------------ */

/** Live preview: the same renderer as the export, drawn at a lower resolution. */
function CardCanvas<S>({
  scene,
  render,
  w,
  h,
  max,
  tick,
  label,
  className = "",
}: {
  scene: S;
  render: Renderer<S>;
  w: number;
  h: number;
  max: number;
  tick: number;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = ref.current;
      if (!c) return;
      const s = max / Math.max(w, h);
      const cw = Math.round(w * s);
      const ch = Math.round(h * s);
      if (c.width !== cw) c.width = cw;
      if (c.height !== ch) c.height = ch;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.clearRect(0, 0, w, h);
      render(ctx, w, h, scene);
    });
    return () => cancelAnimationFrame(id);
  }, [scene, render, w, h, max, tick]);
  return <canvas ref={ref} role="img" aria-label={label} className={`block w-full ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />;
}

function Preview({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: `min(100%, ${Math.round((70 * w) / h)}vh, 560px)` }}>
      <div className="overflow-hidden rounded-2xl shadow-2xl shadow-black/30 ring-1 ring-[var(--line)]">{children}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
            value === o.value ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children, style, title }: { active: boolean; onClick: () => void; children: ReactNode; style?: CSSProperties; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      style={style}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-all ${
        active ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-md shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-500)]" />
      {label}
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  maxLength = 120,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  maxLength?: number;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input
        type={type}
        dir="auto"
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={field}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour theme">
      {PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          aria-label={p.label}
          title={p.label}
          onClick={() => onChange(p.id)}
          className={`relative h-10 w-10 rounded-full ring-offset-2 ring-offset-[var(--bg)] transition-transform hover:scale-105 ${value === p.id ? "ring-2 ring-brand-400" : "ring-1 ring-[var(--line)]"}`}
          style={{ background: `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]})` }}
        >
          <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border border-white/60" style={{ background: p.orn }} />
        </button>
      ))}
    </div>
  );
}

function ThumbGrid<S>({
  items,
  render,
  w,
  h,
  tick,
  active,
  onPick,
}: {
  items: { key: string; label: string; scene: S }[];
  render: Renderer<S>;
  w: number;
  h: number;
  tick: number;
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onPick(t.key)}
          aria-pressed={active === t.key}
          aria-label={t.label}
          className={`group overflow-hidden rounded-xl p-0.5 transition-all ${active === t.key ? "bg-gradient-to-br from-brand-500 to-accent-500 shadow-lg shadow-brand-500/25" : "surface hover:border-brand-400/60"}`}
        >
          <CardCanvas scene={t.scene} render={render} w={w} h={h} max={220} tick={tick} label={t.label} className="rounded-[10px]" />
          <span className={`block truncate px-1 py-1 text-[11px] font-semibold ${active === t.key ? "text-white" : "text-muted"}`}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

const btn = "flex items-center justify-center gap-2 rounded-xl surface px-3 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60 hover:text-brand-400 disabled:opacity-60";
const shareClass =
  "w-full [&>button]:w-full [&>button]:justify-center [&>button]:border-transparent [&>button]:bg-[#25D366] [&>button]:py-3 [&>button]:text-base [&>button]:text-white [&>button]:shadow-lg [&>button]:shadow-[#25D366]/25 [&>button:hover]:bg-[#1ebe5b] [&>button:hover]:text-white";

function ExportBar({
  slug,
  file,
  title,
  text,
  make,
  onUsed,
  children,
}: {
  slug: string;
  file: string;
  title: string;
  text: string;
  make: () => Promise<HTMLCanvasElement>;
  onUsed: () => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState("");
  async function download(kind: "png" | "jpg") {
    setBusy(kind);
    try {
      const c = await make();
      const blob = await toBlob(c, kind === "png" ? "image/png" : "image/jpeg", 0.93);
      saveBlob(blob, `${file}.${kind}`);
      onUsed();
      trackEvent("download", slug);
      notify.success("Card saved", `${file}.${kind} — ${c.width} × ${c.height} px`);
    } catch (e) {
      notify.error("Could not save the card", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="mt-4 space-y-2">
      <ShareSheet
        title={title}
        text={text}
        label="Share on WhatsApp"
        className={shareClass}
        getFiles={async () => {
          const c = await make();
          onUsed();
          return [await canvasToFile(c, `${file}.jpg`, "image/jpeg", 0.92)];
        }}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" className={btn} disabled={!!busy} onClick={() => void download("png")}>
          {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PNG
        </button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => void download("jpg")}>
          {busy === "jpg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} JPG
        </button>
        {children}
      </div>
    </div>
  );
}

function PrintButton({ label = "Print", onPrint }: { label?: string; onPrint: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={btn}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onPrint();
        } catch (e) {
          notify.error("Could not print", e instanceof Error ? e.message : undefined);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {label}
    </button>
  );
}

const FORMATS = {
  square: { w: 1080, h: 1080, label: "Square post", sub: "1080 × 1080" },
  story: { w: 1080, h: 1920, label: "WhatsApp status", sub: "1080 × 1920" },
  portrait: { w: 1080, h: 1350, label: "Portrait", sub: "1080 × 1350" },
  card: { w: 1480, h: 2100, label: "Card (A5)", sub: "148 × 210 mm" },
} as const;
type FormatId = keyof typeof FORMATS;

function formatLabel(id: FormatId) {
  const f = FORMATS[id];
  return (
    <span className="flex flex-col leading-tight">
      {f.label}
      <span className="text-[10px] font-medium opacity-75">{f.sub}</span>
    </span>
  );
}

/** Puts a card on A5 paper with a margin and crop marks, then opens the print dialog. */
async function printOnA5(card: HTMLCanvasElement, title: string) {
  const { canvas, ctx, wMm, hMm, px } = paperCanvas(PAPER_MAP.a5);
  const margin = px(12);
  const s = Math.min((canvas.width - margin * 2) / card.width, (canvas.height - margin * 2) / card.height);
  const w = card.width * s;
  const h = card.height * s;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(card, x, y, w, h);
  drawCropMarks(ctx, x, y, w, h);
  await printPages([{ canvas, wMm, hMm }], title);
}

/* ------------------------------------------------------------------ *
 * greeting maker
 * ------------------------------------------------------------------ */

const GREET_SPECS = BASE_SPECS;

function GreetingMaker({ slug, preset }: { slug: string; preset: string }) {
  const fixed = OCC[preset];
  const first = fixed ?? OCCASIONS[0];
  const [occId, setOccId] = useState(first.id);
  const occ = OCC[occId] ?? first;
  const [design, setDesign] = useState(first.designs[0].d);
  const [palId, setPalId] = useState(first.designs[0].pal);
  const [format, setFormat] = useState<"square" | "story">("square");
  const [ur, setUr] = useState(first.ur);
  const [en, setEn] = useState(first.en);
  const [showUr, setShowUr] = useState(true);
  const [showEn, setShowEn] = useState(true);
  const [urFont, setUrFont] = useState<UrFontId>("nastaliq");
  const [enFont, setEnFont] = useState<EnFontId>(DESIGNS[first.designs[0].d].en);
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState(first.msgs.en[0]);
  const [from, setFrom] = useState("");
  const [prefix, setPrefix] = useState("From:");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [used, setUsed] = useState(false);
  useTrackOnce(slug, used);

  // the New Year headline carries the year — a client-only value
  useEffect(() => {
    const id = requestAnimationFrame(() => setEn((v) => (v === "Happy New Year" ? `Happy New Year ${newYearNumber()}` : v)));
    return () => cancelAnimationFrame(id);
  }, []);

  const tick = useFonts([...GREET_SPECS, UR_FONTS[urFont].spec]);
  const pal = PAL[palId] ?? PALETTES[0];
  const { w: W, h: H } = FORMATS[format];
  const scene: GreetScene = { occ, design, pal, ur, en, showUr, showEn, urFont, enFont, to, msg, from, prefix, photo };

  const thumbs = useMemo(
    () =>
      occ.designs.map(({ d, pal: pid }) => ({
        key: `${d}:${pid}`,
        label: DESIGNS[d].label,
        scene: {
          occ,
          design: d,
          pal: PAL[pid],
          ur: occ.ur,
          en: occ.en,
          showUr: true,
          showEn: true,
          urFont: "nastaliq" as UrFontId,
          enFont: DESIGNS[d].en,
          to: "",
          msg: occ.msgs.en[1],
          from: "",
          prefix: "",
          photo: null,
        } satisfies GreetScene,
      })),
    [occ],
  );

  function pickOccasion(id: string) {
    const o = OCC[id];
    if (!o) return;
    setOccId(id);
    setDesign(o.designs[0].d);
    setPalId(o.designs[0].pal);
    setEnFont(DESIGNS[o.designs[0].d].en);
    setUr(o.ur);
    setEn(id === "new-year" ? `Happy New Year ${newYearNumber()}` : o.en);
    setMsg(isRtl(msg) ? o.msgs.ur[0] : o.msgs.en[0]);
  }

  function pickDesign(key: string) {
    const [d, pid] = key.split(":");
    setDesign(d);
    setPalId(pid);
    setEnFont(DESIGNS[d].en);
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify.error("That is not a photo", "Choose a JPG, PNG or WEBP image.");
      return;
    }
    try {
      setPhoto(await loadImage(file));
    } catch (e) {
      notify.error("Could not open that photo", e instanceof Error ? e.message : undefined);
    }
  }

  const make = async (scale = 1) => {
    await ensureFonts([...GREET_SPECS, UR_FONTS[urFont].spec]);
    return renderCanvas(renderGreeting, scene, W, H, scale);
  };
  const file = `${occ.file}-card${from.trim() && slugify(from) ? `-${slugify(from)}` : ""}`;
  const suggestions = [
    ...occ.msgs.en.map((t, i) => ({ t, label: `English ${i + 1}` })),
    ...occ.msgs.ur.map((t, i) => ({ t, label: `اردو ${i + 1}` })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <Preview w={W} h={H}>
          <CardCanvas scene={scene} render={renderGreeting} w={W} h={H} max={1000} tick={tick} label={`${occ.label} card preview`} />
        </Preview>
        <ExportBar
          slug={slug}
          file={file}
          title={`${occ.en} card`}
          text={`I made this ${occ.label} card with my name on SnapGrab — make yours free:`}
          make={() => make(1)}
          onUsed={() => setUsed(true)}
        >
          <PrintButton
            onPrint={async () => {
              const card = await make(1.5);
              await printOnA5(card, `${occ.en} card`);
              setUsed(true);
              trackEvent("print", slug);
            }}
          />
          <label className={`${btn} cursor-pointer`}>
            <ImagePlus className="h-4 w-4" /> Photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </label>
        </ExportBar>
        <p className="mt-3 text-center text-xs text-muted">Made in your browser — your name and photo are never uploaded.</p>
      </div>

      <div className="space-y-6">
        {!fixed && (
          <Section title="Occasion">
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip key={o.id} active={o.id === occId} onClick={() => pickOccasion(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="Your name" hint="Shown at the bottom of the card. Type in English or Urdu.">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className={field} aria-label="Text before your name">
              {PREFIXES.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input dir="auto" value={from} maxLength={60} onChange={(e) => setFrom(e.target.value)} placeholder="e.g. Ahmed & family" className={field} aria-label="Your name" />
          </div>
          <Input label="To (optional)" value={to} onChange={setTo} maxLength={50} placeholder="e.g. Dear Sara" />
        </Section>

        <Section title="Design">
          <ThumbGrid items={thumbs} render={renderGreeting} w={1080} h={1080} tick={tick} active={`${design}:${palId}`} onPick={pickDesign} />
        </Section>

        <Section title="Colours">
          <Swatches value={palId} onChange={setPalId} />
        </Section>

        <Section title="Size">
          <Toggle
            label="Card size"
            value={format}
            onChange={setFormat}
            options={[
              { value: "square", label: formatLabel("square") },
              { value: "story", label: formatLabel("story") },
            ]}
          />
        </Section>

        <Section title="Headline">
          <div className="space-y-3 rounded-2xl surface p-3">
            <div className="flex items-center justify-between gap-2">
              <Check checked={showUr} onChange={setShowUr} label="Urdu / Arabic headline" />
            </div>
            <input dir="rtl" lang="ur" value={ur} maxLength={60} onChange={(e) => setUr(e.target.value)} className={`${field} text-lg`} style={{ fontFamily: FAM.nastaliq, lineHeight: 2 }} aria-label="Urdu headline" />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(UR_FONTS) as UrFontId[]).map((id) => (
                <Chip key={id} active={urFont === id} onClick={() => setUrFont(id)} style={{ fontFamily: UR_FONTS[id].family }} title={UR_FONTS[id].label}>
                  {UR_FONTS[id].label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-2xl surface p-3">
            <Check checked={showEn} onChange={setShowEn} label="English headline" />
            <input dir="auto" value={en} maxLength={60} onChange={(e) => setEn(e.target.value)} className={field} aria-label="English headline" />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EN_FONTS) as EnFontId[]).map((id) => (
                <Chip key={id} active={enFont === id} onClick={() => setEnFont(id)} style={{ fontFamily: EN_FONTS[id].family }}>
                  {EN_FONTS[id].label}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Message" hint="Pick a ready message or write your own — long text shrinks to fit.">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s.label} active={msg === s.t} onClick={() => setMsg(s.t)}>
                {s.label}
              </Chip>
            ))}
            <Chip active={false} onClick={() => setMsg("")}>
              No message
            </Chip>
          </div>
          <textarea
            dir="auto"
            rows={4}
            value={msg}
            maxLength={400}
            onChange={(e) => setMsg(e.target.value)}
            className={`${field} resize-y`}
            style={isRtl(msg) ? { fontFamily: FAM.nastaliq, lineHeight: 2.1 } : undefined}
            aria-label="Message"
          />
        </Section>

        <Section title="Photo (optional)" hint="Shown in a round frame. It stays on your device.">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${btn} cursor-pointer`}>
              <ImagePlus className="h-4 w-4" /> {photo ? "Change photo" : "Add a photo"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onPhoto(e.target.files?.[0])} />
            </label>
            {photo && (
              <button type="button" className={btn} onClick={() => setPhoto(null)}>
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * quote maker
 * ------------------------------------------------------------------ */

const QUOTE_SPECS = [...BASE_SPECS, fs(400, FAM.naskh, AR_SAMPLE)];

type QBgScene = { bg: QuoteBg };
const renderQuoteBg: Renderer<QBgScene> = (ctx, W, H, s) => {
  s.bg.draw(ctx, W, H, rng(hashStr(s.bg.id)));
  ctx.fillStyle = s.bg.ink;
  ctx.font = `700 ${Math.min(W, H) * 0.3}px ${FAM.playfair}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Aa", W / 2, H / 2);
};

function QuoteMaker({ slug }: { slug: string }) {
  const [text, setText] = useState(SAMPLES[0].text);
  const [author, setAuthor] = useState(SAMPLES[0].author);
  const [bgId, setBgId] = useState("emerald");
  const [font, setFont] = useState<QFontId>("nastaliq");
  const [align, setAlign] = useState<Align>("center");
  const [size, setSize] = useState(100);
  const [shadow, setShadow] = useState(true);
  const [marks, setMarks] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [format, setFormat] = useState<"square" | "portrait" | "story">("square");
  const [used, setUsed] = useState(false);
  useTrackOnce(slug, used);
  const tick = useFonts(QUOTE_SPECS);

  const bg = QBG[bgId] ?? QUOTE_BGS[0];
  const { w: W, h: H } = FORMATS[format];
  const scene: QuoteScene = { text, author, bg, font, align, size, shadow, marks, watermark };
  const bgThumbs = useMemo(() => QUOTE_BGS.map((b) => ({ key: b.id, label: b.label, scene: { bg: b } })), []);
  const rtl = isRtl(text);
  const fontMismatch = rtl && !Q_FONTS[font].urdu;

  function applySample(i: number) {
    const s = SAMPLES[i];
    setText(s.text);
    setAuthor(s.author);
    setFont(s.font);
  }

  const make = async (scale = 1) => {
    await ensureFonts(QUOTE_SPECS);
    return renderCanvas(renderQuote, scene, W, H, scale);
  };
  const first = slugify(author) || "quote";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <Preview w={W} h={H}>
          <CardCanvas scene={scene} render={renderQuote} w={W} h={H} max={1000} tick={tick} label="Quote image preview" />
        </Preview>
        <ExportBar slug={slug} file={`${first}-quote`} title="Quote image" text="Made this poetry image on SnapGrab — try it free:" make={() => make(1)} onUsed={() => setUsed(true)}>
          <PrintButton
            onPrint={async () => {
              await printOnA5(await make(1.5), "Quote");
              setUsed(true);
              trackEvent("print", slug);
            }}
          />
        </ExportBar>
      </div>

      <div className="space-y-6">
        <Section title="Quick start" hint="Classical verses by Allama Iqbal and Mirza Ghalib, and public-domain English lines.">
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <Chip key={s.label} active={text === s.text} onClick={() => applySample(i)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Text" hint="Urdu or English. Press Enter for a new line — each misra stays on its own line.">
          <textarea
            dir="auto"
            rows={5}
            value={text}
            maxLength={600}
            onChange={(e) => setText(e.target.value)}
            className={`${field} resize-y`}
            style={rtl ? { fontFamily: FAM.nastaliq, lineHeight: 2.2, fontSize: "1.05rem" } : undefined}
            aria-label="Quote or poetry text"
          />
          <Input label="Poet / author (optional)" value={author} onChange={setAuthor} maxLength={80} placeholder="e.g. علامہ محمد اقبال" />
        </Section>

        <Section title="Background">
          <ThumbGrid items={bgThumbs} render={renderQuoteBg} w={600} h={600} tick={tick} active={bgId} onPick={setBgId} />
        </Section>

        <Section title="Font" hint={fontMismatch ? "Urdu text is drawn in Nastaliq — pick Nastaliq or Naskh to choose yourself." : undefined}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(Q_FONTS) as QFontId[]).map((id) => (
              <Chip key={id} active={font === id} onClick={() => setFont(id)} style={{ fontFamily: Q_FONTS[id].family }}>
                {Q_FONTS[id].urdu ? `${Q_FONTS[id].label} · اردو` : Q_FONTS[id].label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Layout">
          <Toggle
            label="Alignment"
            value={align}
            onChange={setAlign}
            options={[
              { value: "left", label: <TextAlignStart className="mx-auto h-4 w-4" aria-label="Left" /> },
              { value: "center", label: <TextAlignCenter className="mx-auto h-4 w-4" aria-label="Centre" /> },
              { value: "right", label: <TextAlignEnd className="mx-auto h-4 w-4" aria-label="Right" /> },
            ]}
          />
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-semibold">
              Text size <span className="text-xs text-muted">{size}%</span>
            </span>
            <input type="range" min={60} max={140} step={5} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[var(--color-brand-500)]" />
            <span className="mt-1 block text-xs text-muted">Long text still shrinks to fit the card.</span>
          </label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Check checked={shadow} onChange={setShadow} label="Text shadow" />
            <Check checked={marks} onChange={setMarks} label="Quote mark / ornament" />
            <Check checked={watermark} onChange={setWatermark} label="“made with SnapGrab”" />
          </div>
        </Section>

        <Section title="Size">
          <Toggle
            label="Image size"
            value={format}
            onChange={setFormat}
            options={[
              { value: "square", label: formatLabel("square") },
              { value: "portrait", label: formatLabel("portrait") },
              { value: "story", label: formatLabel("story") },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * invitation maker
 * ------------------------------------------------------------------ */

const INV_SPECS = BASE_SPECS;
const A6 = { w: 105, h: 148 };

function InvitationMaker({ slug, preset }: { slug: string; preset: string }) {
  const fixed = INV[preset as InvType] ? (preset as InvType) : null;
  const [type, setType] = useState<InvType>(fixed ?? "wedding");
  const [tplIdx, setTplIdx] = useState<Record<InvType, number>>({ wedding: 0, birthday: 0, aqiqa: 0 });
  const [palId, setPalId] = useState<Record<InvType, string>>({
    wedding: INV.wedding.templates[0].pal,
    birthday: INV.birthday.templates[0].pal,
    aqiqa: INV.aqiqa.templates[0].pal,
  });
  const [all, setAll] = useState<Record<InvType, InvFields>>(INV_DEFAULTS);
  const [lang, setLang] = useState<Lang>("en");
  const [bismillah, setBismillah] = useState(true);
  const [format, setFormat] = useState<"card" | "story">("card");
  const [paper, setPaper] = useState<"a5" | "a6">("a5");
  const [busyPdf, setBusyPdf] = useState(false);
  const [used, setUsed] = useState(false);
  useTrackOnce(slug, used);
  const tick = useFonts(INV_SPECS);

  // default event date: four weeks from today (client-only)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const d = new Date(Date.now() + 28 * 86_400_000);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setAll((prev) => {
        const next = { ...prev };
        for (const t of Object.keys(next) as InvType[]) if (!next[t].date) next[t] = { ...next[t], date: iso };
        return next;
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const info = INV[type];
  const f = all[type];
  const tpl = info.templates[tplIdx[type]] ?? info.templates[0];
  const pal = PAL[palId[type]] ?? PALETTES[0];
  const { w: W, h: H } = FORMATS[format];
  const scene: InvScene = { type, tpl: tpl.d, pal, lang, bismillah: bismillah && type !== "birthday", f };
  const set = (patch: Partial<InvFields>) => setAll((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const thumbs = useMemo(
    () =>
      info.templates.map((t, i) => ({
        key: String(i),
        label: DESIGNS[t.d].label,
        scene: { type: info.id, tpl: t.d, pal: PAL[t.pal], lang, bismillah: info.id !== "birthday", f: INV_DEFAULTS[info.id] } satisfies InvScene,
      })),
    [info, lang],
  );

  function switchLang(next: Lang) {
    if (next === lang) return;
    setLang(next);
    // swap the sample text to the other language, keep anything the user typed
    setAll((prev) => {
      const out = { ...prev };
      for (const t of Object.keys(out) as InvType[]) {
        const from = INV_SAMPLES[t][lang];
        const to = INV_SAMPLES[t][next];
        const cur = { ...out[t] };
        for (const k of Object.keys(from) as (keyof InvFields)[]) {
          if (cur[k] === from[k] && to[k] !== undefined) (cur as Record<string, string>)[k] = to[k] as string;
        }
        out[t] = cur;
      }
      return out;
    });
  }

  const make = async (scale = 1) => {
    await ensureFonts(INV_SPECS);
    return renderCanvas(renderInvite, scene, W, H, scale);
  };

  /** The printable card: always the A5-shaped layout, rendered at 300 DPI for the chosen paper. */
  async function makePage() {
    await ensureFonts(INV_SPECS);
    const mm = paper === "a5" ? { w: PAPER_MAP.a5.w, h: PAPER_MAP.a5.h } : A6;
    const pw = mmToPx(mm.w);
    const ph = mmToPx(mm.h);
    const c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("This browser cannot create images.");
    const cw = FORMATS.card.w;
    const chh = FORMATS.card.h;
    const s = Math.max(pw / cw, ph / chh);
    ctx.translate((pw - cw * s) / 2, (ph - chh * s) / 2);
    ctx.scale(s, s);
    renderInvite(ctx, cw, chh, { ...scene });
    return { canvas: c, wMm: mm.w, hMm: mm.h };
  }

  async function downloadPdf() {
    setBusyPdf(true);
    try {
      const page = await makePage();
      const blob = await pagesToPdf([page]);
      saveBlob(blob, `${info.file}-${paper}.pdf`);
      setUsed(true);
      trackEvent("download", slug);
      notify.success("PDF saved", `${paper.toUpperCase()} card, ready to print at 100% scale.`);
    } catch (e) {
      notify.error("Could not create the PDF", e instanceof Error ? e.message : undefined);
    } finally {
      setBusyPdf(false);
    }
  }

  const names = [f.name1, f.name2].map((n) => n.trim()).filter(Boolean);
  const file = `${info.file}${names.length ? `-${slugify(names.join(" "))}` : ""}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <Preview w={W} h={H}>
          <CardCanvas scene={scene} render={renderInvite} w={W} h={H} max={1000} tick={tick} label={`${info.label} invitation preview`} />
        </Preview>
        <ExportBar
          slug={slug}
          file={file}
          title={`${info.label} invitation`}
          text="You're invited! Card made free on SnapGrab:"
          make={() => make(1)}
          onUsed={() => setUsed(true)}
        >
          <button type="button" className={btn} disabled={busyPdf} onClick={() => void downloadPdf()}>
            {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </button>
          <PrintButton
            onPrint={async () => {
              const page = await makePage();
              await printPages([page], `${info.label} invitation`);
              setUsed(true);
              trackEvent("print", slug);
            }}
          />
        </ExportBar>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          <span>PDF &amp; print size:</span>
          <Chip active={paper === "a5"} onClick={() => setPaper("a5")}>
            A5 · 148×210 mm
          </Chip>
          <Chip active={paper === "a6"} onClick={() => setPaper("a6")}>
            A6 · 105×148 mm
          </Chip>
        </div>
        <p className="mt-2 text-center text-xs text-muted">PDF and print always use the card layout. Print at 100% scale (“Actual size”).</p>
      </div>

      <div className="space-y-6">
        {!fixed && (
          <Section title="Invitation for">
            <Toggle label="Invitation type" value={type} onChange={setType} options={INV_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          </Section>
        )}

        <Section title="Language" hint="Labels and sentences switch language; names stay as you typed them.">
          <Toggle
            label="Card language"
            value={lang}
            onChange={switchLang}
            options={[
              { value: "en", label: "English" },
              { value: "ur", label: <span style={{ fontFamily: FAM.nastaliq }}>اردو</span> },
            ]}
          />
        </Section>

        <Section title="Template">
          <ThumbGrid
            items={thumbs}
            render={renderInvite}
            w={FORMATS.card.w}
            h={FORMATS.card.h}
            tick={tick}
            active={String(tplIdx[type])}
            onPick={(k) => {
              const i = Number(k);
              setTplIdx((prev) => ({ ...prev, [type]: i }));
              setPalId((prev) => ({ ...prev, [type]: info.templates[i].pal }));
            }}
          />
        </Section>

        <Section title="Colours">
          <Swatches value={pal.id} onChange={(id) => setPalId((prev) => ({ ...prev, [type]: id }))} />
        </Section>

        <Section title="Details" hint="Empty fields are left off the card.">
          <div className="grid gap-3 sm:grid-cols-2">
            {type === "wedding" && (
              <>
                <Input label="Groom's name" value={f.name1} onChange={(v) => set({ name1: v })} maxLength={40} />
                <Input label="Bride's name" value={f.name2} onChange={(v) => set({ name2: v })} maxLength={40} />
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold">Event</span>
                  <select value={f.event} onChange={(e) => set({ event: e.target.value })} className={field}>
                    {WEDDING_EVENTS.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.en} — {e.ur}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {type === "birthday" && (
              <>
                <Input label="Birthday name" value={f.name1} onChange={(v) => set({ name1: v })} maxLength={40} />
                <Input label="Turning (age)" value={f.age} onChange={(v) => set({ age: v.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" placeholder="e.g. 5" hint="Leave empty for “Birthday Party”." />
              </>
            )}
            {type === "aqiqa" && (
              <>
                <Input label="Baby's name" value={f.name1} onChange={(v) => set({ name1: v })} maxLength={50} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Baby is a</span>
                  <Toggle
                    label="Son or daughter"
                    value={f.gender}
                    onChange={(v) => set({ gender: v })}
                    options={[
                      { value: "son", label: "Son" },
                      { value: "daughter", label: "Daughter" },
                    ]}
                  />
                </label>
              </>
            )}
            <div className="sm:col-span-2">
              <Input
                label={type === "birthday" ? "Hosted by (optional)" : "Hosts / parents (optional)"}
                value={f.hosts}
                onChange={(v) => set({ hosts: v })}
                maxLength={80}
                placeholder={lang === "ur" ? "جناب و بیگم …" : "Mr. & Mrs. …"}
              />
            </div>
            <Input label="Date" type="date" value={f.date} onChange={(v) => set({ date: v })} />
            <Input label="Time" type="time" value={f.time} onChange={(v) => set({ time: v })} />
            <div className="sm:col-span-2">
              <Input label="Venue" value={f.venue} onChange={(v) => set({ venue: v })} maxLength={140} placeholder="Hall name, area, city" />
            </div>
            <Input label="RSVP phone" value={f.rsvp} onChange={(v) => set({ rsvp: v })} maxLength={40} inputMode="tel" placeholder="0300 1234567" />
            <Input label="Note (optional)" value={f.note} onChange={(v) => set({ note: v })} maxLength={120} placeholder={lang === "ur" ? "مثلاً کھانے کا اہتمام ہے" : "e.g. Dinner will be served"} />
          </div>
          {type !== "birthday" && <Check checked={bismillah} onChange={setBismillah} label="Bismillah at the top" />}
        </Section>

        <Section title="Image size" hint="The card size is best for printing; status size fills a phone screen on WhatsApp.">
          <Toggle
            label="Image size"
            value={format}
            onChange={setFormat}
            options={[
              { value: "card", label: formatLabel("card") },
              { value: "story", label: formatLabel("story") },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function CardStudio({ tool }: { tool: Tool }) {
  const [kind, preset = ""] = (tool.mode ?? "greeting").split(":");
  const panel =
    kind === "quote" ? (
      <QuoteMaker slug={tool.slug} />
    ) : kind === "invitation" ? (
      <InvitationMaker slug={tool.slug} preset={preset} />
    ) : (
      <GreetingMaker slug={tool.slug} preset={preset} />
    );

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="aurora-border rounded-[26px]">
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-muted">
            <Sparkles className="h-4 w-4 text-brand-400" />
            {kind === "quote" ? "Type, pick a style, share." : kind === "invitation" ? "Fill in the details, pick a template, share or print." : "Add your name, pick a design, share on WhatsApp."}
          </div>
          {panel}
        </div>
      </motion.div>
    </div>
  );
}
