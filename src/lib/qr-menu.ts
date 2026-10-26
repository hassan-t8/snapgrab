/**
 * QR menu — the whole menu lives in the URL fragment, so nothing is stored on a server:
 *
 *   https://<site>/m#1<base64url( deflate-raw( JSON ) )>
 *
 * The first character of the fragment is the format version:
 *   "1"  JSON compressed with CompressionStream("deflate-raw"), base64url-encoded (no padding)
 *   "0"  JSON base64url-encoded without compression (fallback for browsers without CompressionStream)
 *
 * The JSON uses short keys and nested arrays to keep the URL (and the QR code) small:
 *   { v: 1, n: name, t?: tagline, c?: currency, p?: phone, w?: whatsapp, a?: address, h?: hours,
 *     x?: footer note, th?: theme id, k: [ [categoryName, [ [itemName, price, description?], … ]], … ] }
 *
 * The fragment never reaches the server and anyone can craft one, so decodeMenu() treats it as
 * untrusted input: sizes are capped, every field is coerced to a bounded string and anything
 * unexpected is dropped. The viewer renders it as plain text only.
 */

export type MenuItem = { name: string; price: string; desc: string };
export type MenuCategory = { name: string; items: MenuItem[] };
export type QrMenu = {
  name: string;
  tagline: string;
  currency: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  note: string;
  theme: string;
  categories: MenuCategory[];
};

export const MENU_THEMES = [
  { id: "saffron", label: "Saffron", color: "#c2410c" },
  { id: "chilli", label: "Chilli", color: "#b91c1c" },
  { id: "emerald", label: "Emerald", color: "#047857" },
  { id: "teal", label: "Teal", color: "#0f766e" },
  { id: "royal", label: "Royal", color: "#4338ca" },
  { id: "rose", label: "Rose", color: "#be185d" },
  { id: "coffee", label: "Coffee", color: "#78350f" },
  { id: "charcoal", label: "Charcoal", color: "#27272a" },
] as const;

export const DEFAULT_THEME: string = MENU_THEMES[0].id;
export const themeColor = (id: string) => (MENU_THEMES.find((t) => t.id === id) ?? MENU_THEMES[0]).color;

/** Hard limits — applied when decoding a link and mirrored by the editor's input caps. */
export const MENU_LIMITS = {
  name: 80,
  tagline: 120,
  currency: 8,
  phone: 24,
  address: 200,
  hours: 120,
  note: 240,
  category: 60,
  itemName: 90,
  price: 30,
  desc: 240,
  categories: 40,
  itemsPerCategory: 150,
  totalItems: 600,
  /** longest fragment the viewer will try to decode */
  fragment: 12_000,
  /** largest decompressed JSON accepted (guards against a decompression bomb) */
  json: 256_000,
} as const;

/** Above this the QR becomes dense enough that cheap phone cameras struggle with a small print. */
export const QR_COMFORT_CHARS = 1800;
/** A byte-mode QR code (version 40, error correction L) tops out around 2,950 characters. */
export const QR_MAX_CHARS = 2900;

export const blankMenu = (): QrMenu => ({
  name: "",
  tagline: "",
  currency: "Rs",
  phone: "",
  whatsapp: "",
  address: "",
  hours: "",
  note: "",
  theme: DEFAULT_THEME,
  categories: [{ name: "", items: [{ name: "", price: "", desc: "" }] }],
});

/* ------------------------------------------------------------------ *
 * sanitising
 * ------------------------------------------------------------------ */

/** Coerce to a single-line, trimmed, length-capped string with control characters removed. */
export function clean(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Digits (and a leading +) only — safe to put in a tel: link. */
export function telHref(phone: string): string | null {
  const t = phone.trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 15) return null;
  return `tel:${t.startsWith("+") ? "+" : ""}${digits}`;
}

