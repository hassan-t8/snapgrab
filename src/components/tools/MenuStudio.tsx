"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet from "@/components/ShareSheet";
import QrMenuView from "@/components/QrMenuView";
import { drawCutLine, pagesToPdf, paperCanvas, printPages, PRINT_TIPS, type Paper, type PrintPage } from "@/lib/print";
import { pdfSafe, wrap } from "@/lib/pdf-text";
import {
  DEFAULT_THEME,
  MENU_LIMITS,
  MENU_THEMES,
  QR_COMFORT_CHARS,
  QR_MAX_CHARS,
  encodeMenu,
  formatPrice,
  menuUrl,
  themeColor,
  tidyMenu,
  type QrMenu,
} from "@/lib/qr-menu";

/* ------------------------------------------------------------------ *
 * editor model (rows carry ids for React keys; ids never reach the link)
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "sg-qr-menu-draft";
const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";

type EditItem = { id: string; name: string; price: string; desc: string };
type EditCat = { id: string; name: string; items: EditItem[] };
type EditMenu = Omit<QrMenu, "categories"> & { categories: EditCat[] };

let seq = 0;
const uid = () => `m${++seq}`;
const newItem = (p: Partial<EditItem> = {}): EditItem => ({ name: "", price: "", desc: "", ...p, id: uid() });
const newCat = (name = "", items: Partial<EditItem>[] = [{}]): EditCat => ({ id: uid(), name, items: items.map(newItem) });

const CURRENCIES = ["Rs", "PKR", "$", "AED", "SAR", "£", "€", ""];

function blank(theme = DEFAULT_THEME): EditMenu {
  return { name: "", tagline: "", currency: "Rs", phone: "", whatsapp: "", address: "", hours: "", note: "", theme, categories: [newCat()] };
}

function sample(theme: string): EditMenu {
  return {
    name: "Lahori Dhaba",
    tagline: "Desi karahi, BBQ & fresh tandoor since 1998",
    currency: "Rs",
    phone: "0300 1234567",
    whatsapp: "0300 1234567",
    address: "MM Alam Road, Gulberg III, Lahore",
    hours: "Daily 12 pm – 1 am",
    note: "Prices are inclusive of all taxes. Please tell us about any food allergies.",
    theme,
    categories: [
      newCat("Karahi & Handi", [
        { name: "Chicken Karahi", price: "1100 / 2000", desc: "Half / full — desi ghee, tomatoes, green chillies" },
        { name: "Mutton Karahi", price: "1900 / 3600", desc: "Half / full" },
        { name: "Chicken White Handi", price: "1350", desc: "Creamy yoghurt gravy with black pepper" },
        { name: "Daal Mash", price: "450" },
      ]),
      newCat("BBQ", [
        { name: "Chicken Tikka (leg)", price: "450" },
        { name: "Seekh Kabab (4 pcs)", price: "650" },
        { name: "Malai Boti", price: "750", desc: "Cream and cheese marinated boneless chicken" },
      ]),
      newCat("Naan & Roti", [
        { name: "Roghni Naan", price: "80" },
        { name: "Garlic Naan", price: "120" },
        { name: "Tandoori Roti", price: "30" },
      ]),
      newCat("Drinks", [
        { name: "Doodh Patti Chai", price: "120" },
        { name: "Lassi (sweet / salty)", price: "250" },
        { name: "Fresh Lime", price: "200" },
        { name: "Soft Drink", price: "150" },
      ]),
    ],
  };
}

/** Example shown in the phone preview while the form is empty. */
const PREVIEW_SAMPLE: QrMenu = tidyMenu(sample(DEFAULT_THEME));

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function readDraft(): EditMenu | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (!r || typeof r !== "object" || !Array.isArray(r.categories)) return null;
    const L = MENU_LIMITS;
    return {
      name: str(r.name, L.name),
      tagline: str(r.tagline, L.tagline),
      currency: typeof r.currency === "string" ? r.currency.slice(0, L.currency) : "Rs",
      phone: str(r.phone, L.phone),
      whatsapp: str(r.whatsapp, L.phone),
      address: str(r.address, L.address),
      hours: str(r.hours, L.hours),
      note: str(r.note, L.note),
      theme: MENU_THEMES.some((t) => t.id === r.theme) ? (r.theme as string) : DEFAULT_THEME,
      categories: (r.categories as unknown[])
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .slice(0, L.categories)
        .map((c) =>
          newCat(
            str(c.name, L.category),
            (Array.isArray(c.items) ? c.items : [])
              .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
              .slice(0, L.itemsPerCategory)
              .map((i) => ({ name: str(i.name, L.itemName), price: str(i.price, L.price), desc: str(i.desc, L.desc) })),
          ),
        ),
    };
  } catch {
    return null;
  }
}

