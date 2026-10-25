"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Camera,
  Download,
  FileText,
  ImagePlus,
  Info,
  Loader2,
  Minus,
  Plus,
  Printer,
  Scissors,
  ShieldCheck,
  Trash2,
  UploadCloud,
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

const MAX_PHOTOS = 30;
const MAX_PAGES = 30;
const MAX_COPIES = 99;
/** thumbnails used for the on-screen list and page previews */
const THUMB = 360;
/** below this the print will look soft */
const SOFT_DPI = 150;
const PREVIEW_LIMIT = 12;

const DPMM = DPI / 25.4;
const P = (mm: number) => mm * DPMM;

type SizeKey = "wallet" | "3r" | "4r" | "5r" | "passport" | "2x2" | "sq4" | "custom";
const SIZES: { key: SizeKey; label: string; sub: string; w: number; h: number }[] = [
  { key: "wallet", label: "Wallet", sub: "2.5 × 3.5 in", w: 63.5, h: 88.9 },
  { key: "3r", label: "3R", sub: "3.5 × 5 in", w: 88.9, h: 127 },
  { key: "4r", label: "4R", sub: "4 × 6 in", w: 101.6, h: 152.4 },
  { key: "5r", label: "5R", sub: "5 × 7 in", w: 127, h: 177.8 },
  { key: "passport", label: "Passport", sub: "35 × 45 mm", w: 35, h: 45 },
  { key: "2x2", label: "2 × 2 in", sub: "51 × 51 mm", w: 50.8, h: 50.8 },
  { key: "sq4", label: "Square", sub: "4 × 4 in", w: 101.6, h: 101.6 },
  { key: "custom", label: "Custom", sub: "mm or inches", w: 0, h: 0 },
];

type Fit = "fill" | "fit";
type Guides = "none" | "cut" | "marks";
type MarginPick = "auto" | "0" | "3" | "6";
type CopiesMode = "each" | "page";
type Busy = null | "print" | "pdf" | "jpg";

type Photo = {
  id: number;
  name: string;
  type: string;
  bytes: number;
  url: string;
  img: HTMLImageElement;
  width: number;
  height: number;
  thumb: HTMLCanvasElement;
  thumbUrl: string;
  fit: Fit;
};

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isHeic = (f: File) => /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
const defaultMargin = (p: Paper) => (Math.min(p.w, p.h) <= 130 ? 3 : 6);
const pause = () => new Promise((r) => setTimeout(r, 0)); // let a spinner paint before heavy canvas work

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("unreadable"));
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

function makeThumb(img: HTMLImageElement) {
  const k = Math.min(1, THUMB / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  return c;
}

/** Does the photo need a quarter turn to match the slot's orientation? Squares never turn. */
const needsTurn = (iw: number, ih: number, w: number, h: number) => iw !== ih && w !== h && iw > ih !== w > h;

/** Effective print resolution of a photo in a w × h mm slot. */
function effectiveDpi(iw: number, ih: number, w: number, h: number, fit: Fit, turn: boolean) {
  const [bw, bh] = turn ? [h, w] : [w, h];
  const mmPerPx = fit === "fill" ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
  return 25.4 / mmPerPx;
}

/**
 * Draws one photo into a slot (300-DPI page pixels). "fill" crops to the slot, centred; "fit" shows the
 * whole photo with white around it. A quarter turn is applied about the slot centre when needed.
 */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  iw: number,
  ih: number,
  X: number,
  Y: number,
  w: number,
  h: number,
  fit: Fit,
  turn: boolean,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(X, Y, w, h);
  ctx.clip();
  ctx.translate(X + w / 2, Y + h / 2);
  if (turn) ctx.rotate(Math.PI / 2);
  const [bw, bh] = turn ? [h, w] : [w, h];
  const s = fit === "fill" ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
  ctx.drawImage(src, (-iw * s) / 2, (-ih * s) / 2, iw * s, ih * s);
  ctx.restore();
}

type Plan = {
  wMm: number;
  hMm: number;
  slotW: number;
  slotH: number;
  margin: number;
  cols: number;
  rows: number;
  capacity: number;
  /** top-left corners (mm) of every slot on a page, row by row */
  slots: { x: number; y: number }[];
  /** photo index for every print, page by page */
  pages: number[][];
  total: number;
};

