"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Download,
  FilePlus2,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { PDFFont } from "pdf-lib";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet from "@/components/ShareSheet";

/* ------------------------------------------------------------------ *
 * types & constants
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "sg-invoice-draft";
const MAX_LOGO_BYTES = 1024 * 1024;

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";
const fieldError = "border-red-500/60";

type DocType = "invoice" | "quotation" | "receipt";

const DOC: Record<DocType, { title: string; numberLabel: string; dueLabel: string | null; toLabel: string; prefix: string }> = {
  invoice: { title: "Invoice", numberLabel: "Invoice no.", dueLabel: "Due date", toLabel: "Bill to", prefix: "INV" },
  quotation: { title: "Quotation", numberLabel: "Quotation no.", dueLabel: "Valid until", toLabel: "Prepared for", prefix: "QT" },
  receipt: { title: "Receipt", numberLabel: "Receipt no.", dueLabel: null, toLabel: "Received from", prefix: "RCT" },
};

const CURRENCIES = {
  PKR: { label: "PKR — Pakistani rupee (Rs)", symbol: "Rs", spaced: true },
  USD: { label: "USD — US dollar ($)", symbol: "$", spaced: false },
  AED: { label: "AED — UAE dirham", symbol: "AED", spaced: true },
  SAR: { label: "SAR — Saudi riyal", symbol: "SAR", spaced: true },
  GBP: { label: "GBP — British pound (£)", symbol: "£", spaced: false },
  EUR: { label: "EUR — Euro (€)", symbol: "€", spaced: false },
} as const;

type Currency = keyof typeof CURRENCIES;

type Item = { id: string; description: string; quantity: string; rate: string };

type Logo = { dataUrl: string; type: "image/png" | "image/jpeg"; name: string };

type Invoice = {
  docType: DocType;
  from: { name: string; address: string; phone: string; email: string };
  logo: Logo | null;
  to: { name: string; address: string; contact: string };
  number: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  items: Item[];
  discountType: "amount" | "percent";
  discount: string;
  taxLabel: string;
  taxRate: string;
  shipping: string;
  paid: string;
  notes: string;
};

let seq = 0;
const uid = () => `it${++seq}`;

const newItem = (description = "", quantity = "1", rate = ""): Item => ({ id: uid(), description, quantity, rate });

function blankInvoice(): Invoice {
  return {
    docType: "invoice",
    from: { name: "", address: "", phone: "", email: "" },
    logo: null,
    to: { name: "", address: "", contact: "" },
    number: "INV-0001",
    issueDate: "",
    dueDate: "",
    currency: "PKR",
    items: [newItem()],
    discountType: "amount",
    discount: "",
    taxLabel: "Sales tax",
    taxRate: "",
    shipping: "",
    paid: "",
    notes: "",
  };
}

function sampleInvoice(today: Date): Invoice {
  return {
    docType: "invoice",
    from: {
      name: "Noor Digital Studio",
      address: "Office 12, 2nd Floor, Gulberg Arcade\nMain Boulevard, Lahore 54660",
      phone: "+92 300 1234567",
      email: "hello@noordigital.pk",
    },
    logo: null,
    to: {
      name: "Al-Rehman Traders",
      address: "Shop 45, Saddar Bazaar\nKarachi",
      contact: "+92 321 7654321 · accounts@alrehman.pk",
    },
    number: "INV-2026-0142",
    issueDate: toInputDate(today),
    dueDate: toInputDate(addDays(today, 7)),
    currency: "PKR",
    items: [
      newItem("Website design & development (5 pages, responsive)", "1", "85000"),
      newItem("Logo and brand identity kit", "1", "25000"),
      newItem("Social media post designs", "12", "1500"),
      newItem("Domain + hosting (1 year)", "1", "9500"),
    ],
    discountType: "percent",
    discount: "5",
    taxLabel: "Sales tax",
    taxRate: "16",
    shipping: "",
    paid: "50000",
    notes:
      "Payment due within 7 days.\nBank: Meezan Bank — Account title: Noor Digital Studio\nIBAN: PK36 MEZN 0001 2345 6789 0123\nThank you for your business!",
  };
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function num(value: string): number {
  const n = Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toInputDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-24" → "24 Oct 2026" without relying on the runtime locale. */