function writeDraft(m: EditMenu) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "menu";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function trackOutput(slug: string, outputType: string, bytesOut: number, files = 1) {
  trackEvent("download", slug);
  fetch("/api/tools/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ tool: slug, outputType, files, bytesOut }),
  }).catch(() => {});
}

/** Error correction: M (15%) while the link is short, L when every module counts. */
const eccFor = (len: number) => (len <= 1200 ? "M" : "L");

async function qrCanvas(text: string, px: number): Promise<HTMLCanvasElement> {
  const QR = (await import("qrcode")).default;
  const c = document.createElement("canvas");
  await QR.toCanvas(c, text, { width: px, margin: 0, errorCorrectionLevel: eccFor(text.length), color: { dark: "#000000", light: "#ffffff" } });
  return c;
}

/* ------------------------------------------------------------------ *
 * printable table card (canvas, 300 DPI, via src/lib/print.ts)
 * ------------------------------------------------------------------ */

type CardSize = "a6" | "a5" | "a4x4";
const CARD_SIZES: { id: CardSize; label: string; paper: Paper; cards: number }[] = [
  { id: "a6", label: "A6 card", paper: { id: "a6", label: "A6 (105 × 148 mm)", w: 105, h: 148 }, cards: 1 },
  { id: "a5", label: "A5 card", paper: { id: "a5", label: "A5 (148 × 210 mm)", w: 148, h: 210 }, cards: 1 },
  { id: "a4x4", label: "4 cards on A4", paper: { id: "a4", label: "A4 (210 × 297 mm)", w: 210, h: 297 }, cards: 4 },
];

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Largest font size (px) ≤ start at which `text` fits `maxW`; returns the text, ellipsised if needed. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, min: number, weight: number) {
  let size = start;
  for (; size > min; size -= Math.max(1, start * 0.03)) {
    ctx.font = `${weight} ${size}px ${SANS}`;
    if (ctx.measureText(text).width <= maxW) return { text, size };
  }
  ctx.font = `${weight} ${min}px ${SANS}`;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return { text: t === text ? t : `${t.trimEnd()}…`, size: min };
}

function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, menu: QrMenu, qr: HTMLCanvasElement) {
  const mm = w / 105; // card is laid out on a 105 mm-wide grid and scaled
  const accent = themeColor(menu.theme);
  const cx = x + w / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // band with the restaurant name
  const bandH = (menu.tagline ? 30 : 25) * mm;
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, bandH);
  ctx.fillStyle = "#ffffff";
  const name = fitText(ctx, menu.name || "Our menu", w - 14 * mm, 9.5 * mm, 4.5 * mm, 800);
  ctx.font = `800 ${name.size}px ${SANS}`;
  ctx.fillText(name.text, cx, y + (menu.tagline ? 15 : 15.5) * mm);
  if (menu.tagline) {
    const tag = fitText(ctx, menu.tagline, w - 14 * mm, 3.6 * mm, 2.6 * mm, 500);
    ctx.globalAlpha = 0.9;
    ctx.font = `500 ${tag.size}px ${SANS}`;
    ctx.fillText(tag.text, cx, y + 22.5 * mm);
    ctx.globalAlpha = 1;
  }

  // call to action
  let ty = y + bandH + 13 * mm;
  ctx.fillStyle = "#111111";
  ctx.font = `800 ${8.5 * mm}px ${SANS}`;
  ctx.fillText("Scan for menu", cx, ty);
  ty += 5.6 * mm;
  ctx.fillStyle = "#555555";
  ctx.font = `500 ${3.4 * mm}px ${SANS}`;
  ctx.fillText("Point your phone camera at the code", cx, ty);

  // QR in a rounded frame
  const qrSize = 60 * mm;
  const pad = 4 * mm;
  const fx = cx - qrSize / 2 - pad;
  const fy = ty + 4.5 * mm;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.9 * mm;
  ctx.beginPath();
  ctx.roundRect(fx, fy, qrSize + 2 * pad, qrSize + 2 * pad, 4 * mm);
  ctx.fill();
  ctx.stroke();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, fx + pad, fy + pad, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;

  // contact
  ty = fy + qrSize + 2 * pad + 7.5 * mm;
  const number = menu.phone || menu.whatsapp;
  if (number) {
    const label = menu.phone && menu.whatsapp && menu.phone !== menu.whatsapp ? `Call ${menu.phone} · WhatsApp ${menu.whatsapp}` : `Call / WhatsApp ${number}`;
    const c = fitText(ctx, label, w - 12 * mm, 4 * mm, 2.6 * mm, 700);
    ctx.fillStyle = "#111111";
    ctx.font = `700 ${c.size}px ${SANS}`;
    ctx.fillText(c.text, cx, ty);
    ty += 5 * mm;
  }
  if (menu.address) {
    const a = fitText(ctx, menu.address, w - 12 * mm, 3.2 * mm, 2.4 * mm, 500);
    ctx.fillStyle = "#555555";
    ctx.font = `500 ${a.size}px ${SANS}`;
    ctx.fillText(a.text, cx, ty);
  }
  ctx.fillStyle = "#8a8a8a";
  ctx.font = `500 ${2.6 * mm}px ${SANS}`;
  ctx.fillText("No app needed — opens in your phone's browser", cx, y + h - 6 * mm);
  ctx.restore();
}