function plan(paper: Paper, w: number, h: number, gap: number, marginPick: MarginPick, photos: number, mode: CopiesMode, copies: number): Plan {
  const W = paper.w;
  const H = paper.h;
  const def = defaultMargin(paper);
  // "auto" keeps clear of the unprintable edge, but goes (nearly) borderless if that is the only way it fits
  const margins = marginPick === "auto" ? [...new Set([def, 3, 0])].filter((m) => m <= def) : [Number(marginPick)];
  let best = { margin: margins[0], slotW: w, slotH: h, cols: 0, rows: 0, capacity: 0 };
  for (const margin of margins) {
    for (const [sw, sh] of [
      [w, h],
      [h, w],
    ]) {
      const cols = Math.max(0, Math.floor((W - 2 * margin + gap + 1e-6) / (sw + gap)));
      const rows = Math.max(0, Math.floor((H - 2 * margin + gap + 1e-6) / (sh + gap)));
      if (cols * rows > best.capacity) best = { margin, slotW: sw, slotH: sh, cols, rows, capacity: cols * rows };
    }
    if (best.capacity) break;
  }
  const { cols, rows, capacity, slotW, slotH } = best;
  const x0 = (W - (cols * slotW + Math.max(0, cols - 1) * gap)) / 2;
  const y0 = (H - (rows * slotH + Math.max(0, rows - 1) * gap)) / 2;
  const slots = Array.from({ length: capacity }, (_, i) => ({
    x: x0 + (i % cols) * (slotW + gap),
    y: y0 + Math.floor(i / cols) * (slotH + gap),
  }));

  const pages: number[][] = [];
  if (capacity && photos) {
    if (mode === "page") {
      for (let p = 0; p < photos; p++) pages.push(Array.from({ length: capacity }, () => p));
    } else {
      const items = Array.from({ length: photos * copies }, (_, i) => Math.floor(i / copies));
      for (let i = 0; i < items.length; i += capacity) pages.push(items.slice(i, i + capacity));
    }
  }
  return { wMm: W, hMm: H, ...best, slots, pages, total: pages.reduce((s, p) => s + p.length, 0) };
}