/** wa.me link; Pakistani local numbers (03xx…) are converted to the 92 country code. */
export function whatsappHref(phone: string, text?: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** "1250" → "Rs 1,250"; anything else ("600 / 1100", "Market price") is shown as typed. */
export function formatPrice(price: string, currency: string): string {
  const p = price.trim();
  if (!p) return "";
  const cur = currency.trim();
  if (/^\d+(\.\d{1,2})?$/.test(p)) {
    const [whole, frac] = p.split(".");
    const n = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${cur ? `${cur} ` : ""}${n}${frac ? `.${frac}` : ""}`;
  }
  // starts with a number ("600 / 1100", "450 half") → prefix the currency once
  return /^\d/.test(p) && cur ? `${cur} ${p}` : p;
}

/** Drop empty rows, trim everything and apply the limits. */
export function tidyMenu(m: QrMenu): QrMenu {
  const L = MENU_LIMITS;
  let budget: number = L.totalItems;
  const categories: MenuCategory[] = [];
  for (const c of m.categories.slice(0, L.categories)) {
    const items: MenuItem[] = [];
    for (const it of c.items.slice(0, L.itemsPerCategory)) {
      if (budget <= 0) break;
      const name = clean(it.name, L.itemName);
      if (!name) continue;
      items.push({ name, price: clean(it.price, L.price), desc: clean(it.desc, L.desc) });
      budget--;
    }
    const name = clean(c.name, L.category);
    if (items.length || name) categories.push({ name, items });
  }
  return {
    name: clean(m.name, L.name),
    tagline: clean(m.tagline, L.tagline),
    currency: clean(m.currency, L.currency),
    phone: clean(m.phone, L.phone),
    whatsapp: clean(m.whatsapp, L.phone),
    address: clean(m.address, L.address),
    hours: clean(m.hours, L.hours),
    note: clean(m.note, L.note),
    theme: MENU_THEMES.some((t) => t.id === m.theme) ? m.theme : DEFAULT_THEME,
    categories,
  };
}

/* ------------------------------------------------------------------ *
 * compact JSON shape
 * ------------------------------------------------------------------ */

type Wire = {
  v: 1;
  n: string;
  t?: string;
  c?: string;
  p?: string;
  w?: string;
  a?: string;
  h?: string;
  x?: string;
  th?: string;
  k: [string, ([string, string] | [string, string, string])[]][];
};

function toWire(menu: QrMenu): Wire {
  const m = tidyMenu(menu);
  const w: Wire = { v: 1, n: m.name, k: [] };
  if (m.tagline) w.t = m.tagline;
  if (m.currency !== "Rs") w.c = m.currency; // "Rs" is the default and is omitted
  if (m.phone) w.p = m.phone;
  if (m.whatsapp) w.w = m.whatsapp;
  if (m.address) w.a = m.address;
  if (m.hours) w.h = m.hours;
  if (m.note) w.x = m.note;
  if (m.theme !== DEFAULT_THEME) w.th = m.theme;
  w.k = m.categories.map((c) => [c.name, c.items.map((i) => (i.desc ? [i.name, i.price, i.desc] : [i.name, i.price]))]);
  return w;
}

/** Validate untrusted JSON into a menu, or null when it is not a menu at all. */
export function fromWire(raw: unknown): QrMenu | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.k)) return null;
  const categories: MenuCategory[] = [];
  for (const c of r.k.slice(0, MENU_LIMITS.categories)) {
    if (!Array.isArray(c)) continue;
    const items: MenuItem[] = [];
    const list = Array.isArray(c[1]) ? c[1].slice(0, MENU_LIMITS.itemsPerCategory) : [];
    for (const it of list) {
      if (!Array.isArray(it)) continue;
      items.push({ name: clean(it[0], MENU_LIMITS.itemName), price: clean(it[1], MENU_LIMITS.price), desc: clean(it[2], MENU_LIMITS.desc) });
    }
    categories.push({ name: typeof c[0] === "string" ? c[0] : "", items });
  }
  const menu = tidyMenu({
    name: clean(r.n, MENU_LIMITS.name),
    tagline: clean(r.t, MENU_LIMITS.tagline),
    currency: r.c === undefined ? "Rs" : clean(r.c, MENU_LIMITS.currency),
    phone: clean(r.p, MENU_LIMITS.phone),
    whatsapp: clean(r.w, MENU_LIMITS.phone),
    address: clean(r.a, MENU_LIMITS.address),
    hours: clean(r.h, MENU_LIMITS.hours),
    note: clean(r.x, MENU_LIMITS.note),
    theme: typeof r.th === "string" ? r.th : DEFAULT_THEME,
    categories,
  });
  return menu.name || menu.categories.some((c) => c.items.length) ? menu : null;
}

/* ------------------------------------------------------------------ *
 * base64url
 * ------------------------------------------------------------------ */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const canCompress = () => typeof CompressionStream !== "undefined";

/* ------------------------------------------------------------------ *
 * encode / decode
 * ------------------------------------------------------------------ */

/** Menu → URL fragment (without the leading "#"). */
export async function encodeMenu(menu: QrMenu): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(menu)));
  if (!canCompress()) return `0${toBase64Url(json)}`;
  const stream = new Blob([json as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `1${toBase64Url(packed)}`;
}

/** Read a stream into bytes, giving up once it grows past `limit`. */
async function readCapped(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export type DecodeResult =
  | { ok: true; menu: QrMenu }
  | { ok: false; reason: "empty" | "too-long" | "unsupported" | "invalid" };

/** URL fragment (with or without "#") → validated menu. Never throws. */
export async function decodeMenu(fragment: string): Promise<DecodeResult> {
  const f = fragment.replace(/^#/, "").trim();
  if (!f) return { ok: false, reason: "empty" };
  if (f.length > MENU_LIMITS.fragment) return { ok: false, reason: "too-long" };
  const version = f[0];
  const bytes = fromBase64Url(f.slice(1));
  if (!bytes || !bytes.length) return { ok: false, reason: "invalid" };
  try {
    let json: Uint8Array | null;
    if (version === "1") {
      if (typeof DecompressionStream === "undefined") return { ok: false, reason: "unsupported" };
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      json = await readCapped(stream, MENU_LIMITS.json);
    } else if (version === "0") {
      json = bytes.length <= MENU_LIMITS.json ? bytes : null;
    } else return { ok: false, reason: "invalid" };
    if (!json) return { ok: false, reason: "too-long" };
    const menu = fromWire(JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(json)));
    return menu ? { ok: true, menu } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/** Full shareable menu URL for this site. */
export const menuUrl = (origin: string, fragment: string) => `${origin.replace(/\/+$/, "")}/m#${fragment}`;