async function buildCardPages(menu: QrMenu, url: string, size: CardSize): Promise<PrintPage[]> {
  const spec = CARD_SIZES.find((c) => c.id === size) ?? CARD_SIZES[0];
  const { canvas, ctx, wMm, hMm, px } = paperCanvas(spec.paper);
  const cardW = spec.cards === 4 ? wMm / 2 : wMm;
  const cardH = spec.cards === 4 ? hMm / 2 : hMm;
  const qr = await qrCanvas(url, Math.round(px((cardW / 105) * 60)));
  const slots = spec.cards === 4 ? [0, 1, 2, 3].map((i) => [(i % 2) * cardW, Math.floor(i / 2) * cardH]) : [[0, 0]];
  for (const [sx, sy] of slots) {
    drawCard(ctx, px(sx), px(sy), px(cardW), px(cardH), menu, qr);
    if (spec.cards === 4) drawCutLine(ctx, px(sx), px(sy), px(cardW), px(cardH));
  }
  return [{ canvas, wMm, hMm }];
}

/* ------------------------------------------------------------------ *
 * full printable menu (pdf-lib, real text)
 * ------------------------------------------------------------------ */

function hexRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
}

async function buildMenuPdf(menu: QrMenu, url: string | null): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(menu.name ? `${menu.name} — Menu` : "Menu");
  doc.setCreator("SnapGrab QR Menu Maker");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const W = 595.28;
  const H = 841.89;
  const M = 44;
  const CW = W - 2 * M;
  const c = hexRgb(themeColor(menu.theme));
  const accent = rgb(c.r, c.g, c.b);
  const ink = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.4, 0.4, 0.44);
  const faint = rgb(0.7, 0.7, 0.74);
  const white = rgb(1, 1, 1);

  let page = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (h: number) => {
    if (y - h < M + 10) {
      page = doc.addPage([W, H]);
      y = H - M;
      return true;
    }
    return false;
  };
  const draw = (s: string, x: number, yy: number, size: number, f = font, color = ink) => {
    const safe = pdfSafe(s);
    if (safe) page.drawText(safe, { x, y: yy, size, font: f, color });
  };

  /* header band, with the QR to the live menu on the right */
  const QR_S = 74;
  const qrPng =
    url && url.length <= QR_MAX_CHARS
      ? await (await import("qrcode")).default.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: eccFor(url.length) })
      : null;
  const textW = CW - (qrPng ? QR_S + 28 : 20);
  const nameLines = wrap(menu.name || "Menu", bold, 26, textW);
  const tagLines = menu.tagline ? wrap(menu.tagline, font, 11.5, textW) : [];
  const bandH = Math.max(30 + nameLines.length * 30 + (tagLines.length ? 4 + tagLines.length * 15 : 0) + 18, qrPng ? QR_S + 44 : 0);
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: accent });
  if (qrPng) {
    const img = await doc.embedPng(qrPng);
    const qx = W - M - QR_S;
    const qy = H - bandH / 2 - QR_S / 2 + 6;
    page.drawRectangle({ x: qx - 4, y: qy - 4, width: QR_S + 8, height: QR_S + 8, color: white });
    page.drawImage(img, { x: qx, y: qy, width: QR_S, height: QR_S });
    const label = "Scan for this menu";
    page.drawText(label, { x: qx + QR_S / 2 - font.widthOfTextAtSize(label, 7.5) / 2, y: qy - 15, size: 7.5, font, color: white });
  }
  let hy = H - 30;
  for (const l of nameLines) {
    hy -= 30;
    draw(l, M, hy + 7, 26, bold, white);
  }
  if (tagLines.length) hy -= 4;
  for (const l of tagLines) {
    hy -= 15;
    draw(l, M, hy + 3.5, 11.5, font, white);
  }
  y = H - bandH - 16;

  const info = [
    menu.phone && `Call: ${menu.phone}`,
    menu.whatsapp && menu.whatsapp !== menu.phone && `WhatsApp: ${menu.whatsapp}`,
    menu.address,
    menu.hours,
  ]
    .filter(Boolean)
    .join("   |   ");
  if (info) {
    for (const l of wrap(info, font, 9.5, CW)) {
      y -= 13;
      draw(l, M, y, 9.5, font, muted);
    }
    y -= 6;
  }

  /* categories */
  const PRICE = 11;
  const dotW = font.widthOfTextAtSize(" .", 9);
  for (const cat of menu.categories) {
    if (!cat.items.length) continue;
    const first = cat.items[0];
    ensure(46 + (first.desc ? 26 : 14));
    if (cat.name) {
      y -= 24;
      draw(cat.name.toUpperCase(), M, y, 13, bold, accent);
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.9, color: accent });
      y -= 4;
    } else y -= 10;

    for (const it of cat.items) {
      const price = pdfSafe(formatPrice(it.price, menu.currency));
      const priceW = price ? bold.widthOfTextAtSize(price, PRICE) : 0;
      const textW = CW - (price ? priceW + 24 : 0);
      const nameL = wrap(it.name, bold, 11, textW);
      const descL = it.desc ? wrap(it.desc, font, 9.5, textW) : [];
      ensure(10 + nameL.length * 14.5 + descL.length * 12.5);
      y -= 10;
      nameL.forEach((l, i) => {
        y -= 14.5;
        draw(l, M, y + 3, 11, bold, ink);
        if (i === nameL.length - 1 && price) {
          const px = M + CW - priceW;
          draw(price, px, y + 3, PRICE, bold, accent);
          // dotted leader between the name and the price
          const start = M + bold.widthOfTextAtSize(pdfSafe(l), 11) + 6;
          const end = px - 6;
          const n = Math.floor((end - start) / dotW);
          if (n > 2) draw(" .".repeat(n), end - n * dotW, y + 3, 9, font, faint);
        }
      });
      for (const l of descL) {
        y -= 12.5;
        draw(l, M, y + 3, 9.5, font, muted);
      }
    }
    y -= 6;
  }

  if (menu.note) {
    const lines = wrap(menu.note, oblique, 9.5, CW);
    ensure(20 + lines.length * 13);
    y -= 14;
    for (const l of lines) {
      y -= 13;
      draw(l, M, y, 9.5, oblique, muted);
    }
  }

  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      const label = pdfSafe(`${menu.name ? `${menu.name} — ` : ""}Page ${i + 1} of ${pages.length}`);
      pg.drawText(label, { x: (W - font.widthOfTextAtSize(label, 8)) / 2, y: 22, size: 8, font, color: muted });
    });
  }
  return doc.save();
}