/** Draws page `index` of the plan. `thumbs` uses the small preview images instead of the full photos. */
function drawPage(ctx: CanvasRenderingContext2D, pl: Plan, index: number, photos: Photo[], guides: Guides, autoRotate: boolean, thumbs: boolean) {
  const w = Math.round(P(pl.slotW));
  const h = Math.round(P(pl.slotH));
  const items = pl.pages[index] ?? [];
  const rects = items.map((_, i) => [Math.round(P(pl.slots[i].x)), Math.round(P(pl.slots[i].y))] as const);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // crop marks underneath: where a mark would run into a neighbouring photo, the photo covers it
  if (guides === "marks") rects.forEach(([x, y]) => drawCropMarks(ctx, x, y, w, h));
  items.forEach((pi, i) => {
    const ph = photos[pi];
    if (!ph) return;
    const turn = autoRotate && needsTurn(ph.width, ph.height, pl.slotW, pl.slotH);
    const [src, iw, ih] = thumbs ? [ph.thumb, ph.thumb.width, ph.thumb.height] : [ph.img, ph.width, ph.height];
    drawPhoto(ctx, src, iw, ih, rects[i][0], rects[i][1], w, h, ph.fit, turn);
  });
  if (guides === "cut") rects.forEach(([x, y]) => drawCutLine(ctx, x, y, w, h));
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

/**
 * Full-size pages rendered on demand, one at a time. printPages / pagesToPdf read `page.canvas` once per
 * page, in order, and copy its pixels synchronously (toBlob / toDataURL), so the previous page's 30 MB
 * canvas can be released as soon as the next one is asked for. Call release() when done.
 */
function lazyPages(count: number, wMm: number, hMm: number, render: (i: number) => HTMLCanvasElement) {
  let current: { i: number; canvas: HTMLCanvasElement } | null = null;
  const get = (i: number) => {
    if (current?.i === i) return current.canvas;
    if (current) current.canvas.width = 0;
    current = { i, canvas: render(i) };
    return current.canvas;
  };
  const pages: PrintPage[] = Array.from({ length: count }, (_, i) => ({
    wMm,
    hMm,
    get canvas() {
      return get(i);
    },
  }));
  return {
    pages,
    release: () => {
      if (current) current.canvas.width = 0;
      current = null;
    },
  };
}

/* ------------------------------------------------------------------ */

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  cols = 3,
}: {
  label: string;
  value: T;
  options: { key: T; label: ReactNode }[];
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

export default function PhotoPrintStudio({ tool }: { tool: Tool }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sizeKey, setSizeKey] = useState<SizeKey>("4r");
  const [customW, setCustomW] = useState("100");
  const [customH, setCustomH] = useState("150");
  const [unit, setUnit] = useState<"mm" | "in">("mm");
  const [paperId, setPaperId] = useState("a4");
  const [copiesMode, setCopiesMode] = useState<CopiesMode>("each");
  const [copiesText, setCopiesText] = useState("1");
  const [gap, setGap] = useState<"0" | "2" | "4">("2");
  const [guides, setGuides] = useState<Guides>("cut");
  const [marginPick, setMarginPick] = useState<MarginPick>("auto");
  const [autoRotate, setAutoRotate] = useState(true);
  const [defaultFit, setDefaultFit] = useState<Fit>("fill");
  const [busy, setBusy] = useState<Busy>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const photosRef = useRef<Photo[]>([]);
  const nextId = useRef(1);

  // keep a handle on the current photos so their object URLs can be released when the tool unmounts
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [],
  );

  /* ------------------------------ derived ------------------------------ */

  const paper = PAPER_MAP[paperId] ?? PAPERS[0];
  const paperName = paper.label.replace(/\s*\(.*\)$/, "");
  const preset = SIZES.find((s) => s.key === sizeKey) ?? SIZES[2];
  const toMm = (v: string) => Number(v) * (unit === "in" ? 25.4 : 1);
  const cw = toMm(customW);
  const chh = toMm(customH);
  const sizeError =
    sizeKey === "custom" && (!Number.isFinite(cw) || !Number.isFinite(chh) || cw < 10 || chh < 10 || cw > 400 || chh > 400)
      ? unit === "in"
        ? "Enter a width and height between 0.4 and 15 in."
        : "Enter a width and height between 10 and 400 mm."
      : null;
  const w = sizeKey === "custom" ? (sizeError ? 100 : cw) : preset.w;
  const h = sizeKey === "custom" ? (sizeError ? 150 : chh) : preset.h;
  const copiesN = Math.floor(Number(copiesText));
  const copiesError = copiesMode === "each" && (!Number.isFinite(copiesN) || copiesN < 1 || copiesN > MAX_COPIES) ? `Enter 1 to ${MAX_COPIES}.` : null;
  const copies = copiesError ? 1 : copiesN;

  const pl = useMemo(
    () => plan(paper, w, h, Number(gap), marginPick, photos.length, copiesMode, copies),
    [paper, w, h, gap, marginPick, photos.length, copiesMode, copies],
  );
  const pageCount = pl.pages.length;
  const tooManyPages = pageCount > MAX_PAGES;
  const ready = photos.length > 0 && !sizeError && !copiesError && pl.capacity > 0 && !tooManyPages;
  const sizeLabel = sizeKey === "custom" ? `${Math.round(w * 10) / 10} × ${Math.round(h * 10) / 10} mm` : `${preset.label} (${preset.sub})`;

  // live preview of the first pages, drawn from the thumbnails with the same code as the real pages
  useEffect(() => {
    const t = window.setTimeout(() => {
      previewRefs.current.forEach((c, i) => {
        if (!c || i >= Math.min(pageCount, PREVIEW_LIMIT)) return;
        const ctx = previewContext(c, pl.wMm, pl.hMm, 170);
        if (ctx) drawPage(ctx, pl, i, photos, guides, autoRotate, true);
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [pl, pageCount, photos, guides, autoRotate]);

  /* ------------------------------ loading ------------------------------ */

  async function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name));
    if (images.length < files.length) notify.warning("Some files were skipped", "Only photos (JPG, PNG, WEBP…) can be printed here.");
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      notify.error("That's the limit", `Up to ${MAX_PHOTOS} photos at a time. Print these, then clear the list and add more.`);
      return;
    }
    if (images.length > room) notify.warning("Too many photos", `Only the first ${room} were added (limit ${MAX_PHOTOS}).`);
    setLoading(true);
    const added: Photo[] = [];
    const failed: string[] = [];
    let heic = false;
    for (const file of images.slice(0, room)) {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const thumb = makeThumb(img);
        added.push({
          id: nextId.current++,
          name: file.name || "photo",
          type: file.type,
          bytes: file.size,
          url,
          img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          thumb,
          thumbUrl: thumb.toDataURL("image/jpeg", 0.8),
          fit: defaultFit,
        });
      } catch {
        URL.revokeObjectURL(url);
        failed.push(file.name);
        if (isHeic(file)) heic = true;
      }
    }
    setLoading(false);
    if (added.length) setPhotos((prev) => [...prev, ...added]);
    if (failed.length)
      notify.error(
        failed.length === 1 ? `Couldn't open ${failed[0]}` : `${failed.length} photos couldn't be opened`,
        heic
          ? "This browser can't read HEIC photos. On iPhone choose Camera → Formats → Most Compatible, or share them as JPG."
          : "The file may be damaged or in an unsupported format. Try JPG or PNG.",
      );
  }

  function removePhoto(id: number) {
    const gone = photos.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function clearAll() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
  }

  const setFit = (id: number, fit: Fit) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, fit } : p)));

  /* ------------------------------ exports ------------------------------ */

  function renderFull(i: number) {
    const { canvas, ctx } = paperCanvas(paper, false);
    drawPage(ctx, pl, i, photos, guides, autoRotate, false);
    return canvas;
  }

  const fileBase = () => `photo-prints-${sizeKey === "custom" ? `${Math.round(w)}x${Math.round(h)}mm` : sizeKey}-${paperId}-${pl.total}`;

  function report(outputType: string, bytesOut: number) {
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        tool: tool.slug,
        inputType: photos[0]?.type || "image",
        outputType,
        files: photos.length,
        bytesIn: photos.reduce((s, p) => s + p.bytes, 0),
        bytesOut,
      }),
    }).catch(() => {});
  }

  async function pdfFile() {
    const lazy = lazyPages(pageCount, pl.wMm, pl.hMm, renderFull);
    try {
      return blobToFile(await pagesToPdf(lazy.pages), `${fileBase()}.pdf`);
    } finally {
      lazy.release();
    }
  }

  async function doPrint() {
    if (!ready || busy) return;
    setBusy("print");
    try {
      await pause();
      const lazy = lazyPages(pageCount, pl.wMm, pl.hMm, renderFull);
      try {
        await printPages(lazy.pages, "Photo prints — SnapGrab");
      } finally {
        lazy.release();
      }
      trackEvent("print", tool.slug);
      report("print", 0);
    } catch (err) {
      notify.error("Could not open the print dialog", err instanceof Error ? err.message : "Download the PDF and print that instead.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    if (!ready || busy) return;
    setBusy("pdf");
    trackEvent("process", tool.slug);
    try {
      await pause();
      const file = await pdfFile();
      saveBlob(file, file.name);
      trackEvent("download", tool.slug);
      report("application/pdf", file.size);
      notify.success("PDF downloaded", `${pl.total} prints on ${pageCount} ${pageCount === 1 ? "page" : "pages"} of ${paperName}. Print at 100% / actual size.`);
    } catch (err) {
      notify.error("Could not create the PDF", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function downloadJpg() {
    if (!ready || busy) return;
    if (pageCount > 5) {
      notify.info("That's a lot of images", "For more than 5 pages, download the PDF instead — one file, exact size.");
      return;
    }
    setBusy("jpg");
    trackEvent("process", tool.slug);
    try {
      await pause();
      let bytes = 0;
      for (let i = 0; i < pageCount; i++) {
        const canvas = renderFull(i);
        try {
          const blob = await toBlob(canvas, "image/jpeg", 0.92);
          bytes += blob.size;
          saveBlob(blob, `${fileBase()}${pageCount > 1 ? `-page${i + 1}` : ""}.jpg`);
        } finally {
          canvas.width = 0;
        }
        if (i < pageCount - 1) await new Promise((r) => setTimeout(r, 400)); // some browsers block rapid downloads
      }
      trackEvent("download", tool.slug);
      report("image/jpeg", bytes);
      notify.success(pageCount > 1 ? `${pageCount} images downloaded` : "Image downloaded", "300 DPI. Print at 100% / actual size.");
    } catch (err) {
      notify.error("Could not create the images", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------- render ------------------------------- */

  const spin = (b: Busy, icon: ReactNode) => (busy === b ? <Loader2 className="h-4 w-4 animate-spin" /> : icon);

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass space-y-6 rounded-[26px] p-4 sm:p-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
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
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* ----------------------------- photos ----------------------------- */}
          {!photos.length ? (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void addFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Choose photos to print"
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
                <p className="mt-4 font-bold">{loading ? "Opening photos…" : "Drop photos, or tap to choose"}</p>
                <p className="mt-1 text-sm text-muted">Several at once is fine. JPG, PNG or WEBP, processed in your browser, never uploaded</p>
              </div>
              <div className="mt-3 flex justify-center sm:hidden">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex min-h-11 items-center gap-2 rounded-2xl surface px-5 py-3 text-sm font-bold transition-colors hover:border-brand-400/60"
                >
                  <Camera className="h-4 w-4" /> Take a photo
                </button>
              </div>
            </div>
          ) : (
            <section aria-labelledby="pp-photos">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="pp-photos" className="text-base font-bold">
                  Your photos <span className="font-normal text-muted">({photos.length})</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading || photos.length >= MAX_PHOTOS}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold hover:text-brand-400 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add more
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={!!busy}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <AnimatePresence initial={false}>
                  {photos.map((ph) => {
                    const turn = autoRotate && needsTurn(ph.width, ph.height, pl.slotW, pl.slotH);
                    const dpi = effectiveDpi(ph.width, ph.height, pl.slotW, pl.slotH, ph.fit, turn);
                    return (
                      <motion.li
                        key={ph.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="min-w-0 rounded-2xl surface p-2"
                      >
                        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-[var(--bg-soft)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.thumbUrl} alt={ph.name} className="max-h-full max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => removePhoto(ph.id)}
                            aria-label={`Remove ${ph.name}`}
                            className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white hover:bg-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1.5 truncate text-xs font-semibold" title={ph.name}>
                          {ph.name}
                        </p>
                        <p className={`text-[11px] ${dpi < SOFT_DPI ? "text-amber-400" : "text-muted"}`}>
                          {ph.width} × {ph.height} px · {dpi < SOFT_DPI ? `~${Math.round(dpi)} DPI, may look soft` : `~${Math.min(999, Math.round(dpi))} DPI`}
                        </p>
                        <div className="mt-1.5 grid grid-cols-2 gap-1" role="radiogroup" aria-label={`How ${ph.name} fits the print`}>
                          {(["fill", "fit"] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              role="radio"
                              aria-checked={ph.fit === f}
                              onClick={() => setFit(ph.id, f)}
                              className={`min-h-9 rounded-lg px-1 text-[11px] font-bold ${ph.fit === f ? chipOn : chipOff}`}
                            >
                              {f === "fill" ? "Fill (crop)" : "Fit (border)"}
                            </button>
                          ))}
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          )}

          {/* ----------------------------- options ----------------------------- */}
          <section aria-labelledby="pp-options" className="grid gap-5 lg:grid-cols-2">
            <h2 id="pp-options" className="text-base font-bold lg:col-span-2">
              Print size, paper and copies
            </h2>
            <div className="min-w-0 space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Photo size</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Photo size">
                  {SIZES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      role="radio"
                      aria-checked={sizeKey === s.key}
                      onClick={() => setSizeKey(s.key)}
                      className={`min-h-12 rounded-xl px-2 py-2 text-center transition-all ${sizeKey === s.key ? chipOn : chipOff}`}
                    >
                      <span className="block text-sm font-bold">{s.label}</span>
                      <span className="block text-[11px] opacity-80">{s.sub}</span>
                    </button>
                  ))}
                </div>
                {sizeKey === "custom" && (
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs font-semibold text-muted">Width</span>
                      <input inputMode="decimal" value={customW} onChange={(e) => setCustomW(e.target.value)} className={field} />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-xs font-semibold text-muted">Height</span>
                      <input inputMode="decimal" value={customH} onChange={(e) => setCustomH(e.target.value)} className={field} />
                    </label>
                    <select
                      aria-label="Unit"
                      value={unit}
                      onChange={(e) => {
                        const next = e.target.value as "mm" | "in";
                        if (next === unit) return;
                        const k = next === "in" ? 1 / 25.4 : 25.4;
                        const conv = (v: string) => (Number.isFinite(Number(v)) && v.trim() ? String(Math.round(Number(v) * k * 100) / 100) : v);
                        setCustomW(conv(customW));
                        setCustomH(conv(customH));
                        setUnit(next);
                      }}
                      className={`${field} !w-auto`}
                    >
                      <option value="mm">mm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                )}
                {sizeError && <p className="mt-2 text-xs text-red-400">{sizeError}</p>}
              </div>

              <div>
                <label htmlFor="pp-paper" className="mb-1.5 block text-xs font-semibold text-muted">
                  Paper in your printer
                </label>
                <select id="pp-paper" value={paperId} onChange={(e) => setPaperId(e.target.value)} className={field}>
                  {PAPERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Copies</span>
                <Segmented
                  label="Copies"
                  value={copiesMode}
                  onChange={setCopiesMode}
                  cols={2}
                  options={[
                    { key: "each", label: "Each photo × N" },
                    { key: "page", label: "Fill a page with each" },
                  ]}
                />
                {copiesMode === "each" && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="One copy fewer"
                      onClick={() => setCopiesText(String(clamp(copies - 1, 1, MAX_COPIES)))}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl surface text-muted hover:text-[var(--fg)]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <label className="block min-w-0 flex-1">
                      <span className="sr-only">Copies of each photo</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_COPIES}
                        value={copiesText}
                        onChange={(e) => setCopiesText(e.target.value)}
                        aria-invalid={!!copiesError}
                        className={`${field} text-center`}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="One copy more"
                      onClick={() => setCopiesText(String(clamp(copies + 1, 1, MAX_COPIES)))}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl surface text-muted hover:text-[var(--fg)]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {copiesError && <p className="mt-1 text-xs text-red-400">{copiesError}</p>}
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">How photos fit the print size</span>
                <Segmented
                  label="How photos fit the print size"
                  value={defaultFit}
                  onChange={(f) => {
                    setDefaultFit(f);
                    setPhotos((prev) => prev.map((p) => ({ ...p, fit: f })));
                  }}
                  cols={2}
                  options={[
                    { key: "fill", label: "Fill (crop to size)" },
                    { key: "fit", label: "Fit (white border)" },
                  ]}
                />
                <p className="mt-1 text-[11px] text-muted">Sets every photo (and new ones); change a single photo on its card.</p>
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--color-brand-500)]"
                />
                Auto-rotate photos to match the print (landscape / portrait)
              </label>
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Gap between photos</span>
                <Segmented
                  label="Gap between photos"
                  value={gap}
                  onChange={setGap}
                  options={[
                    { key: "0", label: "None" },
                    { key: "2", label: "2 mm" },
                    { key: "4", label: "4 mm" },
                  ]}
                />
              </div>
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Scissors className="h-3.5 w-3.5" /> Cutting guides
                </span>
                <Segmented
                  label="Cutting guides"
                  value={guides}
                  onChange={setGuides}
                  options={[
                    { key: "cut", label: "Cut lines" },
                    { key: "marks", label: "Crop marks" },
                    { key: "none", label: "None" },
                  ]}
                />
              </div>
              <div>
                <label htmlFor="pp-margin" className="mb-1.5 block text-xs font-semibold text-muted">
                  Page margin
                </label>
                <select id="pp-margin" value={marginPick} onChange={(e) => setMarginPick(e.target.value as MarginPick)} className={field}>
                  <option value="auto">Auto (recommended)</option>
                  <option value="6">6 mm</option>
                  <option value="3">3 mm</option>
                  <option value="0">None: borderless printing</option>
                </select>
              </div>
            </div>
          </section>

          {/* ----------------------------- preview ----------------------------- */}
          <section aria-labelledby="pp-preview">
            <h2 id="pp-preview" className="text-base font-bold">
              Preview
            </h2>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {sizeError || copiesError ? (
                "Fix the settings above first."
              ) : !pl.capacity ? (
                <span className="text-red-400">
                  {sizeLabel} doesn&apos;t fit on {paperName}. Pick a bigger paper or a smaller size.
                </span>
              ) : (
                <>
                  {sizeLabel}: <strong className="text-[var(--fg)]">{pl.capacity}</strong> per page ({pl.cols} × {pl.rows}
                  {pl.margin === 0 ? ", borderless" : ""}).
                  {photos.length > 0 && (
                    <>
                      {" "}
                      <strong className="text-[var(--fg)]">
                        {pl.total} {pl.total === 1 ? "print" : "prints"} on {pageCount} {pageCount === 1 ? "page" : "pages"}
                      </strong>
                      .
                    </>
                  )}
                </>
              )}
            </p>
            {pl.margin === 0 && pl.capacity > 0 && (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This needs borderless printing: turn on “Borderless” in your printer settings, or the edges will be cut off.
              </p>
            )}
            {tooManyPages && (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                That would be {pageCount} pages; the limit is {MAX_PAGES} at once. Lower the copies or remove some photos.
              </p>
            )}
            {photos.length > 0 && pageCount > 0 && !sizeError && !copiesError && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: Math.min(pageCount, PREVIEW_LIMIT) }, (_, i) => (
                  <figure key={i} className="min-w-0">
                    <canvas
                      ref={(el) => {
                        previewRefs.current[i] = el;
                      }}
                      role="img"
                      aria-label={`Page ${i + 1} preview`}
                      className="block h-auto w-full rounded-sm bg-white shadow-lg ring-1 ring-black/10"
                      style={{ aspectRatio: `${pl.wMm} / ${pl.hMm}` }}
                    />
                    <figcaption className="mt-1.5 text-center text-xs text-muted">
                      Page {i + 1} · {pl.pages[i]?.length ?? 0} {pl.pages[i]?.length === 1 ? "print" : "prints"}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {pageCount > PREVIEW_LIMIT && !tooManyPages && (
              <p className="mt-2 text-xs text-muted">+ {pageCount - PREVIEW_LIMIT} more pages (all included when you print or download).</p>
            )}
          </section>

          {/* ------------------------------ print ------------------------------ */}
          <section aria-labelledby="pp-print" className="space-y-3">
            <h2 id="pp-print" className="sr-only">
              Print or download
            </h2>
            <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 px-3 py-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-bold text-brand-400">
                <Info className="h-3.5 w-3.5" /> Before you print
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
                {PRINT_TIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
                <li>For glossy photo paper, choose the matching paper type (e.g. “Photo Paper Glossy”) and “High” quality.</li>
              </ul>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <motion.button
                type="button"
                onClick={() => void doPrint()}
                disabled={!ready || !!busy}
                whileTap={{ scale: 0.97 }}
                className={`${btnBase} ${primary}`}
              >
                {spin("print", <Printer className="h-4 w-4" />)}
                {busy === "print" ? "Preparing…" : pageCount > 1 ? `Print ${pageCount} pages` : "Print"}
              </motion.button>
              <button type="button" onClick={() => void downloadPdf()} disabled={!ready || !!busy} className={`${btnBase} ${secondary}`}>
                {spin("pdf", <FileText className="h-4 w-4" />)} {busy === "pdf" ? "Creating…" : "Download PDF"}
              </button>
              <button type="button" onClick={() => void downloadJpg()} disabled={!ready || !!busy} className={`${btnBase} ${secondary}`}>
                {spin("jpg", <Download className="h-4 w-4" />)} {busy === "jpg" ? "Creating…" : pageCount > 1 ? "Download JPGs" : "Download JPG"}
              </button>
              {ready && (
                <ShareSheet
                  label="Share PDF"
                  title="Photos ready to print"
                  text={`${pl.total} photo prints on ${paperName}, made with SnapGrab`}
                  getFiles={async () => [await pdfFile()]}
                />
              )}
            </div>
            <p className="flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
              Your photos never leave this device: layout, printing and the PDF are all made in your browser.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