function fmtDate(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

function fmtNumber(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function money(n: number, currency: Currency) {
  const c = CURRENCIES[currency];
  const sign = n < 0 ? "-" : "";
  return `${sign}${c.symbol}${c.spaced ? " " : ""}${fmtNumber(Math.abs(n))}`;
}

function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

type Totals = {
  rows: { item: Item; qty: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  paid: number;
  balance: number;
};

function computeTotals(inv: Invoice): Totals {
  const rows = inv.items
    .map((item) => {
      const qty = num(item.quantity);
      const rate = num(item.rate);
      return { item, qty, rate, amount: qty * rate };
    })
    .filter((r) => r.item.description.trim() || r.amount !== 0);
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const rawDiscount = inv.discountType === "percent" ? (subtotal * num(inv.discount)) / 100 : num(inv.discount);
  const discount = Math.min(Math.max(0, rawDiscount), Math.max(0, subtotal));
  const tax = ((subtotal - discount) * Math.max(0, num(inv.taxRate))) / 100;
  const shipping = Math.max(0, num(inv.shipping));
  const total = subtotal - discount + tax + shipping;
  const paid = Math.max(0, num(inv.paid));
  return { rows, subtotal, discount, tax, shipping, total, paid, balance: total - paid };
}

type Errors = Partial<Record<"fromName" | "toName" | "items", string>>;

function validate(inv: Invoice): Errors {
  const e: Errors = {};
  if (!inv.from.name.trim()) e.fromName = "Add your business name.";
  if (!inv.to.name.trim()) e.toName = "Add the client's name.";
  if (!inv.items.some((i) => i.description.trim())) e.items = "Add at least one line item with a description.";
  return e;
}

/* --------------------------- draft storage --------------------------- */

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

function normalise(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const base = blankInvoice();
  const from = (r.from ?? {}) as Record<string, unknown>;
  const to = (r.to ?? {}) as Record<string, unknown>;
  const logo = r.logo as Record<string, unknown> | null | undefined;
  const items = Array.isArray(r.items)
    ? (r.items as Record<string, unknown>[])
        .filter((i) => i && typeof i === "object")
        .map((i) => newItem(str(i.description), str(i.quantity, "1"), str(i.rate)))
    : [];
  return {
    docType: r.docType === "quotation" || r.docType === "receipt" ? r.docType : "invoice",
    from: { name: str(from.name), address: str(from.address), phone: str(from.phone), email: str(from.email) },
    logo:
      logo && typeof logo.dataUrl === "string" && (logo.type === "image/png" || logo.type === "image/jpeg")
        ? { dataUrl: logo.dataUrl, type: logo.type, name: str(logo.name, "logo") }
        : null,
    to: { name: str(to.name), address: str(to.address), contact: str(to.contact) },
    number: str(r.number, base.number),
    issueDate: str(r.issueDate),
    dueDate: str(r.dueDate),
    currency: typeof r.currency === "string" && r.currency in CURRENCIES ? (r.currency as Currency) : "PKR",
    items: items.length ? items : base.items,
    discountType: r.discountType === "percent" ? "percent" : "amount",
    discount: str(r.discount),
    taxLabel: str(r.taxLabel, base.taxLabel),
    taxRate: str(r.taxRate),
    shipping: str(r.shipping),
    paid: str(r.paid),
    notes: str(r.notes),
  };
}

function readDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Returns "ok", "no-logo" (saved but the logo did not fit in storage) or "failed". */
function writeDraft(inv: Invoice): "ok" | "no-logo" | "failed" {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inv));
    return "ok";
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...inv, logo: null }));
      return "no-logo";
    } catch {
      return "failed";
    }
  }
}

/* ------------------------------------------------------------------ *
 * PDF text safety — the standard Helvetica fonts only cover WinAnsi
 * ------------------------------------------------------------------ */

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Common characters outside WinAnsi, keyed by code point, with readable stand-ins. */
const PDF_REPLACE = new Map<number, string>([
  [0x20a8, "Rs"], // rupee sign
  [0x20b9, "Rs"], // Indian rupee sign
  [0x2010, "-"], // hyphens & minus
  [0x2011, "-"],
  [0x2012, "-"],
  [0x2015, "-"],
  [0x2212, "-"],
  [0x2032, "'"], // primes
  [0x2033, '"'],
  [0x2192, "->"], // arrows
  [0x2190, "<-"],
  [0x2264, "<="],
  [0x2265, ">="],
  [0x2713, "v"], // check marks
  [0x2714, "v"],
  [0x00a0, " "], // no-break space
]);

const isWinAnsi = (c: number, ch: string) => (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch);

/** Make any user text drawable with the standard fonts so the PDF build never throws. */
function pdfSafe(input: string): string {
  let out = "";
  for (const ch of input) {
    const c = ch.codePointAt(0) ?? 0;
    const rep = PDF_REPLACE.get(c);
    if (rep !== undefined) {
      out += rep;
      continue;
    }
    if (c === 9) {
      out += "    ";
      continue;
    }
    if (isWinAnsi(c, ch)) {
      out += ch;
      continue;
    }
    // control chars, zero-width joiners, variation selectors, BOM: drop silently
    if (c < 0x20 || (c >= 0x7f && c < 0xa0) || (c >= 0x200b && c <= 0x200f) || c === 0xfeff || (c >= 0xfe00 && c <= 0xfe0f)) continue;
    // emoji & pictographs: drop rather than litter the document with "?"
    if (c >= 0x1f000 || (c >= 0x2600 && c <= 0x27bf) || (c >= 0x2b00 && c <= 0x2bff)) continue;
    if (c >= 0x2000 && c <= 0x200a) {
      out += " ";
      continue;
    }
    // accented Latin letters outside Latin-1 (e.g. ą, ş) → base letter
    const base = [...ch.normalize("NFKD")]
      .filter((b) => {
        const k = b.codePointAt(0) ?? 0;
        return k < 0x300 || k > 0x36f;
      })
      .join("");
    if (base && base !== ch && [...base].every((b) => isWinAnsi(b.codePointAt(0) ?? 0, b))) {
      out += base;
      continue;
    }
    out += "?";
  }
  return out;
}