/* ------------------------------------------------------------------ *
 * small UI pieces
 * ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  max,
  type = "text",
  inputMode,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
  type?: string;
  inputMode?: "tel" | "text";
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`${field} ${error ? "border-red-500/60" : ""}`}
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl surface p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</legend>
      <div className="space-y-3">{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </fieldset>
  );
}

const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-xl surface text-muted transition-colors disabled:opacity-40";
const ghostBtn = "flex items-center gap-2 rounded-xl surface px-4 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60 disabled:opacity-50";

/* ------------------------------------------------------------------ *
 * component
 * ------------------------------------------------------------------ */

export default function MenuStudio({ tool }: { tool: Tool }) {
  const [menu, setMenu] = useState<EditMenu>(() => blank());
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; png: string; svg: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState<CardSize>("a6");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // load the draft after mount so server and client markup match
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const d = readDraft();
      if (d) setMenu(d);
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      if (!writeDraft(menu)) return;
      const now = new Date();
      setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }, 700);
    return () => window.clearTimeout(t);
  }, [menu, ready]);

  const clean = useMemo(() => tidyMenu(menu), [menu]);
  const itemCount = clean.categories.reduce((n, c) => n + c.items.length, 0);
  const hasContent = !!clean.name && itemCount > 0;

  // menu → compressed link → QR (debounced)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (!hasContent) {
        setLink(null);
        setLinkError(null);
        return;
      }
      try {
        const url = menuUrl(window.location.origin, await encodeMenu(clean));
        if (cancelled) return;
        if (url.length > QR_MAX_CHARS) {
          setLink({ url, png: "", svg: "" });
          setLinkError("too-long");
          return;
        }
        const QR = (await import("qrcode")).default;
        const opts = { margin: 2, errorCorrectionLevel: eccFor(url.length), color: { dark: "#000000", light: "#ffffff" } } as const;
        const [png, svg] = await Promise.all([QR.toDataURL(url, { ...opts, width: 1024 }), QR.toString(url, { ...opts, type: "svg" as const })]);
        if (cancelled) return;
        setLink({ url, png, svg });
        setLinkError(null);
      } catch (e) {
        if (!cancelled) {
          setLink(null);
          setLinkError(e instanceof Error ? e.message : "Could not build the QR code.");
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [clean, hasContent, ready]);

  /* ---------------- editing ---------------- */
  const set = <K extends keyof EditMenu>(key: K, value: EditMenu[K]) => setMenu((m) => ({ ...m, [key]: value }));
  const updateCat = (id: string, patch: Partial<EditCat>) => setMenu((m) => ({ ...m, categories: m.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const updateItem = (cid: string, iid: string, patch: Partial<EditItem>) =>
    setMenu((m) => ({
      ...m,
      categories: m.categories.map((c) => (c.id === cid ? { ...c, items: c.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) } : c)),
    }));
  const addItem = (cid: string) =>
    setMenu((m) => ({ ...m, categories: m.categories.map((c) => (c.id === cid && c.items.length < MENU_LIMITS.itemsPerCategory ? { ...c, items: [...c.items, newItem()] } : c)) }));
  const removeItem = (cid: string, iid: string) =>
    setMenu((m) => ({ ...m, categories: m.categories.map((c) => (c.id === cid ? { ...c, items: c.items.filter((i) => i.id !== iid) } : c)) }));
  const moveItem = (cid: string, index: number, dir: -1 | 1) =>
    setMenu((m) => ({
      ...m,
      categories: m.categories.map((c) => {
        if (c.id !== cid) return c;
        const to = index + dir;
        if (to < 0 || to >= c.items.length) return c;
        const items = [...c.items];
        [items[index], items[to]] = [items[to], items[index]];
        return { ...c, items };
      }),
    }));
  const moveCat = (index: number, dir: -1 | 1) =>
    setMenu((m) => {
      const to = index + dir;
      if (to < 0 || to >= m.categories.length) return m;
      const categories = [...m.categories];
      [categories[index], categories[to]] = [categories[to], categories[index]];
      return { ...m, categories };
    });
  const removeCat = (id: string) => {
    const cat = menu.categories.find((c) => c.id === id);
    if (cat && cat.items.some((i) => i.name.trim()) && !window.confirm(`Remove "${cat.name || "this section"}" and all its items?`)) return;
    setMenu((m) => ({ ...m, categories: m.categories.filter((c) => c.id !== id) }));
  };
  const addCat = () => setMenu((m) => (m.categories.length >= MENU_LIMITS.categories ? m : { ...m, categories: [...m.categories, newCat()] }));
  const dropDescriptions = () => {
    setMenu((m) => ({ ...m, categories: m.categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, desc: "" })) })) }));
    notify.info("Descriptions removed", "The link and QR code are now much shorter.");
  };

  function loadSample() {
    setMenu((m) => sample(m.theme));
    setShowErrors(false);
    trackEvent("sample", tool.slug);
    notify.info("Sample menu loaded", "Replace it with your own dishes and prices.");
  }

  function clearAll() {
    if (!window.confirm("Clear the whole menu? This also removes the saved draft.")) return;
    setMenu((m) => blank(m.theme));
    clearDraft();
    setShowErrors(false);
    trackEvent("reset", tool.slug);
  }

  /** Guards every export: name + at least one item + a link that fits a QR code. */
  function readyLink(): string | null {
    setShowErrors(true);
    if (!clean.name) {
      notify.error("Add your restaurant name", "It is shown at the top of the menu and on the table card.");
      return null;
    }
    if (!itemCount) {
      notify.error("Add at least one item", "Give it a name — the price is optional.");
      return null;
    }
    if (!link) {
      notify.info("Building your QR code…", "Try again in a second.");
      return null;
    }
    if (linkError === "too-long") {
      notify.error("The menu is too long for one QR code", "Shorten or remove item descriptions, then try again.");
      return null;
    }
    return link.url;
  }

  const base = slugify(clean.name);

  function downloadQr(kind: "png" | "svg") {
    const url = readyLink();
    if (!url || !link) return;
    const blob = kind === "png" ? dataUrlToBlob(link.png) : new Blob([link.svg], { type: "image/svg+xml" });
    saveBlob(blob, `${base}-menu-qr.${kind}`);
    trackOutput(tool.slug, kind === "png" ? "image/png" : "image/svg+xml", blob.size);
    notify.success("QR code downloaded", `${base}-menu-qr.${kind}`);
  }

  async function cardAction(action: "print" | "pdf") {
    const url = readyLink();
    if (!url || busy) return;
    setBusy(`card-${action}`);
    try {
      const pages = await buildCardPages(clean, url, cardSize);
      if (action === "print") {
        await printPages(pages, `${clean.name} — table card`);
        trackEvent("print", tool.slug);
      } else {
        const blob = await pagesToPdf(pages);
        saveBlob(blob, `${base}-table-card.pdf`);
        trackOutput(tool.slug, "application/pdf", blob.size);
        notify.success("Table card downloaded", `${base}-table-card.pdf`);
      }
    } catch (e) {
      notify.error("Could not make the table card", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function menuPdf() {
    const url = readyLink();
    if (!url || busy) return;
    setBusy("menu-pdf");
    try {
      const bytes = await buildMenuPdf(clean, url);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      saveBlob(blob, `${base}-menu.pdf`);
      trackOutput(tool.slug, "application/pdf", blob.size);
      notify.success("Menu PDF downloaded", `${base}-menu.pdf`);
    } catch (e) {
      notify.error("Could not build the PDF", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    const url = readyLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    trackEvent("copy", tool.slug);
    setCopied(true);
    notify.success("Menu link copied", "Paste it in WhatsApp, Instagram bio or Google Maps.");
    window.setTimeout(() => setCopied(false), 1600);
  }

  const len = link?.url.length ?? 0;
  const level = !link ? "none" : len > QR_MAX_CHARS ? "over" : len > QR_COMFORT_CHARS ? "dense" : len > 1100 ? "ok" : "great";
  const meterColor = { none: "#a1a1aa", great: "#10b981", ok: "#22c55e", dense: "#f59e0b", over: "#ef4444" }[level];
  const hasDescriptions = clean.categories.some((c) => c.items.some((i) => i.desc));

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="aurora-border rounded-[26px]">
        <div className="glass @container rounded-[26px] p-4 sm:p-6">
          <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
            {/* =========================== FORM =========================== */}
            <div className="@container min-w-0 space-y-4">
              <Section title="Restaurant">
                <Field
                  label="Restaurant / café name"
                  required
                  max={MENU_LIMITS.name}
                  value={menu.name}
                  onChange={(v) => set("name", v)}
                  placeholder="Lahori Dhaba"
                  error={showErrors && !clean.name ? "Add the name shown at the top of the menu." : undefined}
                />
                <Field label="Tagline" max={MENU_LIMITS.tagline} value={menu.tagline} onChange={(v) => set("tagline", v)} placeholder="Desi karahi, BBQ & fresh tandoor" />
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label="Phone (for Call button)" type="tel" inputMode="tel" max={MENU_LIMITS.phone} value={menu.phone} onChange={(v) => set("phone", v)} placeholder="0300 1234567" />
                  <Field label="WhatsApp number" type="tel" inputMode="tel" max={MENU_LIMITS.phone} value={menu.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="0300 1234567" />
                </div>
                <Field label="Address" max={MENU_LIMITS.address} value={menu.address} onChange={(v) => set("address", v)} placeholder="MM Alam Road, Gulberg, Lahore" />
                <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_9rem]">
                  <Field label="Opening hours" max={MENU_LIMITS.hours} value={menu.hours} onChange={(v) => set("hours", v)} placeholder="Daily 12 pm – 1 am" />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Currency</span>
                    <select value={menu.currency} onChange={(e) => set("currency", e.target.value)} className={field}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c || "No symbol"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Field label="Footer note" max={MENU_LIMITS.note} value={menu.note} onChange={(v) => set("note", v)} placeholder="Prices are inclusive of all taxes." />
                <div>
                  <span className="mb-1.5 block text-sm font-semibold" id="menu-theme">
                    Colour theme
                  </span>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="menu-theme">
                    {MENU_THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={menu.theme === t.id}
                        aria-label={t.label}
                        title={t.label}
                        onClick={() => set("theme", t.id)}
                        className={`grid h-9 w-9 place-items-center rounded-full border-2 transition-transform hover:scale-110 ${menu.theme === t.id ? "border-[var(--fg)]" : "border-transparent"}`}
                        style={{ backgroundColor: t.color }}
                      >
                        {menu.theme === t.id && <Check className="h-4 w-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {menu.categories.map((cat, ci) => (
                <fieldset key={cat.id} className="min-w-0 rounded-2xl surface p-4">
                  <legend className="sr-only">{cat.name || `Section ${ci + 1}`}</legend>
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label={`Section ${ci + 1}`} max={MENU_LIMITS.category} value={cat.name} onChange={(v) => updateCat(cat.id, { name: v })} placeholder="Karahi & Handi" />
                    </div>
                    <button type="button" onClick={() => moveCat(ci, -1)} disabled={ci === 0} aria-label="Move section up" className={`${iconBtn} mb-0.5 hover:text-[var(--fg)]`}>
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCat(ci, 1)}
                      disabled={ci === menu.categories.length - 1}
                      aria-label="Move section down"
                      className={`${iconBtn} mb-0.5 hover:text-[var(--fg)]`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => removeCat(cat.id)} aria-label="Remove section" className={`${iconBtn} mb-0.5 hover:text-red-400`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {cat.items.map((it, ii) => (
                      <div key={it.id} className="rounded-xl bg-[var(--bg-soft)] p-2.5">
                        <div className="flex gap-2">
                          <input
                            value={it.name}
                            maxLength={MENU_LIMITS.itemName}
                            onChange={(e) => updateItem(cat.id, it.id, { name: e.target.value })}
                            placeholder="Item name"
                            aria-label={`Item ${ii + 1} name`}
                            className={`${field} min-w-0 flex-1`}
                          />
                          <input
                            value={it.price}
                            maxLength={MENU_LIMITS.price}
                            inputMode="decimal"
                            onChange={(e) => updateItem(cat.id, it.id, { price: e.target.value })}
                            placeholder="Price"
                            aria-label={`Item ${ii + 1} price`}
                            className={`${field} w-24 shrink-0 @md:w-32`}
                          />
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            value={it.desc}
                            maxLength={MENU_LIMITS.desc}
                            onChange={(e) => updateItem(cat.id, it.id, { desc: e.target.value })}
                            placeholder="Description (optional — makes the QR denser)"
                            aria-label={`Item ${ii + 1} description`}
                            className={`${field} min-w-0 flex-1 py-2 text-[13px]`}
                          />
                          <button type="button" onClick={() => moveItem(cat.id, ii, -1)} disabled={ii === 0} aria-label="Move item up" className={`${iconBtn} hover:text-[var(--fg)]`}>
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => removeItem(cat.id, it.id)} aria-label="Remove item" className={`${iconBtn} hover:text-red-400`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addItem(cat.id)} className={`${ghostBtn} mt-3`}>
                    <Plus className="h-4 w-4" /> Add item
                  </button>
                </fieldset>
              ))}

              <button type="button" onClick={addCat} className={`${ghostBtn} w-full justify-center border-dashed py-3`}>
                <Plus className="h-4 w-4" /> Add section
              </button>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={loadSample} className={ghostBtn}>
                  <Sparkles className="h-4 w-4 text-brand-400" /> Load sample menu
                </button>
                <button type="button" onClick={clearAll} className={`${ghostBtn} text-muted hover:border-red-500/50 hover:text-red-400`}>
                  <Eraser className="h-4 w-4" /> Clear all
                </button>
              </div>
            </div>

            {/* =========================== OUTPUT =========================== */}
            <div className="min-w-0 space-y-4 @4xl:sticky @4xl:top-24 @4xl:max-h-[calc(100vh-7rem)] @4xl:self-start @4xl:overflow-y-auto @4xl:pr-1">
              <div className="rounded-2xl surface p-4">
                <div className="flex gap-4">
                  <div className="grid h-36 w-36 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5">
                    {link?.png ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={link.png} alt="QR code for your menu" className="h-full w-full [image-rendering:pixelated]" />
                    ) : (
                      <span className="px-2 text-center text-xs text-zinc-500">
                        {linkError === "too-long" ? "Too long for a QR code" : hasContent ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Add a name and one item"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Your QR menu</p>
                    <p className="mt-1 text-xs text-muted">
                      {itemCount} item{itemCount === 1 ? "" : "s"} in {clean.categories.filter((c) => c.items.length).length} section
                      {clean.categories.filter((c) => c.items.length).length === 1 ? "" : "s"}
                    </p>
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (len / QR_MAX_CHARS) * 100)}%`, backgroundColor: meterColor }} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        Link: <span className="font-bold text-[var(--fg)]">{len.toLocaleString("en-US")}</span> / {QR_MAX_CHARS.toLocaleString("en-US")} characters
                        {level === "great" && " — scans easily"}
                        {level === "ok" && " — fine for print"}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => downloadQr("png")} disabled={!link?.png} className="rounded-lg surface px-2.5 py-1.5 text-xs font-bold hover:border-brand-400/60 disabled:opacity-40">
                        PNG
                      </button>
                      <button type="button" onClick={() => downloadQr("svg")} disabled={!link?.svg} className="rounded-lg surface px-2.5 py-1.5 text-xs font-bold hover:border-brand-400/60 disabled:opacity-40">
                        SVG
                      </button>
                      <button type="button" onClick={() => void copyLink()} disabled={!link?.png} className="flex items-center gap-1 rounded-lg surface px-2.5 py-1.5 text-xs font-bold hover:border-brand-400/60 disabled:opacity-40">
                        {copied ? <Check className="h-3.5 w-3.5 text-accent-400" /> : <Copy className="h-3.5 w-3.5" />} Link
                      </button>
                      {link?.png && (
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg surface px-2.5 py-1.5 text-xs font-bold hover:border-brand-400/60">
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {(level === "dense" || level === "over") && (
                  <div className={`mt-3 flex gap-2 rounded-xl p-3 text-xs ${level === "over" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                    <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                    <div>
                      <p>
                        {level === "over"
                          ? "This menu is too long for one QR code. Shorten or remove item descriptions, or split it into two menus (for example food and drinks)."
                          : "This QR code is dense. Print it at least 6 cm wide, or trim item descriptions — they take the most space — so older phones scan it easily."}
                      </p>
                      {hasDescriptions && (
                        <button type="button" onClick={dropDescriptions} className="mt-1.5 font-bold underline">
                          Remove all descriptions
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* table card */}
              <div className="rounded-2xl surface p-4">
                <p className="text-sm font-bold">Table card</p>
                <p className="mt-0.5 text-xs text-muted">Your name, the QR code and “Scan for menu”, at exact print size.</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Card size">
                  {CARD_SIZES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={cardSize === c.id}
                      onClick={() => setCardSize(c.id)}
                      className={`rounded-xl px-2 py-2 text-xs font-bold transition-all ${
                        cardSize === c.id ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void cardAction("print")} disabled={!!busy} className={ghostBtn}>
                    {busy === "card-print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
                  </button>
                  <button type="button" onClick={() => void cardAction("pdf")} disabled={!!busy} className={ghostBtn}>
                    {busy === "card-pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Card PDF
                  </button>
                </div>
                <details className="mt-2 text-xs text-muted">
                  <summary className="cursor-pointer font-semibold">Printing tips</summary>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4">
                    {PRINT_TIPS.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                    <li>Most home printers cannot feed A6 — choose “4 cards on A4” and cut along the dashed lines.</li>
                  </ul>
                </details>
              </div>

              {/* main actions */}
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  onClick={() => void menuPdf()}
                  disabled={!!busy}
                  aria-busy={busy === "menu-pdf"}
                  whileHover={{ scale: busy ? 1 : 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50"
                >
                  {busy === "menu-pdf" ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <FileText className="h-[18px] w-[18px]" />}
                  {busy === "menu-pdf" ? "Building PDF…" : "Download menu PDF"}
                </motion.button>
                <ShareSheet
                  title={clean.name ? `${clean.name} — Menu` : "Our menu"}
                  text={clean.name ? `See the ${clean.name} menu` : "See our menu"}
                  url={link?.png ? link.url : undefined}
                  label="Share menu"
                />
              </div>

              {/* live phone preview */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">What customers see</p>
                <div className="mx-auto max-w-[400px] rounded-[2rem] border-[6px] border-zinc-800 bg-[var(--bg)] shadow-2xl">
                  <div className="h-[560px] overflow-y-auto rounded-[1.6rem] p-3 [scrollbar-width:thin]">
                    <QrMenuView menu={clean.name || itemCount ? clean : { ...PREVIEW_SAMPLE, theme: clean.theme }} embedded />
                  </div>
                </div>
                {!clean.name && !itemCount && <p className="mt-2 text-center text-xs text-muted">Showing an example — fill in the form to see your own menu.</p>}
              </div>
            </div>
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-400" />
            <span>
              No account and no server: the whole menu is packed into the link itself, so the QR code keeps working for as long as SnapGrab is online and nobody can
              change your menu but you. To update prices, edit here and print a new QR code. Your draft auto-saves in this browser{savedAt ? ` (last saved ${savedAt})` : ""}.
              The PDF uses standard fonts, so Urdu text appears only on the phone menu and the table card.
            </span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const type = head.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
