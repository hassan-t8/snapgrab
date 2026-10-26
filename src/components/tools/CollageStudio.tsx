"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeftRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { canvasToFile, urlsToFiles } from "@/components/ShareSheet";

/* ------------------------------------------------------------------ *
 * shared helpers
 * ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type Src = CanvasImageSource & { width: number; height: number };

const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);

/** Decodes a file into a canvas no larger than `maxSide` — keeps nine phone photos from exhausting memory. */
async function decodeTo(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  let img: Src;
  try {
    img = (await createImageBitmap(file)) as Src;
  } catch {
    const url = URL.createObjectURL(file);
    img = await new Promise<Src>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el as unknown as Src);
      el.onerror = () => reject(new Error("This file is not an image your browser can open."));
      el.src = url;
    }).finally(() => URL.revokeObjectURL(url));
  }
  const w = (img as HTMLImageElement).naturalWidth || img.width;
  const h = (img as HTMLImageElement).naturalHeight || img.height;
  if (!w || !h) throw new Error("This image appears to be empty.");
  const k = Math.min(1, maxSide / Math.max(w, h), Math.sqrt(16_000_000 / (w * h)));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  (img as ImageBitmap).close?.();
  return c;
}

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

function trackUsage(slug: string, files: number, bytesOut: number, outputType: string) {
  fetch("/api/tools/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ tool: slug, inputType: "image", outputType, files, bytesOut }),
  }).catch(() => {});
}

type View = { zoom: number; fx: number; fy: number };
const DEFAULT_VIEW: View = { zoom: 1, fx: 0, fy: 0 };

/** Cover-fit a source into a W×H box; fx/fy ∈ [-1, 1] pan across the overflow. */
function placement(sw: number, sh: number, W: number, H: number, v: View) {
  const base = Math.max(W / sw, H / sh);
  const dw = sw * base * v.zoom;
  const dh = sh * base * v.zoom;
  return { dx: ((W - dw) * (1 + v.fx)) / 2, dy: ((H - dh) * (1 + v.fy)) / 2, dw, dh };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const btnPrimary =
  "flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50";
const btnSoft = "flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60";

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
        active
          ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
          : "surface text-muted hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-semibold">
        {label}
        <span className="font-mono text-brand-400">
          {step < 1 ? value.toFixed(1) : value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-brand-500)]"
      />
    </label>
  );
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

function DropArea({ onFiles, multiple, busy, title, hint }: { onFiles: (f: File[]) => void; multiple: boolean; busy: boolean; title: string; hint: string }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pick = (list: FileList | null) => list?.length && onFiles(Array.from(list));
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
        className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${
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
        <button type="button" onClick={() => cameraRef.current?.click()} className={`${btnSoft} py-3 text-sm`}>
          <Camera className="h-4 w-4" /> Take a photo with the camera
        </button>
      </div>
    </>
  );
}

/** Two-finger pinch + one-finger pan over an element; reports the deltas against the gesture start. */
type Gesture<T> = { start: T; x: number; y: number; dist: number };

function pointerCentroid(map: Map<number, { x: number; y: number }>) {
  const pts = [...map.values()];
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
  return { x, y, dist };
}

/* ------------------------------------------------------------------ *
 * A. photo collage maker
 * ------------------------------------------------------------------ */

type Template = { id: string; label: string; cols: number; rows: number; cells: [number, number, number, number][] };

const g = (cols: number, rows: number): [number, number, number, number][] =>
  Array.from({ length: cols * rows }, (_, i) => [i % cols, Math.floor(i / cols), 1, 1]);

const TEMPLATES: Template[] = [
  { id: "g2", label: "2 side by side", cols: 2, rows: 1, cells: g(2, 1) },
  { id: "g2v", label: "2 stacked", cols: 1, rows: 2, cells: g(1, 2) },
  { id: "s3", label: "3 vertical strips", cols: 3, rows: 1, cells: g(3, 1) },
  { id: "s3v", label: "3 horizontal strips", cols: 1, rows: 3, cells: g(1, 3) },
  { id: "b12", label: "1 big + 2", cols: 2, rows: 2, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]] },
  { id: "b13", label: "1 big + 3", cols: 3, rows: 3, cells: [[0, 0, 3, 2], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]] },
  { id: "g4", label: "Grid of 4", cols: 2, rows: 2, cells: g(2, 2) },
  { id: "b15", label: "1 big + 5", cols: 3, rows: 3, cells: [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]] },
  { id: "g6", label: "Grid of 6", cols: 3, rows: 2, cells: g(3, 2) },
  { id: "g9", label: "Grid of 9", cols: 3, rows: 3, cells: g(3, 3) },
];
const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
const AUTO_TEMPLATE: Record<number, string> = { 1: "g2", 2: "g2", 3: "b12", 4: "g4", 5: "b15", 6: "g6", 7: "g9", 8: "g9", 9: "g9" };