/**
 * Word-wrap by measured width. `firstWidth` lets the first line be narrower (e.g. after a bold label).
 * Over-long words (URLs) are broken so nothing ever runs off the page.
 */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, firstWidth = maxWidth): string[] {
  const width = (s: string) => font.widthOfTextAtSize(s, size);
  const lines: string[] = [];
  const limit = () => (lines.length === 0 ? firstWidth : maxWidth);
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const para = pdfSafe(raw);
    const words = para.split(/ +/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (width(test) <= limit()) {
        line = test;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      let w = word;
      while (w && width(w) > limit()) {
        if (lines.length === 0 && firstWidth < maxWidth) {
          lines.push(""); // the narrow first line can't take it — start on the next line
          continue;
        }
        let n = Math.max(1, w.length - 1);
        while (n > 1 && width(w.slice(0, n)) > limit()) n--;
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function dataUrlBytes(dataUrl: string) {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------------ *
 * PDF builder (A4 portrait, real selectable text)
 * ------------------------------------------------------------------ */

async function buildInvoicePdf(inv: Invoice, t: Totals): Promise<{ bytes: Uint8Array; logoSkipped: boolean }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const meta = DOC[inv.docType];
  doc.setTitle(`${meta.title} ${inv.number}`.trim());
  if (inv.from.name.trim()) doc.setAuthor(inv.from.name.trim());
  doc.setCreator("SnapGrab Invoice Generator");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 42; // ~15 mm
  const CW = W - 2 * M;
  const BOTTOM = M + 22; // room for the footer
  const ink = rgb(0.09, 0.08, 0.13);
  const muted = rgb(0.4, 0.39, 0.47);
  const brand = rgb(0x70 / 255, 0x48 / 255, 0xf0 / 255);
  const tint = rgb(0.957, 0.949, 1);
  const zebra = rgb(0.975, 0.973, 0.988);
  const rule = rgb(0.87, 0.86, 0.92);
  const white = rgb(1, 1, 1);

  let page = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const ensure = (h: number) => {
    if (y - h < BOTTOM) {
      newPage();
      return true;
    }
    return false;
  };
  const draw = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = ink) => {
    const safe = pdfSafe(s);
    if (safe) page.drawText(safe, { x, y: yy, size, font: f, color });
  };
  const drawRight = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = ink) => {
    const safe = pdfSafe(s);
    draw(safe, xr - f.widthOfTextAtSize(safe, size), yy, size, f, color);
  };
  /** Flowing paragraph in the current column with per-line page breaks. */
  const flow = (s: string, x: number, maxW: number, size: number, lh: number, f: PDFFont = font, color = ink) => {
    for (const line of wrap(s, f, size, maxW)) {
      ensure(lh);
      y -= lh;
      draw(line, x, y + (lh - size) * 0.5, size, f, color);
    }
  };

  /* ---------- header: right column (title + meta) ---------- */
  const firstPage = page;
  const RX = M + CW;
  let ry = y;
  const title = meta.title.toUpperCase();
  drawRight(title, RX, ry - 24, 26, bold, brand);
  ry -= 40;
  const metaRows: [string, string][] = [[meta.numberLabel, inv.number || "—"]];
  if (inv.issueDate) metaRows.push([inv.docType === "receipt" ? "Date" : "Issue date", fmtDate(inv.issueDate)]);
  if (meta.dueLabel && inv.dueDate) metaRows.push([meta.dueLabel, fmtDate(inv.dueDate)]);
  if (inv.docType === "invoice" && t.balance > 0) metaRows.push(["Balance due", money(t.balance, inv.currency)]);
  const valueW = 120;
  for (const [label, value] of metaRows) {
    const lines = wrap(value, bold, 9.5, valueW);
    drawRight(label, RX - valueW - 10, ry - 10, 9.5, font, muted);
    lines.forEach((line, i) => drawRight(line, RX, ry - 10 - i * 12, 9.5, bold, ink));
    ry -= Math.max(1, lines.length) * 12 + 4;
  }

  /* ---------- header: left column (logo + business) ---------- */
  const LW = CW - valueW - 130;
  let logoSkipped = false;
  if (inv.logo) {
    try {
      const bytes = dataUrlBytes(inv.logo.dataUrl);
      const img = inv.logo.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const scale = Math.min(150 / img.width, 60 / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: M, y: y - h, width: w, height: h });
      y -= h + 10;
    } catch {
      logoSkipped = true;
    }
  }
  flow(inv.from.name || "Your business", M, LW, 15, 19, bold, ink);
  y -= 2;
  for (const s of [inv.from.address, inv.from.phone, inv.from.email]) if (s.trim()) flow(s, M, LW, 9.5, 13, font, muted);

  y = page === firstPage ? Math.min(y, ry) : y;
  y -= 18;

  /* ---------- bill to ---------- */
  ensure(13 + 18);
  page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.6, color: rule });
  y -= 14;
  ensure(12);
  y -= 10;
  draw(meta.toLabel.toUpperCase(), M, y, 8.5, bold, brand);
  y -= 2;
  flow(inv.to.name || "Client", M, CW * 0.6, 11.5, 16, bold, ink);
  for (const s of [inv.to.address, inv.to.contact]) if (s.trim()) flow(s, M, CW * 0.6, 9.5, 13, font, muted);
  y -= 20;

  /* ---------- items table ---------- */
  const amtW = 95;
  const rateW = 85;
  const qtyW = 46;
  const amtR = M + CW - 8;
  const rateR = amtR - amtW;
  const qtyR = rateR - rateW;
  const descX = M + 8;
  const descW = qtyR - qtyW - descX - 6;
  const HEAD_H = 22;
  const LH = 13;
  const PAD = 10;

  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - HEAD_H, width: CW, height: HEAD_H, color: brand });
    const by = y - 14.5;
    draw("DESCRIPTION", descX, by, 8.5, bold, white);
    drawRight("QTY", qtyR, by, 8.5, bold, white);
    drawRight("RATE", rateR, by, 8.5, bold, white);
    drawRight(`AMOUNT (${inv.currency})`, amtR, by, 8.5, bold, white);
    y -= HEAD_H;
  };

  ensure(HEAD_H + LH + PAD);
  drawHeader();
  const freshCap = Math.floor((H - M - HEAD_H - BOTTOM - PAD) / LH);

  t.rows.forEach((row, index) => {
    let lines = wrap(row.item.description || "—", font, 9.5, descW);
    if (!lines.length) lines = ["—"];
    const needed = lines.length * LH + PAD;
    if (y - needed < BOTTOM && (lines.length <= freshCap || y - (LH + PAD) < BOTTOM)) {
      newPage();
      drawHeader();
    }
    let first = true;
    while (lines.length) {
      const room = Math.max(1, Math.floor((y - BOTTOM - PAD) / LH));
      const chunk = lines.slice(0, room);
      lines = lines.slice(room);
      const h = chunk.length * LH + PAD;
      if (index % 2 === 1) page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: zebra });
      chunk.forEach((line, i) => draw(line, descX, y - 15 - i * LH, 9.5, font, ink));
      if (first) {
        drawRight(fmtQty(row.qty), qtyR, y - 15, 9.5, font, ink);
        drawRight(fmtNumber(row.rate), rateR, y - 15, 9.5, font, ink);
        drawRight(fmtNumber(row.amount), amtR, y - 15, 9.5, bold, ink);
        first = false;
      }
      y -= h;
      if (lines.length) {
        newPage();
        drawHeader();
      }
    }
  });
  page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.6, color: rule });
  y -= 14;

  /* ---------- totals (kept together) ---------- */
  const totals: { label: string; value: string; strong?: boolean; highlight?: boolean }[] = [
    { label: "Subtotal", value: money(t.subtotal, inv.currency) },
  ];
  if (t.discount > 0)
    totals.push({
      label: inv.discountType === "percent" ? `Discount (${fmtQty(num(inv.discount))}%)` : "Discount",
      value: money(-t.discount, inv.currency),
    });
  if (num(inv.taxRate) > 0)
    totals.push({ label: `${inv.taxLabel.trim() || "Tax"} (${fmtQty(num(inv.taxRate))}%)`, value: money(t.tax, inv.currency) });
  if (t.shipping > 0) totals.push({ label: "Shipping", value: money(t.shipping, inv.currency) });
  totals.push({ label: "Total", value: money(t.total, inv.currency), strong: true, highlight: true });
  if (inv.docType !== "quotation" && (t.paid > 0 || inv.docType === "receipt")) {
    totals.push({ label: "Amount paid", value: money(t.paid, inv.currency) });
    totals.push({ label: inv.docType === "receipt" ? "Balance" : "Balance due", value: money(t.balance, inv.currency), strong: true });
  }

  const boxW = 250;
  const boxX = M + CW - boxW;
  const ROW = 19;
  ensure(totals.length * ROW + 6);
  for (const r of totals) {
    const size = r.strong ? 10.5 : 9.5;
    const labelLines = wrap(r.label, r.strong ? bold : font, size, boxW - 130);
    const rowH = Math.max(ROW, labelLines.length * 12 + 7);
    if (ensure(rowH)) y -= 4;
    if (r.highlight) page.drawRectangle({ x: boxX, y: y - rowH - 2, width: boxW, height: rowH + 2, color: tint });
    labelLines.forEach((line, i) => draw(line, boxX + 8, y - 13.5 - i * 12, size, r.strong ? bold : font, r.strong ? ink : muted));
    drawRight(r.value, amtR, y - 13.5, size, r.strong ? bold : font, r.highlight ? brand : ink);
    y -= rowH + (r.highlight ? 4 : 0);
  }
  y -= 16;

  /* ---------- notes ---------- */
  if (inv.notes.trim()) {
    ensure(14 + 13);
    y -= 10;
    draw(inv.docType === "quotation" ? "TERMS & NOTES" : "NOTES / PAYMENT DETAILS", M, y, 8.5, bold, brand);
    y -= 4;
    flow(inv.notes, M, CW, 9.5, 13.5, font, ink);
  }

  /* ---------- footers ---------- */
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 6 }, end: { x: M + CW, y: M + 6 }, thickness: 0.5, color: rule });
    const left = pdfSafe(`${inv.from.name.trim() || meta.title} — ${meta.title} ${inv.number}`.trim());
    const leftLine = wrap(left, font, 8, CW - 80)[0] ?? "";
    p.drawText(leftLine, { x: M, y: M - 6, size: 8, font, color: muted });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: M + CW - font.widthOfTextAtSize(label, 8), y: M - 6, size: 8, font, color: muted });
  });

  return { bytes: await doc.save(), logoSkipped };
}

