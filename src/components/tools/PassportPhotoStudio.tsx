"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Camera,
  Contrast,
  Download,
  FileText,
  Info,
  Loader2,
  Move,
  Palette,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * presets & constants
 * ------------------------------------------------------------------ */

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";

const DPI = 300;
const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI);

type PresetKey = "pk" | "uk" | "us" | "ca" | "custom";

type Preset = {
  key: PresetKey;
  label: string;
  w: number;
  h: number;
  /** guide positions as a fraction of the frame height */
  top: number;
  chin: number;
  hint: string;
};

const PRESETS: Preset[] = [
  {
    key: "pk",
    label: "Pakistan passport & NADRA CNIC — 35 × 45 mm",
    w: 35,
    h: 45,
    top: 0.09,
    chin: 0.84,
    hint: "Face the camera, neutral expression, eyes open. Head (chin to crown) roughly 32–36 mm; white or light background.",
  },
  {
    key: "uk",
    label: "UK / Schengen visa — 35 × 45 mm",
    w: 35,
    h: 45,
    top: 0.09,
    chin: 0.82,
    hint: "Head (chin to crown) 29–34 mm for UK, 32–36 mm for Schengen. Plain light grey or cream background works best.",
  },
  {
    key: "us",
    label: "US visa & passport — 2 × 2 in (51 × 51 mm)",
    w: 50.8,
    h: 50.8,
    top: 0.12,
    chin: 0.74,
    hint: "Head 1–1⅜ in (25–35 mm) from chin to top of hair. White or off-white background, no glasses.",
  },
  {
    key: "ca",
    label: "Canada passport — 50 × 70 mm",
    w: 50,
    h: 70,
    top: 0.16,
    chin: 0.65,
    hint: "Face (chin to crown) 31–36 mm. Plain white or light-coloured background with even lighting.",
  },
  {
    key: "custom",
    label: "Custom (mm)",
    w: 35,
    h: 45,
    top: 0.1,
    chin: 0.82,
    hint: "Check the exact size and head-height rules published by the office you are applying to.",
  },
];

const BACKGROUNDS = [
  { key: "white", label: "White", value: "#ffffff" },
  { key: "blue", label: "Light blue", value: "#d6e6f5" },
  { key: "grey", label: "Light grey", value: "#e7e7e7" },
] as const;

type SheetKey = "4x6" | "a4";

const SHEETS: Record<SheetKey, { label: string; w: number; h: number; wPt: number; hPt: number; margin: number }> = {
  "4x6": { label: "4 × 6 in photo paper", w: 1200, h: 1800, wPt: 288, hPt: 432, margin: 36 },
  a4: { label: "A4 paper", w: 2480, h: 3508, wPt: 595.28, hPt: 841.89, margin: 118 },
};

/** 1.5 mm between copies at 300 DPI — leaves room for a clean cut. */
const GAP = 18;

type View = { zoom: number; fx: number; fy: number };
const DEFAULT_VIEW: View = { zoom: 1, fx: 0, fy: 0 };

type Source = { file: File; url: string; img: HTMLImageElement; width: number; height: number };

type Busy = null | "photo" | "sheet-jpg" | "sheet-pdf";

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

/** Where the image sits inside a W×H frame for a given view — shared by the preview and the export. */
function placement(iw: number, ih: number, W: number, H: number, view: View) {
  const s = Math.max(W / iw, H / ih) * view.zoom;
  const dw = iw * s;
  const dh = ih * s;
  return { s, dw, dh, dx: W / 2 + view.fx * W - dw / 2, dy: H / 2 + view.fy * H - dh / 2 };
}