const ASPECTS = [
  { id: "1:1", label: "1:1", hi: [2400, 2400], std: [1080, 1080] },
  { id: "4:5", label: "4:5", hi: [2160, 2700], std: [1080, 1350] },
  { id: "9:16", label: "9:16", hi: [2160, 3840], std: [1080, 1920] },
  { id: "16:9", label: "16:9", hi: [3840, 2160], std: [1920, 1080] },
  { id: "a4", label: "A4", hi: [2480, 3508], std: [1240, 1754] },
] as const;
type AspectId = (typeof ASPECTS)[number]["id"];

const BACKGROUNDS = ["#ffffff", "#000000", "#f5efe6", "#fde2e4", "#e0f2fe", "#1e1b4b"];
const MAX_PHOTOS = 9;

type Photo = { id: string; canvas: HTMLCanvasElement; thumb: string; name: string };
type Cell = { photo: string | null; view: View };
type Rect = { x: number; y: number; w: number; h: number };

/** Spacing and radius are set on a 1080 px reference and scaled to the output. */
function cellRects(t: Template, W: number, H: number, gapRef: number): Rect[] {
  const gap = (gapRef * Math.min(W, H)) / 1080;
  const cw = (W - gap * (t.cols + 1)) / t.cols;
  const ch = (H - gap * (t.rows + 1)) / t.rows;
  return t.cells.map(([c, r, cs, rs]) => ({
    x: gap + c * (cw + gap),
    y: gap + r * (ch + gap),
    w: cs * cw + (cs - 1) * gap,
    h: rs * ch + (rs - 1) * gap,
  }));
}

type DrawOpts = {
  template: Template;
  cells: Cell[];
  photos: Map<string, Photo>;
  gap: number;
  radius: number;
  bg: string;
  preview?: { selected: number; swapFrom: number | null; scale: number };
};