/* ------------------------------------------------------------------ *
 * small UI pieces
 * ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  error,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "decimal" | "numeric" | "email" | "tel" | "text";
  error?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={`${field} ${error ? fieldError : ""}`}
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl surface p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ *
 * component
 * ------------------------------------------------------------------ */

export default function InvoiceStudio({ tool }: { tool: Tool }) {
  const [inv, setInv] = useState<Invoice>(blankInvoice);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const warnedStorage = useRef(false);

  // Load the draft (and today's dates) on the client only, after mount, so the markup hydrates cleanly.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const draft = readDraft();
      const today = new Date();
      setInv((prev) => {
        const base = draft ?? prev;
        return {
          ...base,
          issueDate: base.issueDate || toInputDate(today),
          dueDate: base.dueDate || toInputDate(addDays(today, 7)),
        };
      });
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Debounced auto-save.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      const res = writeDraft(inv);
      if (res === "failed") return;
      if (res === "no-logo" && !warnedStorage.current) {
        warnedStorage.current = true;
        notify.warning("Logo not saved in draft", "Your browser storage is full — the logo will be kept until you leave the page.");
      }
      const now = new Date();
      setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }, 700);
    return () => window.clearTimeout(t);
  }, [inv, ready]);

  const totals = useMemo(() => computeTotals(inv), [inv]);
  const errors = useMemo(() => validate(inv), [inv]);
  const shownErrors: Errors = showErrors ? errors : {};
  const meta = DOC[inv.docType];

  const set = <K extends keyof Invoice>(key: K, value: Invoice[K]) => setInv((p) => ({ ...p, [key]: value }));
  const setFrom = (key: keyof Invoice["from"], value: string) => setInv((p) => ({ ...p, from: { ...p.from, [key]: value } }));
  const setTo = (key: keyof Invoice["to"], value: string) => setInv((p) => ({ ...p, to: { ...p.to, [key]: value } }));
  const setItem = (id: string, key: keyof Omit<Item, "id">, value: string) =>
    setInv((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, [key]: value } : i)) }));
  const addItem = () => setInv((p) => ({ ...p, items: [...p.items, newItem()] }));
  const removeItem = (id: string) =>
    setInv((p) => (p.items.length <= 1 ? { ...p, items: [newItem()] } : { ...p, items: p.items.filter((i) => i.id !== id) }));

  function changeDocType(next: DocType) {
    setInv((p) => {
      // swap the default prefix (INV-/QT-/RCT-) when the number still uses the old one
      const oldPrefix = DOC[p.docType].prefix;
      const number = p.number.startsWith(`${oldPrefix}-`) ? `${DOC[next].prefix}-${p.number.slice(oldPrefix.length + 1)}` : p.number;
      return { ...p, docType: next, number };
    });
  }

  function onLogo(file: File) {
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      notify.error("Unsupported logo format", "Please upload a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      notify.error("Logo too large", `That image is ${formatBytes(file.size)} — the limit is 1 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      set("logo", { dataUrl: reader.result, type: file.type as Logo["type"], name: file.name });
      notify.success("Logo added", file.name);
    };
    reader.onerror = () => notify.error("Could not read that image", "Try a different PNG or JPG file.");
    reader.readAsDataURL(file);
  }

  function saveNow() {
    const res = writeDraft(inv);
    if (res === "failed") notify.error("Could not save the draft", "Your browser blocked or filled local storage.");
    else if (res === "no-logo") notify.warning("Draft saved without logo", "Browser storage is full, so the logo was left out.");
    else notify.success("Draft saved", "Stored in this browser only — nothing is uploaded.");
  }

  function newInvoice() {
    if (!window.confirm("Start a new document? Client, items and notes will be cleared (your business details are kept).")) return;
    const today = new Date();
    const fresh = blankInvoice();
    setInv({
      ...fresh,
      from: inv.from,
      logo: inv.logo,
      currency: inv.currency,
      issueDate: toInputDate(today),
      dueDate: toInputDate(addDays(today, 7)),
    });
    setShowErrors(false);
    trackEvent("reset", tool.slug);
    notify.info("New document started", "Your business details were kept.");
  }

  function loadSample() {
    setInv(sampleInvoice(new Date()));
    setShowErrors(false);
    trackEvent("sample", tool.slug);
    notify.info("Sample loaded", "Edit any field — the preview updates live.");
  }

  async function download() {
    if (busy) return;
    setShowErrors(true);
    const list = Object.values(errors);
    if (list.length) {
      notify.error("Please complete the required fields", list.join(" "));
      return;
    }
    setBusy(true);
    try {
      const { bytes, logoSkipped } = await buildInvoicePdf(inv, totals);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = `${inv.docType}-${slugify(inv.number) || "draft"}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 15_000);

      trackEvent("download", tool.slug);
      fetch("/api/tools/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ tool: tool.slug, outputType: "application/pdf", files: 1, bytesOut: blob.size }),
      }).catch(() => {});

      notify.success("PDF downloaded", name);
      if (logoSkipped) notify.warning("Logo left out", "That image could not be embedded — try re-saving it as a standard PNG or JPG.");
    } catch (err) {
      notify.error("Could not build the PDF", err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const cur = inv.currency;

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass @container rounded-[26px] p-4 sm:p-6">
          {/* document type */}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Document type">
            {(Object.keys(DOC) as DocType[]).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={inv.docType === d}
                onClick={() => changeDocType(d)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  inv.docType === d
                    ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                    : "surface text-muted hover:text-[var(--fg)]"
                }`}
              >
                {DOC[d].title}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-6 @4xl:grid-cols-2">
            {/* =========================== FORM =========================== */}
            <div className="@container min-w-0 space-y-4">
              <Section title="From — your business">
                <Field
                  label="Business name"
                  required
                  value={inv.from.name}
                  onChange={(v) => setFrom("name", v)}
                  placeholder="e.g. Noor Digital Studio"
                  autoComplete="organization"
                  error={shownErrors.fromName}
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Address</span>
                  <textarea
                    rows={2}
                    value={inv.from.address}
                    onChange={(e) => setFrom("address", e.target.value)}
                    placeholder="Street, city"
                    className={`${field} resize-y`}
                  />
                </label>
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label="Phone" type="tel" inputMode="tel" value={inv.from.phone} onChange={(v) => setFrom("phone", v)} placeholder="+92 300 1234567" />
                  <Field label="Email" type="email" inputMode="email" value={inv.from.email} onChange={(v) => setFrom("email", v)} placeholder="you@business.com" />
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">Logo (optional)</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {inv.logo ? (
                      <>
                        <span className="grid h-14 w-24 place-items-center overflow-hidden rounded-xl bg-white p-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={inv.logo.dataUrl} alt="Business logo" className="max-h-full max-w-full object-contain" />
                        </span>
                        <button
                          type="button"
                          onClick={() => set("logo", null)}
                          className="flex items-center gap-1.5 rounded-xl surface px-3 py-2 text-sm font-bold text-muted transition-colors hover:text-red-400"
                        >
                          <X className="h-4 w-4" /> Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoRef.current?.click()}
                        className="flex items-center gap-2 rounded-xl surface px-4 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60"
                      >
                        <ImagePlus className="h-4 w-4 text-brand-400" /> Upload PNG or JPG
                      </button>
                    )}
                    <span className="text-xs text-muted">Max 1 MB</span>
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      aria-label="Upload logo"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onLogo(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </Section>

              <Section title={meta.toLabel}>
                <Field
                  label="Client name"
                  required
                  value={inv.to.name}
                  onChange={(v) => setTo("name", v)}
                  placeholder="Client or company name"
                  error={shownErrors.toName}
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Client address</span>
                  <textarea
                    rows={2}
                    value={inv.to.address}
                    onChange={(e) => setTo("address", e.target.value)}
                    placeholder="Street, city"
                    className={`${field} resize-y`}
                  />
                </label>
                <Field label="Phone / email" value={inv.to.contact} onChange={(v) => setTo("contact", v)} placeholder="+92 321 7654321 · client@email.com" />
              </Section>

              <Section title="Details">
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label={meta.numberLabel} value={inv.number} onChange={(v) => set("number", v)} placeholder={`${meta.prefix}-0001`} />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Currency</span>
                    <select value={inv.currency} onChange={(e) => set("currency", e.target.value as Currency)} className={field}>
                      {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                        <option key={c} value={c}>
                          {CURRENCIES[c].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field label={inv.docType === "receipt" ? "Date" : "Issue date"} type="date" value={inv.issueDate} onChange={(v) => set("issueDate", v)} />
                  {meta.dueLabel && <Field label={meta.dueLabel} type="date" value={inv.dueDate} onChange={(v) => set("dueDate", v)} />}
                </div>
              </Section>

              <Section title="Line items">
                <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6.5rem_2.5rem] gap-2 px-1 text-xs font-bold uppercase tracking-wider text-muted @xl:grid">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Rate</span>
                  <span className="text-right">Amount</span>
                  <span className="sr-only">Remove</span>
                </div>
                <ul className="space-y-3 @xl:space-y-2">
                  {inv.items.map((item, i) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 rounded-xl bg-[var(--bg-soft)] p-2 @xl:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6.5rem_2.5rem] @xl:bg-transparent @xl:p-0"
                    >
                      <input
                        value={item.description}
                        onChange={(e) => setItem(item.id, "description", e.target.value)}
                        placeholder={`Item ${i + 1} description`}
                        aria-label={`Item ${i + 1} description`}
                        className={`${field} col-span-3 @xl:col-span-1 ${shownErrors.items && i === 0 ? fieldError : ""}`}
                      />
                      <input
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => setItem(item.id, "quantity", e.target.value)}
                        placeholder="Qty"
                        aria-label={`Item ${i + 1} quantity`}
                        className={`${field} px-3`}
                      />
                      <input
                        inputMode="decimal"
                        value={item.rate}
                        onChange={(e) => setItem(item.id, "rate", e.target.value)}
                        placeholder="Rate"
                        aria-label={`Item ${i + 1} rate`}
                        className={`${field} px-3`}
                      />
                      <span className="col-span-3 flex items-center justify-between gap-2 px-1 text-sm font-bold @xl:col-span-1 @xl:justify-end">
                        <span className="text-xs font-semibold text-muted @xl:hidden">Amount</span>
                        <span className="truncate">{fmtNumber(num(item.quantity) * num(item.rate))}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove item ${i + 1}`}
                        className="row-start-2 col-start-3 grid h-10 w-10 shrink-0 place-items-center self-center rounded-xl surface text-muted hover:text-red-400 @xl:row-start-auto @xl:col-start-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                {shownErrors.items && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" /> {shownErrors.items}
                  </p>
                )}
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 rounded-xl surface px-4 py-2 text-sm font-bold hover:border-brand-400/60"
                >
                  <Plus className="h-4 w-4" /> Add item
                </button>
              </Section>

              <Section title="Discount, tax & payment">
                <div className="grid gap-3 @md:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-sm font-semibold" id="discount-label">
                      Discount
                    </span>
                    <div className="flex gap-2">
                      <input
                        inputMode="decimal"
                        value={inv.discount}
                        onChange={(e) => set("discount", e.target.value)}
                        placeholder="0"
                        aria-labelledby="discount-label"
                        className={`${field} min-w-0 flex-1`}
                      />
                      <select
                        value={inv.discountType}
                        onChange={(e) => set("discountType", e.target.value as Invoice["discountType"])}
                        aria-label="Discount type"
                        className={`${field} w-24 px-3`}
                      >
                        <option value="amount">{CURRENCIES[cur].symbol}</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                  <Field label="Shipping / delivery" inputMode="decimal" value={inv.shipping} onChange={(v) => set("shipping", v)} placeholder="0" />
                  <Field label="Tax label" value={inv.taxLabel} onChange={(v) => set("taxLabel", v)} placeholder="Sales tax, GST, VAT…" />
                  <Field label="Tax rate (%)" inputMode="decimal" value={inv.taxRate} onChange={(v) => set("taxRate", v)} placeholder="0" />
                  {inv.docType !== "quotation" && (
                    <Field label="Amount paid" inputMode="decimal" value={inv.paid} onChange={(v) => set("paid", v)} placeholder="0" />
                  )}
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Notes / payment terms / bank details</span>
                  <textarea
                    rows={4}
                    value={inv.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder={"Payment due within 7 days.\nBank: … · IBAN: PK…"}
                    className={`${field} resize-y`}
                  />
                </label>
              </Section>

              <div className="grid grid-cols-3 gap-2 rounded-2xl surface p-4 text-center">
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted">Subtotal</span>
                  <span className="mt-1 block break-words text-sm font-extrabold">{money(totals.subtotal, cur)}</span>
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted">Total</span>
                  <span className="mt-1 block break-words text-sm font-extrabold text-brand-400">{money(totals.total, cur)}</span>
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                    {inv.docType === "quotation" ? "Tax" : "Balance"}
                  </span>
                  <span className="mt-1 block break-words text-sm font-extrabold">
                    {money(inv.docType === "quotation" ? totals.tax : totals.balance, cur)}
                  </span>
                </span>
              </div>
            </div>

            {/* =========================== PREVIEW =========================== */}
            <div className="min-w-0 @4xl:sticky @4xl:top-24 @4xl:self-start">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Live preview</p>
              <InvoicePreview inv={inv} totals={totals} />
            </div>
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={download}
              disabled={busy}
              aria-busy={busy}
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:flex-none sm:min-w-[210px]"
            >
              {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Download className="h-[18px] w-[18px]" />}
              {busy ? "Building PDF…" : "Download PDF"}
            </motion.button>
            <ShareSheet
              title="My invoice"
              text="Made with the free Invoice Generator on SnapGrab"
              getFiles={async () => {
                const bytes = (await buildInvoicePdf(inv, totals)).bytes;
                return [new File([bytes as BlobPart], `${inv.docType}-${slugify(inv.number) || "draft"}.pdf`, { type: "application/pdf" })];
              }}
            />
            <button
              type="button"
              onClick={saveNow}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60"
            >
              <Save className="h-[18px] w-[18px]" /> Save draft
            </button>
            <button
              type="button"
              onClick={loadSample}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60"
            >
              <Sparkles className="h-[18px] w-[18px] text-brand-400" /> Load sample
            </button>
            <button
              type="button"
              onClick={newInvoice}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              <FilePlus2 className="h-[18px] w-[18px]" /> New {meta.title.toLowerCase()}
            </button>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-400" />
            <span>
              Everything stays in your browser — drafts auto-save locally{savedAt ? ` (last saved ${savedAt})` : ""}. The PDF uses
              standard fonts, so Urdu script and emoji are replaced; use English/Latin text for best results.
            </span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * live preview — mirrors the PDF layout
 * ------------------------------------------------------------------ */

function InvoicePreview({ inv, totals }: { inv: Invoice; totals: Totals }) {
  const meta = DOC[inv.docType];
  const cur = inv.currency;
  const showPaid = inv.docType !== "quotation" && (totals.paid > 0 || inv.docType === "receipt");

  return (
    <div className="overflow-hidden rounded-2xl bg-white p-5 text-[11px] leading-relaxed text-zinc-800 shadow-xl sm:p-7 sm:text-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-[60%] flex-1">
          {inv.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inv.logo.dataUrl} alt="" className="mb-2 max-h-12 max-w-[140px] object-contain" />
          )}
          <p className="break-words text-sm font-bold text-zinc-900 sm:text-base">
            {inv.from.name || <span className="text-zinc-400">Your business</span>}
          </p>
          {[inv.from.address, inv.from.phone, inv.from.email]
            .filter((s) => s.trim())
            .map((s, i) => (
              <p key={i} className="whitespace-pre-line break-words text-zinc-500">
                {s}
              </p>
            ))}
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold uppercase tracking-wide text-brand-500 sm:text-2xl">{meta.title}</p>
          <dl className="mt-1.5 space-y-0.5">
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">{meta.numberLabel}</dt>
              <dd className="font-bold text-zinc-900">{inv.number || "—"}</dd>
            </div>
            {inv.issueDate && (
              <div className="flex justify-end gap-3">
                <dt className="text-zinc-500">{inv.docType === "receipt" ? "Date" : "Issue date"}</dt>
                <dd className="font-bold text-zinc-900">{fmtDate(inv.issueDate)}</dd>
              </div>
            )}
            {meta.dueLabel && inv.dueDate && (
              <div className="flex justify-end gap-3">
                <dt className="text-zinc-500">{meta.dueLabel}</dt>
                <dd className="font-bold text-zinc-900">{fmtDate(inv.dueDate)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{meta.toLabel}</p>
        <p className="break-words font-bold text-zinc-900">{inv.to.name || <span className="text-zinc-400">Client</span>}</p>
        {[inv.to.address, inv.to.contact]
          .filter((s) => s.trim())
          .map((s, i) => (
            <p key={i} className="whitespace-pre-line break-words text-zinc-500">
              {s}
            </p>
          ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[300px] border-collapse">
          <thead>
            <tr className="bg-brand-500 text-left text-[10px] uppercase tracking-wider text-white">
              <th className="px-2 py-1.5 font-bold">Description</th>
              <th className="px-2 py-1.5 text-right font-bold">Qty</th>
              <th className="px-2 py-1.5 text-right font-bold">Rate</th>
              <th className="px-2 py-1.5 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {totals.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-zinc-400">
                  Add line items to see them here
                </td>
              </tr>
            )}
            {totals.rows.map((r, i) => (
              <tr key={r.item.id} className={i % 2 ? "bg-zinc-50" : ""}>
                <td className="break-words px-2 py-1.5 align-top">{r.item.description || "—"}</td>
                <td className="px-2 py-1.5 text-right align-top">{fmtQty(r.qty)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">{fmtNumber(r.rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right align-top font-bold">{fmtNumber(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end border-t border-zinc-200 pt-2">
        <dl className="w-full max-w-[260px] space-y-1">
          <Row label="Subtotal" value={money(totals.subtotal, cur)} />
          {totals.discount > 0 && (
            <Row
              label={inv.discountType === "percent" ? `Discount (${fmtQty(num(inv.discount))}%)` : "Discount"}
              value={money(-totals.discount, cur)}
            />
          )}
          {num(inv.taxRate) > 0 && (
            <Row label={`${inv.taxLabel.trim() || "Tax"} (${fmtQty(num(inv.taxRate))}%)`} value={money(totals.tax, cur)} />
          )}
          {totals.shipping > 0 && <Row label="Shipping" value={money(totals.shipping, cur)} />}
          <div className="flex justify-between gap-3 rounded bg-brand-50 px-2 py-1 text-[12px] font-bold text-zinc-900 sm:text-sm">
            <dt>Total</dt>
            <dd className="text-brand-600">{money(totals.total, cur)}</dd>
          </div>
          {showPaid && (
            <>
              <Row label="Amount paid" value={money(totals.paid, cur)} />
              <div className="flex justify-between gap-3 px-2 font-bold text-zinc-900">
                <dt>{inv.docType === "receipt" ? "Balance" : "Balance due"}</dt>
                <dd>{money(totals.balance, cur)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {inv.notes.trim() && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
            {inv.docType === "quotation" ? "Terms & notes" : "Notes / payment details"}
          </p>
          <p className="whitespace-pre-line break-words">{inv.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  );
}