/** Same maths as CSS `brightness(b) contrast(c)`, applied per pixel (ctx.filter is missing in older Safari). */
function adjust(canvas: HTMLCanvasElement, brightness: number, contrast: number) {
  if (brightness === 100 && contrast === 100) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const b = brightness / 100;
  const c = contrast / 100;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v * b - 127.5) * c + 127.5;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    px[i] = lut[px[i]];
    px[i + 1] = lut[px[i + 1]];
    px[i + 2] = lut[px[i + 2]];
  }
  ctx.putImageData(data, 0, 0);
}

function renderPhoto(src: Source, W: number, H: number, view: View, bg: string, brightness: number, contrast: number) {
  const { dw, dh, dx, dy } = placement(src.width, src.height, W, H, view);

  // draw the photo on its own layer first so the brightness/contrast tweak never tints the fill colour
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const lctx = layer.getContext("2d");
  if (!lctx) throw new Error("Canvas is unavailable in this browser.");
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = "high";
  lctx.drawImage(src.img, dx, dy, dw, dh);
  adjust(layer, brightness, contrast);

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(layer, 0, 0);
  layer.width = 0; // release memory early on phones
  return out;
}

function layoutSheet(key: SheetKey, pw: number, ph: number) {
  const sheet = SHEETS[key];
  const fit = (W: number, H: number) => {
    const cols = Math.max(0, Math.floor((W - 2 * sheet.margin + GAP) / (pw + GAP)));
    const rows = Math.max(0, Math.floor((H - 2 * sheet.margin + GAP) / (ph + GAP)));
    return { W, H, cols, rows, count: cols * rows };
  };
  const portrait = fit(sheet.w, sheet.h);
  const landscape = fit(sheet.h, sheet.w);
  return landscape.count > portrait.count ? { ...landscape, landscape: true } : { ...portrait, landscape: false };
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

/* ------------------------------------------------------------------ */

export default function PassportPhotoStudio({ tool }: { tool: Tool }) {
  const [src, setSrc] = useState<Source | null>(null);
  const [presetKey, setPresetKey] = useState<PresetKey>("pk");
  const [customW, setCustomW] = useState("35");
  const [customH, setCustomH] = useState("45");
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [bgKey, setBgKey] = useState<string>("white");
  const [customBg, setCustomBg] = useState("#f2f2f2");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sheetKey, setSheetKey] = useState<SheetKey>("4x6");
  const [busy, setBusy] = useState<Busy>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ id: number; x: number; y: number; fx: number; fy: number; w: number; h: number } | null>(null);

  // the object URL lives exactly as long as the source it belongs to
  useEffect(() => {
    if (!src) return;
    const url = src.url;
    return () => URL.revokeObjectURL(url);
  }, [src]);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
  const mmW = presetKey === "custom" ? Number(customW) : preset.w;
  const mmH = presetKey === "custom" ? Number(customH) : preset.h;
  const sizeError =
    presetKey === "custom" && (!Number.isFinite(mmW) || !Number.isFinite(mmH) || mmW < 10 || mmH < 10 || mmW > 150 || mmH > 150)
      ? "Enter a width and height between 10 and 150 mm."
      : null;
  // fall back to 35 × 45 while the custom size is invalid so the editor never breaks
  const dimW = sizeError ? 35 : mmW;
  const dimH = sizeError ? 45 : mmH;
  const W = mmToPx(dimW);
  const H = mmToPx(dimH);
  const bg = bgKey === "custom" ? customBg : (BACKGROUNDS.find((b) => b.key === bgKey)?.value ?? "#ffffff");

  const sheet = useMemo(() => layoutSheet(sheetKey, W, H), [sheetKey, W, H]);

  const place = src ? placement(src.width, src.height, W, H, view) : null;
  // how many source pixels end up covering the frame width — below ~70% of the output it will look soft
  const lowRes = place ? W / place.s < W * 0.7 : false;
  const coversFrame = place ? place.dx <= 0.5 && place.dy <= 0.5 && place.dx + place.dw >= W - 0.5 && place.dy + place.dh >= H - 0.5 : true;

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
      setError("Please choose a photo (JPG, PNG, WEBP…).");
      notify.error("That isn't an image", "Choose a JPG, PNG or WEBP photo of your face.");
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (Math.min(width, height) < 300) {
        URL.revokeObjectURL(url);
        setError(`This photo is only ${width} × ${height} px — use one at least 300 px on its shorter side.`);
        notify.error("Photo is too small", "Use the original camera photo, not a thumbnail or screenshot.");
        return;
      }
      setSrc({ file, url, img, width, height });
      setView(DEFAULT_VIEW);
      setError(null);
      notify.info("Photo loaded", "Drag to position your face inside the oval, then zoom to fit.");
    } catch {
      URL.revokeObjectURL(url);
      setError("Your browser could not open this image. Try a JPG or PNG.");
      notify.error("Could not open this image", "HEIC photos may need converting to JPG first on some browsers.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSrc(null);
    setView(DEFAULT_VIEW);
    setBrightness(100);
    setContrast(100);
    setError(null);
  }

  /* --------------------------- crop interaction --------------------------- */

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!src || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    frameRef.current.setPointerCapture(e.pointerId);
    panRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, fx: view.fx, fy: view.fy, w: rect.width, h: rect.height };
    setPanning(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const p = panRef.current;
    if (!p || p.id !== e.pointerId) return;
    const fx = clamp(p.fx + (e.clientX - p.x) / p.w, -1.5, 1.5);
    const fy = clamp(p.fy + (e.clientY - p.y) / p.h, -1.5, 1.5);
    setView((v) => ({ ...v, fx, fy }));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (panRef.current?.id !== e.pointerId) return;
    panRef.current = null;
    setPanning(false);
  }

  function onFrameKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!src) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => ({ ...v, fx: clamp(v.fx + dx, -1.5, 1.5), fy: clamp(v.fy + dy, -1.5, 1.5) }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clamp(v.zoom + 0.05, 0.5, 4) }));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: clamp(v.zoom - 0.05, 0.5, 4) }));
    }
  }

  /* ------------------------------- exports -------------------------------- */

  function report(outputType: string, bytesOut: number) {
    if (!src) return;
    trackEvent("download", tool.slug);
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        tool: tool.slug,
        inputType: src.file.type || "image",
        outputType,
        files: 1,
        bytesIn: src.file.size,
        bytesOut,
      }),
    }).catch(() => {});
  }

  function sizeTag() {
    return `${Math.round(dimW * 10) / 10}x${Math.round(dimH * 10) / 10}mm`;
  }

  async function exportPhoto() {
    if (!src || busy || sizeError) return;
    setBusy("photo");
    trackEvent("process", tool.slug);
    try {
      await new Promise((r) => setTimeout(r, 0)); // let the spinner paint before the canvas work
      const canvas = renderPhoto(src, W, H, view, bg, brightness, contrast);
      const blob = await toBlob(canvas, "image/jpeg", 0.92);
      canvas.width = 0;
      saveBlob(blob, `passport-photo-${sizeTag()}-${W}x${H}.jpg`);
      report("image/jpeg", blob.size);
      notify.success("Photo downloaded", `${W} × ${H} px at 300 DPI · ${formatBytes(blob.size)}`);
    } catch (err) {
      notify.error("Could not create the photo", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function buildSheet() {
    if (!src) throw new Error("Add a photo first.");
    if (!sheet.count) throw new Error("This photo size does not fit on the selected paper.");
    const photo = renderPhoto(src, W, H, view, bg, brightness, contrast);
    const canvas = document.createElement("canvas");
    canvas.width = sheet.W;
    canvas.height = sheet.H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheet.W, sheet.H);

    const gridW = sheet.cols * W + (sheet.cols - 1) * GAP;
    const gridH = sheet.rows * H + (sheet.rows - 1) * GAP;
    const x0 = Math.round((sheet.W - gridW) / 2);
    const y0 = Math.round((sheet.H - gridH) / 2);

    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = 2;
    for (let r = 0; r < sheet.rows; r++) {
      for (let c = 0; c < sheet.cols; c++) {
        const x = x0 + c * (W + GAP);
        const y = y0 + r * (H + GAP);
        ctx.drawImage(photo, x, y);
        ctx.strokeRect(x - 1, y - 1, W + 2, H + 2); // thin cut line just outside the photo edge
      }
    }
    photo.width = 0;
    return canvas;
  }

  async function exportSheet(kind: "jpg" | "pdf") {
    if (!src || busy || sizeError) return;
    setBusy(kind === "jpg" ? "sheet-jpg" : "sheet-pdf");
    trackEvent("process", tool.slug);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const canvas = await buildSheet();
      const jpg = await toBlob(canvas, "image/jpeg", 0.92);
      canvas.width = 0;
      const base = `passport-photos-${sizeTag()}-${sheetKey}-${sheet.count}up`;

      if (kind === "jpg") {
        saveBlob(jpg, `${base}.jpg`);
        report("image/jpeg", jpg.size);
        notify.success("Print sheet downloaded", `${sheet.count} copies on ${SHEETS[sheetKey].label}. Print at 100% / actual size.`);
        return;
      }

      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      doc.setTitle("Passport photos");
      doc.setCreator("SnapGrab");
      const img = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
      const { wPt, hPt } = SHEETS[sheetKey];
      const [pw, ph] = sheet.landscape ? [hPt, wPt] : [wPt, hPt];
      const page = doc.addPage([pw, ph]);
      page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
      const bytes = await doc.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      saveBlob(blob, `${base}.pdf`);
      report("application/pdf", blob.size);
      notify.success("PDF downloaded", `${sheet.count} copies on ${SHEETS[sheetKey].label}. Print at 100% / actual size — not "fit to page".`);
    } catch (err) {
      notify.error("Could not create the print sheet", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  /* -------------------------------- render -------------------------------- */

  const guideTop = preset.top * dimH;
  const guideChin = preset.chin * dimH;
  const ovalRy = (guideChin - guideTop) / 2;
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
          {/* hidden inputs — one for the gallery, one that opens the front camera on phones */}
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
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
                </motion.span>
                <p className="mt-4 font-bold">{loading ? "Opening photo…" : "Drop a face photo, or tap to browse"}</p>
                <p className="mt-1 text-sm text-muted">JPG, PNG or WEBP — processed in your browser, never uploaded</p>
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
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
              {/* ------------------------------ editor ------------------------------ */}
              <div>
                <div
                  ref={frameRef}
                  role="application"
                  aria-label="Photo crop area. Drag or use the arrow keys to move the photo; plus and minus keys zoom."
                  tabIndex={0}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onFrameKey}
                  className={`relative mx-auto w-full max-w-[300px] touch-none select-none overflow-hidden rounded-md shadow-xl outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-brand-400 ${
                    panning ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  style={{ aspectRatio: `${W} / ${H}`, backgroundColor: bg }}
                >
                  {place && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src.url}
                      alt="Your photo inside the crop frame"
                      draggable={false}
                      className="pointer-events-none absolute max-w-none"
                      style={{
                        left: `${(place.dx / W) * 100}%`,
                        top: `${(place.dy / H) * 100}%`,
                        width: `${(place.dw / W) * 100}%`,
                        height: `${(place.dh / H) * 100}%`,
                        filter: brightness !== 100 || contrast !== 100 ? `brightness(${brightness / 100}) contrast(${contrast / 100})` : undefined,
                      }}
                    />
                  )}
                  {/* visual guide only — never drawn into the export */}
                  <svg
                    viewBox={`0 0 ${dimW} ${dimH}`}
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden="true"
                  >
                    <ellipse
                      cx={dimW / 2}
                      cy={(guideTop + guideChin) / 2}
                      rx={ovalRy * 0.74}
                      ry={ovalRy}
                      fill="none"
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      vectorEffect="non-scaling-stroke"
                    />
                    <ellipse
                      cx={dimW / 2}
                      cy={(guideTop + guideChin) / 2}
                      rx={ovalRy * 0.74}
                      ry={ovalRy}
                      fill="none"
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={0.75}
                      vectorEffect="non-scaling-stroke"
                    />
                    {[guideTop, guideChin].map((y) => (
                      <line
                        key={y}
                        x1={0}
                        x2={dimW}
                        y1={y}
                        y2={y}
                        stroke="rgba(59,130,246,0.85)"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                  <span
                    className="pointer-events-none absolute right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ top: `calc(${preset.top * 100}% + 3px)` }}
                  >
                    Top of head
                  </span>
                  <span
                    className="pointer-events-none absolute right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ top: `calc(${preset.chin * 100}% + 3px)` }}
                  >
                    Chin
                  </span>
                </div>

                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
                  <Move className="h-3.5 w-3.5" /> Drag to position · guides are a visual aid only
                </p>

                <div className="mt-4">
                  <label htmlFor="pp-zoom" className="mb-2 flex items-center justify-between text-sm font-semibold">
                    Zoom <span className="font-mono text-brand-400">{Math.round(view.zoom * 100)}%</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Zoom out"
                      onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom - 0.1, 0.5, 4) }))}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl surface text-muted transition-colors hover:text-[var(--fg)]"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <input
                      id="pp-zoom"
                      type="range"
                      min={50}
                      max={400}
                      step={1}
                      value={Math.round(view.zoom * 100)}
                      onChange={(e) => setView((v) => ({ ...v, zoom: Number(e.target.value) / 100 }))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                    <button
                      type="button"
                      aria-label="Zoom in"
                      onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom + 0.1, 0.5, 4) }))}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl surface text-muted transition-colors hover:text-[var(--fg)]"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView(DEFAULT_VIEW)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset position
                  </button>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)]"
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> Change photo
                  </button>
                </div>

                {lowRes && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Zoomed in beyond the photo&apos;s detail — the print may look soft. Use a higher-resolution photo or zoom out.
                  </p>
                )}
                {!coversFrame && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Part of the frame is empty and will be filled with the background colour.
                  </p>
                )}
              </div>

              {/* ----------------------------- controls ----------------------------- */}
              <div className="min-w-0 space-y-5">
                <div>
                  <label htmlFor="pp-preset" className="mb-1.5 block text-sm font-semibold">
                    Photo size
                  </label>
                  <select
                    id="pp-preset"
                    value={presetKey}
                    onChange={(e) => setPresetKey(e.target.value as PresetKey)}
                    className={field}
                  >
                    {PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {presetKey === "custom" && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-muted">Width (mm)</span>
                        <input
                          inputMode="decimal"
                          value={customW}
                          onChange={(e) => setCustomW(e.target.value)}
                          className={field}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-muted">Height (mm)</span>
                        <input
                          inputMode="decimal"
                          value={customH}
                          onChange={(e) => setCustomH(e.target.value)}
                          className={field}
                        />
                      </label>
                    </div>
                  )}
                  {sizeError ? (
                    <p className="mt-2 text-xs text-red-400">{sizeError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      Output: <span className="font-semibold text-[var(--fg)]">{W} × {H} px</span> at 300 DPI. {preset.hint}
                    </p>
                  )}
                </div>

                <div>
                  <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Palette className="h-4 w-4 text-brand-400" /> Fill colour for empty areas
                  </span>
                  <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Background fill colour">
                    {BACKGROUNDS.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        role="radio"
                        aria-checked={bgKey === b.key}
                        onClick={() => setBgKey(b.key)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                          bgKey === b.key ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400" : "surface text-muted hover:text-[var(--fg)]"
                        }`}
                      >
                        <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: b.value }} />
                        {b.label}
                      </button>
                    ))}
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        bgKey === "custom" ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400" : "surface text-muted hover:text-[var(--fg)]"
                      }`}
                    >
                      <input
                        type="color"
                        value={customBg}
                        aria-label="Custom fill colour"
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
                  <p className="mt-2 text-xs text-muted">
                    This does <strong>not</strong> remove or replace the background behind you — it only fills areas the photo
                    doesn&apos;t cover. For best results, stand in front of a plain white or light wall.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pp-bright" className="mb-2 flex items-center justify-between text-sm font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Sun className="h-4 w-4 text-brand-400" /> Brightness
                      </span>
                      <span className="font-mono text-brand-400">{brightness}%</span>
                    </label>
                    <input
                      id="pp-bright"
                      type="range"
                      min={60}
                      max={150}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="pp-contrast" className="mb-2 flex items-center justify-between text-sm font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Contrast className="h-4 w-4 text-brand-400" /> Contrast
                      </span>
                      <span className="font-mono text-brand-400">{contrast}%</span>
                    </label>
                    <input
                      id="pp-contrast"
                      type="range"
                      min={60}
                      max={150}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[var(--color-brand-500)]"
                    />
                  </div>
                </div>

                {/* single photo */}
                <div className="rounded-2xl surface p-4">
                  <p className="text-sm font-bold">Single photo</p>
                  <p className="mt-0.5 text-xs text-muted">
                    JPG, {W} × {H} px — for online applications and uploads.
                  </p>
                  <motion.button
                    type="button"
                    onClick={exportPhoto}
                    disabled={!!busy || !!sizeError}
                    whileHover={{ scale: busy ? 1 : 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className={`${btnBase} mt-3 w-full bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25 sm:w-auto`}
                  >
                    {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {busy === "photo" ? "Creating…" : "Download photo (JPG)"}
                  </motion.button>
                </div>

                {/* print sheet */}
                <div className="rounded-2xl surface p-4">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <Printer className="h-4 w-4 text-brand-400" /> Print sheet
                  </p>
                  <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Paper size">
                    {(Object.keys(SHEETS) as SheetKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={sheetKey === k}
                        onClick={() => setSheetKey(k)}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                          sheetKey === k
                            ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                            : "bg-[var(--bg-soft)] text-muted hover:text-[var(--fg)]"
                        }`}
                      >
                        {k === "4x6" ? "4 × 6 in" : "A4"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {sizeError ? (
                      "Fix the custom size first."
                    ) : sheet.count ? (
                      <>
                        <span className="font-semibold text-[var(--fg)]">
                          {sheet.count} {sheet.count === 1 ? "copy" : "copies"}
                        </span>{" "}
                        ({sheet.cols} × {sheet.rows}
                        {sheet.landscape ? ", landscape" : ""}) on {SHEETS[sheetKey].label}, with light-grey cut lines. Print at
                        100% / actual size.
                      </>
                    ) : (
                      "This photo size is too large for the selected paper."
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void exportSheet("jpg")}
                      disabled={!!busy || !!sizeError || !sheet.count}
                      className={`${btnBase} flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25`}
                    >
                      {busy === "sheet-jpg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {busy === "sheet-jpg" ? "Creating…" : "Sheet as JPG"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportSheet("pdf")}
                      disabled={!!busy || !!sizeError || !sheet.count}
                      className={`${btnBase} flex-1 bg-[var(--bg-soft)] hover:text-brand-400`}
                    >
                      {busy === "sheet-pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      {busy === "sheet-pdf" ? "Creating…" : "Sheet as PDF"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={reset}
                  disabled={!!busy}
                  className="flex items-center gap-2 rounded-2xl surface px-5 py-3 text-sm font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Clear photo
                </button>
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
            Your photo is cropped and printed locally in your browser — nothing is uploaded. Always check the latest
            requirements of the issuing office.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