function drawCollage(ctx: CanvasRenderingContext2D, W: number, H: number, o: DrawOpts) {
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const rects = cellRects(o.template, W, H, o.gap);
  const r = (o.radius * Math.min(W, H)) / 1080;
  rects.forEach((rc, i) => {
    const cell = o.cells[i];
    const photo = cell?.photo ? o.photos.get(cell.photo) : undefined;
    ctx.save();
    roundRectPath(ctx, rc.x, rc.y, rc.w, rc.h, r);
    ctx.clip();
    if (photo) {
      const p = placement(photo.canvas.width, photo.canvas.height, rc.w, rc.h, cell.view);
      ctx.drawImage(photo.canvas, rc.x + p.dx, rc.y + p.dy, p.dw, p.dh);
    } else if (o.preview) {
      ctx.fillStyle = "rgba(128,128,160,0.22)";
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      const s = o.preview.scale;
      ctx.fillStyle = "rgba(110,110,140,0.95)";
      ctx.font = `600 ${Math.round(14 / s)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+ Add photo", rc.x + rc.w / 2, rc.y + rc.h / 2);
    }
    ctx.restore();
    if (o.preview && (i === o.preview.selected || i === o.preview.swapFrom)) {
      const s = o.preview.scale;
      ctx.save();
      ctx.lineWidth = 3 / s;
      ctx.strokeStyle = i === o.preview.swapFrom ? "#f59e0b" : "#7048f0";
      if (i === o.preview.swapFrom) ctx.setLineDash([8 / s, 6 / s]);
      roundRectPath(ctx, rc.x + 1.5 / s, rc.y + 1.5 / s, rc.w - 3 / s, rc.h - 3 / s, r);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function TemplateIcon({ t }: { t: Template }) {
  const rects = cellRects(t, 40, 40, 70);
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} className="fill-current opacity-70" />
      ))}
    </svg>
  );
}

let photoSeq = 0;

function Collage({ tool }: { tool: Tool }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [templateId, setTemplateId] = useState("g4");
  const [cells, setCells] = useState<Cell[]>(() => TEMPLATE_MAP.g4.cells.map(() => ({ photo: null, view: DEFAULT_VIEW })));
  const [aspect, setAspect] = useState<AspectId>("1:1");
  const [hiRes, setHiRes] = useState(true);
  const [gap, setGap] = useState(16);
  const [radius, setRadius] = useState(12);
  const [bg, setBg] = useState("#ffffff");
  const [selected, setSelected] = useState(0);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetCell = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<(Gesture<View> & { cell: number; k: number }) | null>(null);
  const thumbs = useRef<string[]>([]);
  const used = useRef(false);

  const template = TEMPLATE_MAP[templateId];
  const asp = ASPECTS.find((a) => a.id === aspect)!;
  const [W, H] = hiRes ? asp.hi : asp.std;
  const photoMap = new Map(photos.map((p) => [p.id, p]));

  useEffect(() => {
    thumbs.current = photos.map((p) => p.thumb);
  }, [photos]);
  useEffect(() => () => thumbs.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // draw the live preview whenever anything changes (and when the canvas is resized)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map = new Map(photos.map((p) => [p.id, p]));
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const s = pw / W;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawCollage(ctx, W, H, { template, cells, photos: map, gap, radius, bg, preview: { selected, swapFrom, scale: s / dpr } });
    };
    const raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [photos, cells, template, W, H, gap, radius, bg, selected, swapFrom]);

  /** Re-deals photos onto a template: those already placed keep their order, new ones fill in after. */
  function deal(t: Template, current: Cell[], all: Photo[]): Cell[] {
    const order = current.map((c) => c.photo).filter((p): p is string => !!p && all.some((x) => x.id === p));
    all.forEach((p) => !order.includes(p.id) && order.push(p.id));
    return t.cells.map((_, i) => ({ photo: order[i] ?? null, view: DEFAULT_VIEW }));
  }

  function chooseTemplate(id: string) {
    const t = TEMPLATE_MAP[id];
    setTemplateId(id);
    setCells(deal(t, cells, photos));
    setSelected(0);
    setSwapFrom(null);
    if (photos.length > t.cells.length) notify.info("Some photos aren't shown", `This layout has ${t.cells.length} spaces — pick a bigger one to use all ${photos.length}.`);
  }

  async function addFiles(files: File[], into: number | null) {
    const images = files.filter(isImage);
    if (!images.length) {
      notify.error("No images found", "Choose JPG, PNG or WEBP photos.");
      return;
    }
    const room = MAX_PHOTOS - photos.length + (into !== null && cells[into]?.photo ? 1 : 0);
    if (room <= 0) {
      notify.warning("9 photos is the limit", "Remove one from the tray to add another.");
      return;
    }
    if (images.length > room) notify.warning(`Only ${room} more photo${room === 1 ? "" : "s"} fit`, "A collage holds up to 9 photos.");
    setAdding(true);
    const added: Photo[] = [];
    for (const file of images.slice(0, room)) {
      try {
        const canvas = await decodeTo(file, 2048);
        const thumbCanvas = document.createElement("canvas");
        const k = 160 / Math.max(canvas.width, canvas.height);
        thumbCanvas.width = Math.max(1, Math.round(canvas.width * k));
        thumbCanvas.height = Math.max(1, Math.round(canvas.height * k));
        thumbCanvas.getContext("2d")?.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const thumb = URL.createObjectURL(await toBlob(thumbCanvas, "image/jpeg", 0.8));
        added.push({ id: `p${photoSeq++}`, canvas, thumb, name: file.name });
      } catch {
        notify.error("Could not open a photo", `${file.name} isn't an image your browser can read.`);
      }
    }
    setAdding(false);
    if (!added.length) return;

    let all = [...photos, ...added];
    let next = cells.map((c) => ({ ...c }));
    let tId = templateId;
    const queue = [...added];
    if (into !== null) {
      const replaced = next[into]?.photo;
      next[into] = { photo: queue.shift()!.id, view: DEFAULT_VIEW };
      if (replaced) {
        const old = photos.find((p) => p.id === replaced);
        if (old) URL.revokeObjectURL(old.thumb);
        all = all.filter((p) => p.id !== replaced);
      }
    }
    for (const p of queue) {
      const empty = next.findIndex((c) => !c.photo);
      if (empty >= 0) next[empty] = { photo: p.id, view: DEFAULT_VIEW };
    }
    const placed = next.filter((c) => c.photo).length;
    if (placed < all.length) {
      tId = AUTO_TEMPLATE[all.length] ?? "g9";
      next = deal(TEMPLATE_MAP[tId], next, all);
    }
    setPhotos(all);
    setTemplateId(tId);
    setCells(next);
  }

  function removePhoto(id: string) {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.thumb);
    setPhotos((prev) => prev.filter((x) => x.id !== id));
    setCells((prev) => prev.map((c) => (c.photo === id ? { photo: null, view: DEFAULT_VIEW } : c)));
  }

  function placePhoto(id: string) {
    setCells((prev) => {
      const next = prev.map((c) => ({ ...c }));
      const from = next.findIndex((c) => c.photo === id);
      if (from === selected) return prev;
      const current = next[selected]?.photo ?? null;
      if (from >= 0) next[from] = { photo: current, view: DEFAULT_VIEW }; // swap if already placed elsewhere
      next[selected] = { photo: id, view: DEFAULT_VIEW };
      return next;
    });
  }

  function swapCells(a: number, b: number) {
    setCells((prev) => {
      const next = prev.map((c) => ({ ...c }));
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  function clearAll() {
    photos.forEach((p) => URL.revokeObjectURL(p.thumb));
    setPhotos([]);
    setCells(template.cells.map(() => ({ photo: null, view: DEFAULT_VIEW })));
    setSelected(0);
    setSwapFrom(null);
  }

  function setCellView(i: number, view: View) {
    setCells((prev) => prev.map((c, j) => (j === i ? { ...c, view } : c)));
  }

  /* ------------------------------ canvas input ------------------------------ */

  function hitCell(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    return cellRects(template, W, H, gap).findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  function beginGesture(cell: number) {
    const canvas = canvasRef.current;
    if (!canvas || !cells[cell]?.photo) {
      gesture.current = null;
      return;
    }
    const c = pointerCentroid(pointers.current);
    gesture.current = { start: cells[cell].view, ...c, cell, k: W / canvas.getBoundingClientRect().width };
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (pointers.current.size === 0) {
      const i = hitCell(e.clientX, e.clientY);
      if (i < 0) return;
      if (swapFrom !== null) {
        if (i !== swapFrom) {
          swapCells(swapFrom, i);
          notify.success("Photos swapped");
        }
        setSwapFrom(null);
        setSelected(i);
        return;
      }
      setSelected(i);
      if (!cells[i]?.photo) {
        targetCell.current = i;
        fileRef.current?.click();
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      beginGesture(i);
      return;
    }
    if (!gesture.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture(gesture.current.cell);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const gs = gesture.current;
    if (!gs || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = pointerCentroid(pointers.current);
    const cell = cells[gs.cell];
    const photo = cell?.photo ? photoMap.get(cell.photo) : undefined;
    if (!photo) return;
    const rc = cellRects(template, W, H, gap)[gs.cell];
    const zoom = pointers.current.size > 1 && gs.dist > 0 ? clamp(gs.start.zoom * (now.dist / gs.dist), 1, 5) : gs.start.zoom;
    const p = placement(photo.canvas.width, photo.canvas.height, rc.w, rc.h, { ...gs.start, zoom });
    const fx = p.dw > rc.w + 0.5 ? clamp(gs.start.fx - (2 * (now.x - gs.x) * gs.k) / (p.dw - rc.w), -1, 1) : 0;
    const fy = p.dh > rc.h + 0.5 ? clamp(gs.start.fy - (2 * (now.y - gs.y) * gs.k) / (p.dh - rc.h), -1, 1) : 0;
    setCellView(gs.cell, { zoom, fx, fy });
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size && gesture.current) beginGesture(gesture.current.cell);
    else gesture.current = null;
  }

  function onCanvasKey(e: KeyboardEvent<HTMLCanvasElement>) {
    const cell = cells[selected];
    if (!cell) return;
    if (e.key === "Tab") return;
    const step = e.shiftKey ? 0.2 : 0.05;
    const v = cell.view;
    const moves: Record<string, View> = {
      ArrowLeft: { ...v, fx: clamp(v.fx + step, -1, 1) },
      ArrowRight: { ...v, fx: clamp(v.fx - step, -1, 1) },
      ArrowUp: { ...v, fy: clamp(v.fy + step, -1, 1) },
      ArrowDown: { ...v, fy: clamp(v.fy - step, -1, 1) },
      "+": { ...v, zoom: clamp(v.zoom + 0.1, 1, 5) },
      "=": { ...v, zoom: clamp(v.zoom + 0.1, 1, 5) },
      "-": { ...v, zoom: clamp(v.zoom - 0.1, 1, 5) },
    };
    if (moves[e.key] && cell.photo) {
      e.preventDefault();
      setCellView(selected, moves[e.key]);
    } else if (e.key === "]" || e.key === "[") {
      e.preventDefault();
      setSelected((s) => (s + (e.key === "]" ? 1 : cells.length - 1)) % cells.length);
    }
  }

  /* --------------------------------- export --------------------------------- */

  function renderExport() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    drawCollage(ctx, W, H, { template, cells, photos: photoMap, gap, radius, bg });
    return c;
  }

  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const fileName = `collage-${W}x${H}.${format}`;

  async function download() {
    if (exporting) return;
    const empty = cells.filter((c) => !c.photo).length;
    if (empty) notify.warning(`${empty} empty space${empty === 1 ? "" : "s"}`, "They'll show as background colour — add photos or pick a smaller layout.");
    setExporting(true);
    try {
      const c = renderExport();
      const blob = await toBlob(c, mime, format === "jpg" ? 0.92 : undefined);
      c.width = c.height = 0;
      const url = URL.createObjectURL(blob);
      clickDownload(url, fileName);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      trackEvent("download");
      if (!used.current) {
        used.current = true;
        trackUsage(tool.slug, photos.length, blob.size, mime);
      }
      notify.success("Collage saved", `${W}×${H} px ${format.toUpperCase()}`);
    } catch (err) {
      notify.error("Could not create the collage", err instanceof Error ? err.message : "Try a smaller size.");
    } finally {
      setExporting(false);
    }
  }

  const sel = cells[selected];
  const selPhoto = sel?.photo ? photoMap.get(sel.photo) : undefined;
  const ratio = W / H;

  return (
    <Shell note="Your photos are arranged and exported in your browser — nothing is uploaded.">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const into = targetCell.current;
          targetCell.current = null;
          if (e.target.files?.length) void addFiles(Array.from(e.target.files), into !== null && e.target.files.length === 1 ? into : null);
          e.target.value = "";
        }}
      />

      {!photos.length ? (
        <DropArea
          onFiles={(f) => void addFiles(f, null)}
          multiple
          busy={adding}
          title={adding ? "Opening photos…" : "Drop 2–9 photos, or tap to browse"}
          hint="JPG, PNG, WEBP · you can add more later"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="min-w-0">
            <div className="mx-auto" style={{ width: `min(100%, 560px, ${Math.round(ratio * 70)}vh)` }}>
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="application"
                aria-label="Collage preview. Tap a space to select it, drag to move the photo, pinch to zoom. Arrow keys move, plus and minus zoom, brackets change space."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onCanvasKey}
                className="block w-full touch-none select-none rounded-lg shadow-xl outline-none ring-brand-400 focus-visible:ring-2"
                style={{ aspectRatio: `${W} / ${H}`, cursor: swapFrom !== null ? "crosshair" : "grab" }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-muted" aria-live="polite">
              {swapFrom !== null ? "Now tap the space to swap with" : "Tap a space to select · drag to move · pinch or slider to zoom"}
            </p>

            {/* selected cell */}
            <div className="mt-4 rounded-2xl surface p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Previous space" onClick={() => setSelected((s) => (s + cells.length - 1) % cells.length)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-[var(--fg)]">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="whitespace-nowrap text-sm font-bold">
                    Space {selected + 1} of {cells.length}
                  </span>
                  <button type="button" aria-label="Next space" onClick={() => setSelected((s) => (s + 1) % cells.length)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-[var(--fg)]">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSwapFrom((s) => (s === null ? selected : null))}
                    disabled={cells.length < 2}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${swapFrom !== null ? "bg-amber-500/15 text-amber-500" : "bg-[var(--bg-soft)] text-muted hover:text-[var(--fg)]"}`}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> {swapFrom !== null ? "Cancel swap" : "Swap"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      targetCell.current = selected;
                      fileRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-xs font-bold text-muted hover:text-[var(--fg)]"
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> {sel?.photo ? "Replace" : "Add"}
                  </button>
                  {sel?.photo && (
                    <button
                      type="button"
                      aria-label="Empty this space"
                      onClick={() => setCells((prev) => prev.map((c, j) => (j === selected ? { photo: null, view: DEFAULT_VIEW } : c)))}
                      className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--bg-soft)] text-muted hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
              {selPhoto && (
                <div className="mt-3">
                  <Slider label="Zoom" value={sel.view.zoom} min={1} max={5} step={0.05} unit="×" onChange={(zoom) => setCellView(selected, { ...sel.view, zoom })} />
                </div>
              )}
            </div>

            {/* tray */}
            <div className="mt-4">
              <span className="mb-2 block text-sm font-semibold">
                Your photos ({photos.length}/{MAX_PHOTOS}) <span className="font-normal text-muted">— tap one to put it in the selected space</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => {
                  const where = cells.findIndex((c) => c.photo === p.id);
                  return (
                    <span key={p.id} className="relative">
                      <button
                        type="button"
                        onClick={() => placePhoto(p.id)}
                        aria-label={`Put ${p.name} in space ${selected + 1}`}
                        className={`block h-16 w-16 overflow-hidden rounded-xl border-2 ${where === selected ? "border-brand-500" : where >= 0 ? "border-transparent" : "border-dashed border-amber-400"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        aria-label={`Remove ${p.name}`}
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--card)] text-muted shadow ring-1 ring-[var(--line)] hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => {
                      targetCell.current = null;
                      fileRef.current?.click();
                    }}
                    className="grid h-16 w-16 place-items-center rounded-xl border-2 border-dashed border-[var(--line)] text-muted hover:border-brand-400/60 hover:text-[var(--fg)]"
                    aria-label="Add photos"
                  >
                    {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* settings */}
          <div className="min-w-0 space-y-5">
            <div>
              <span className="mb-2 block text-sm font-semibold">Layout</span>
              <div className="grid grid-cols-5 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => chooseTemplate(t.id)}
                    aria-pressed={t.id === templateId}
                    aria-label={t.label}
                    title={t.label}
                    className={`grid aspect-square place-items-center rounded-xl transition-all ${t.id === templateId ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"}`}
                  >
                    <TemplateIcon t={t} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold">Shape</span>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <Chip key={a.id} active={aspect === a.id} onClick={() => setAspect(a.id)}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </div>
            <Slider label="Spacing" value={gap} min={0} max={60} onChange={setGap} />
            <Slider label="Corner radius" value={radius} min={0} max={80} onChange={setRadius} />
            <div>
              <span className="mb-2 block text-sm font-semibold">Background</span>
              <div className="flex flex-wrap items-center gap-2">
                {BACKGROUNDS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBg(c)}
                    aria-label={`Background ${c}`}
                    aria-pressed={bg === c}
                    className={`h-9 w-9 rounded-full ring-1 ring-[var(--line)] ${bg === c ? "outline outline-2 outline-offset-2 outline-brand-500" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label
                  className={`relative h-9 w-9 cursor-pointer overflow-hidden rounded-full ring-1 ring-[var(--line)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500 ${BACKGROUNDS.includes(bg) ? "" : "outline outline-2 outline-offset-2 outline-brand-500"}`}
                  title="Custom colour"
                  style={{ background: BACKGROUNDS.includes(bg) ? "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)" : bg }}
                >
                  <span className="sr-only">Custom background colour</span>
                  <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-2 block text-sm font-semibold">Format</span>
                <div className="flex gap-2">
                  <Chip active={format === "jpg"} onClick={() => setFormat("jpg")}>
                    JPG
                  </Chip>
                  <Chip active={format === "png"} onClick={() => setFormat("png")}>
                    PNG
                  </Chip>
                </div>
              </div>
              <div>
                <span className="mb-2 block text-sm font-semibold">Size</span>
                <div className="flex gap-2">
                  <Chip active={!hiRes} onClick={() => setHiRes(false)}>
                    Std
                  </Chip>
                  <Chip active={hiRes} onClick={() => setHiRes(true)}>
                    High
                  </Chip>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted">
              Output: {W}×{H} px{aspect === "a4" ? (hiRes ? " (A4 at 300 DPI)" : " (A4 at 150 DPI)") : ""}.
            </p>

            <div className="flex flex-wrap gap-2">
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => void download()} disabled={exporting} className={`${btnPrimary} flex-1 whitespace-nowrap px-5`}>
                {exporting ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Download className="h-[18px] w-[18px]" />}
                {exporting ? "Saving…" : `Download ${format.toUpperCase()}`}
              </motion.button>
              <ShareSheet
                title={tool.name}
                text={`Made with the free ${tool.name} on SnapGrab`}
                getFiles={async () => {
                  const c = renderExport();
                  const file = await canvasToFile(c, fileName, mime, 0.92);
                  c.width = c.height = 0;
                  return [file];
                }}
              />
              <button type="button" onClick={clearAll} className={`${btnSoft} text-muted hover:text-red-400`}>
                <RotateCcw className="h-[18px] w-[18px]" /> Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ *
 * B. Instagram grid splitter
 * ------------------------------------------------------------------ */

const TILE_SIZES = [
  { id: "3:4", w: 1080, h: 1440, label: "3:4 · 1080×1440", hint: "matches the profile grid" },
  { id: "4:5", w: 1080, h: 1350, label: "4:5 · 1080×1350", hint: "tallest feed post" },
  { id: "1:1", w: 1080, h: 1080, label: "1:1 · 1080×1080", hint: "classic square" },
] as const;
type TileId = (typeof TILE_SIZES)[number]["id"];

type TileOut = { url: string; name: string; order: number; row: number; col: number; size: number };

/** Instagram puts the newest post top-left, so the bottom-right tile goes up first. */
const postOrder = (row: number, col: number, rows: number) => (rows - 1 - row) * 3 + (2 - col) + 1;

function GridSplit({ tool }: { tool: Tool }) {
  const [src, setSrc] = useState<{ canvas: HTMLCanvasElement; url: string; name: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [rows, setRows] = useState(3);
  const [tileId, setTileId] = useState<TileId>("3:4");
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [tiles, setTiles] = useState<{ key: string; items: TileOut[] } | null>(null);
  const [making, setMaking] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<(Gesture<View> & { k: number }) | null>(null);
  const urls = useRef<string[]>([]);
  const used = useRef(false);

  const tile = TILE_SIZES.find((t) => t.id === tileId)!;
  const W = tile.w * 3;
  const H = tile.h * rows;
  const key = src ? [src.url, rows, tileId, view.zoom, view.fx, view.fy].join("|") : "";
  const fresh = tiles && tiles.key === key ? tiles.items : null;

  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function track(url: string) {
    urls.current.push(url);
    return url;
  }

  async function openFile(files: File[]) {
    const file = files.find(isImage);
    if (!file) {
      notify.error("That isn't an image", "Choose a JPG, PNG or WEBP photo.");
      return;
    }
    setOpening(true);
    try {
      const canvas = await decodeTo(file, 6000);
      const url = track(URL.createObjectURL(await toBlob(canvas, "image/jpeg", 0.9)));
      setSrc({ canvas, url, name: file.name });
      setView(DEFAULT_VIEW);
      setTiles(null);
      if (Math.max(canvas.width, canvas.height) < 1500) notify.warning("Small image", "Tiles will look soft — use a larger original if you have one.");
    } catch (err) {
      notify.error("Could not open this image", err instanceof Error ? err.message : "Try a JPG or PNG.");
    } finally {
      setOpening(false);
    }
  }

  function reset() {
    setSrc(null);
    setTiles(null);
    setView(DEFAULT_VIEW);
  }

  function beginGesture() {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !pointers.current.size) return;
    gesture.current = { start: view, ...pointerCentroid(pointers.current), k: W / rect.width };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture();
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const gs = gesture.current;
    if (!gs || !src || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = pointerCentroid(pointers.current);
    const zoom = pointers.current.size > 1 && gs.dist > 0 ? clamp(gs.start.zoom * (now.dist / gs.dist), 1, 5) : gs.start.zoom;
    const p = placement(src.canvas.width, src.canvas.height, W, H, { ...gs.start, zoom });
    const fx = p.dw > W + 0.5 ? clamp(gs.start.fx - (2 * (now.x - gs.x) * gs.k) / (p.dw - W), -1, 1) : 0;
    const fy = p.dh > H + 0.5 ? clamp(gs.start.fy - (2 * (now.y - gs.y) * gs.k) / (p.dh - H), -1, 1) : 0;
    setView({ zoom, fx, fy });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) beginGesture();
    else gesture.current = null;
  }

  function onFrameKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.2 : 0.05;
    const v = view;
    const moves: Record<string, View> = {
      ArrowLeft: { ...v, fx: clamp(v.fx + step, -1, 1) },
      ArrowRight: { ...v, fx: clamp(v.fx - step, -1, 1) },
      ArrowUp: { ...v, fy: clamp(v.fy + step, -1, 1) },
      ArrowDown: { ...v, fy: clamp(v.fy - step, -1, 1) },
      "+": { ...v, zoom: clamp(v.zoom + 0.1, 1, 5) },
      "=": { ...v, zoom: clamp(v.zoom + 0.1, 1, 5) },
      "-": { ...v, zoom: clamp(v.zoom - 0.1, 1, 5) },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setView(moves[e.key]);
    }
  }

  async function makeTiles() {
    if (!src || making) return;
    setMaking(true);
    try {
      const p = placement(src.canvas.width, src.canvas.height, W, H, view);
      const base = (src.name.replace(/\.[^.]+$/, "") || "grid").slice(0, 40);
      const items: TileOut[] = [];
      const c = document.createElement("canvas");
      c.width = tile.w;
      c.height = tile.h;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");
      ctx.imageSmoothingQuality = "high";
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, tile.w, tile.h);
          ctx.drawImage(src.canvas, p.dx - col * tile.w, p.dy - row * tile.h, p.dw, p.dh);
          const blob = await toBlob(c, "image/jpeg", 0.92);
          const order = postOrder(row, col, rows);
          items.push({ url: track(URL.createObjectURL(blob)), name: `${base}-post-${String(order).padStart(2, "0")}-of-${rows * 3}.jpg`, order, row, col, size: blob.size });
        }
      }
      c.width = c.height = 0;
      items.sort((a, b) => a.order - b.order);
      setTiles({ key, items });
      trackEvent("process");
      if (!used.current) {
        used.current = true;
        trackUsage(tool.slug, items.length, items.reduce((s, t) => s + t.size, 0), "image/jpeg");
      }
      notify.success(`${items.length} tiles ready`, "Post them in number order, starting with 1.");
    } catch (err) {
      notify.error("Could not split the image", err instanceof Error ? err.message : "Try a smaller image.");
    } finally {
      setMaking(false);
    }
  }

  function downloadAll() {
    if (!fresh) return;
    trackEvent("download-all");
    notify.info(`Downloading ${fresh.length} tiles`, "Allow multiple downloads if your browser asks.");
    fresh.forEach((t, i) => setTimeout(() => clickDownload(t.url, t.name), i * 300));
  }

  const place = src ? placement(src.canvas.width, src.canvas.height, W, H, view) : null;
  const frameW = Math.round(Math.min(560, (W / H) * 440));
  // profile thumbnails are 3:4 — work out what part of each tile they show
  const cropW = Math.min(tile.w, tile.h * 0.75);
  const cropH = Math.min(tile.h, tile.w / 0.75);

  return (
    <Shell note="Your photo is split in your browser — nothing is uploaded.">
      {!src ? (
        <DropArea onFiles={(f) => void openFile(f)} multiple={false} busy={opening} title={opening ? "Opening…" : "Drop one photo, or tap to browse"} hint="A wide or detailed photo works best · JPG, PNG, WEBP" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="min-w-0">
            <div
              ref={frameRef}
              role="application"
              tabIndex={0}
              aria-label="Grid crop. Drag or use the arrow keys to move the photo; pinch, plus and minus zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onFrameKey}
              className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-md bg-white shadow-xl outline-none ring-brand-400 focus-visible:ring-2 active:cursor-grabbing"
              style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, ${frameW}px)` }}
            >
              {place && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src.url}
                  alt="Your photo inside the grid"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none"
                  style={{ left: `${(place.dx / W) * 100}%`, top: `${(place.dy / H) * 100}%`, width: `${(place.dw / W) * 100}%`, height: `${(place.dh / H) * 100}%` }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                {Array.from({ length: rows * 3 }, (_, i) => {
                  const row = Math.floor(i / 3);
                  const col = i % 3;
                  return (
                    <span key={i} className="relative border border-white/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]">
                      <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-black/60 px-1.5 text-xs font-bold text-white">
                        {postOrder(row, col, rows)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted">Drag to position · pinch or slider to zoom · numbers show the posting order</p>
            <div className="mt-4">
              <Slider label="Zoom" value={view.zoom} min={1} max={5} step={0.05} unit="×" onChange={(zoom) => setView((v) => ({ ...v, zoom }))} />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <span className="mb-2 block text-sm font-semibold">Grid</span>
              <div className="flex gap-2">
                {[1, 2, 3].map((r) => (
                  <Chip key={r} active={rows === r} onClick={() => setRows(r)}>
                    3×{r}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold">Tile size</span>
              <div className="space-y-2">
                {TILE_SIZES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTileId(t.id)}
                    aria-pressed={tileId === t.id}
                    className={`block w-full rounded-xl px-3.5 py-2.5 text-left text-sm transition-all ${tileId === t.id ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface hover:border-brand-400/60"}`}
                  >
                    <span className="block font-bold">{t.label}</span>
                    <span className={`block text-xs ${tileId === t.id ? "text-white/80" : "text-muted"}`}>{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* profile preview */}
            <div>
              <span className="mb-2 block text-sm font-semibold">How it looks on your profile</span>
              <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-xl bg-[var(--line)]">
                {Array.from({ length: rows * 3 }, (_, i) => {
                  const row = Math.floor(i / 3);
                  const col = i % 3;
                  const cx = col * tile.w + (tile.w - cropW) / 2;
                  const cy = row * tile.h + (tile.h - cropH) / 2;
                  return (
                    <span key={i} className="relative block aspect-[3/4] overflow-hidden bg-white">
                      {place && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src.url}
                          alt=""
                          draggable={false}
                          className="pointer-events-none absolute max-w-none"
                          style={{ left: `${((place.dx - cx) / cropW) * 100}%`, top: `${((place.dy - cy) / cropH) * 100}%`, width: `${(place.dw / cropW) * 100}%`, height: `${(place.dh / cropH) * 100}%` }}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                Instagram&apos;s profile grid shows 3:4 thumbnails{tileId === "3:4" ? ", so 3:4 tiles line up edge to edge." : ", so the sides of each tile are trimmed there; opening a post shows the full tile."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => void makeTiles()} disabled={making} className={`${btnPrimary} flex-1`}>
                {making ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
                {making ? "Splitting…" : fresh ? "Split again" : `Split into ${rows * 3} tiles`}
              </motion.button>
              <button type="button" onClick={reset} className={`${btnSoft} text-muted hover:text-red-400`}>
                <Trash2 className="h-[18px] w-[18px]" /> Change photo
              </button>
            </div>
            {tiles && !fresh && (
              <p className="flex items-center gap-2 text-sm text-amber-500" role="status">
                <AlertCircle className="h-4 w-4 shrink-0" /> Settings changed — split again to update the tiles.
              </p>
            )}
          </div>
        </div>
      )}

      {fresh && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 border-t border-[var(--line)] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadAll} className={`${btnPrimary} flex-1 sm:flex-none`}>
              <Download className="h-[18px] w-[18px]" /> Download all ({fresh.length})
            </button>
            <ShareSheet
              title={tool.name}
              text={`Split with the free ${tool.name} on SnapGrab`}
              label={`Share all (${fresh.length})`}
              getFiles={() => urlsToFiles(fresh.map((t) => ({ url: t.url, name: t.name })))}
            />
          </div>
          <ol className="mt-4 space-y-1 text-sm text-muted">
            <li>
              <b className="text-[var(--fg)]">Post tile 1 first and tile {fresh.length} last.</b> Instagram puts the newest post in the top-left corner, so the
              bottom-right piece has to go up first.
            </li>
            <li>Upload each tile as its own single-photo post (not a carousel) and don&apos;t post anything else in between.</li>
            <li>Pinned posts sit in front of the grid — unpin them first if you want the picture to line up.</li>
          </ol>
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {fresh.map((t) => (
              <li key={t.name} className="min-w-0">
                <a
                  href={t.url}
                  download={t.name}
                  onClick={() => trackEvent("download")}
                  className="group relative block overflow-hidden rounded-lg ring-1 ring-[var(--line)]"
                  style={{ aspectRatio: `${tile.w} / ${tile.h}` }}
                  aria-label={`Download tile ${t.order}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.url} alt={`Tile ${t.order}`} className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 grid h-6 min-w-6 place-items-center rounded-full bg-black/65 px-1.5 text-xs font-bold text-white">{t.order}</span>
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] font-bold text-white opacity-90 group-hover:opacity-100">
                    <Download className="h-3 w-3" /> Save
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

export default function CollageStudio({ tool }: { tool: Tool }) {
  return String(tool.mode ?? "collage") === "grid-split" ? <GridSplit tool={tool} /> : <Collage tool={tool} />;
}
