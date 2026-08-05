"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Download, RefreshCw, ShieldCheck } from "lucide-react";
import type { Tool } from "@/lib/tools";

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

const AMBIGUOUS = /[Il1O0]/g;

function randomFrom(alphabet: string, length: number) {
  const out: string[] = [];
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out.push(alphabet[bytes[i] % alphabet.length]);
  return out.join("");
}

/** RFC 4122 v4 from getRandomValues — used when crypto.randomUUID is unavailable (insecure context). */
function uuidV4Fallback() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function hexToRgb(hex: string) {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

const srgb = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrast(rgb: { r: number; g: number; b: number }, white: boolean) {
  const l1 = white ? 1 : 0;
  const l2 = luminance(rgb);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function mix(rgb: { r: number; g: number; b: number }, target: number, amount: number) {
  const f = (c: number) => Math.round(c + (target - c) * amount);
  return `#${[f(rgb.r), f(rgb.g), f(rgb.b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const LOREM_WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(
    " ",
  );

function loremWords(n: number, seed: number) {
  return Array.from({ length: n }, (_, i) => LOREM_WORDS[(i * 7 + seed * 13) % LOREM_WORDS.length]).join(" ");
}

function loremSentence(i: number, seed: number) {
  const len = 8 + ((i * 5 + seed) % 10);
  const s = loremWords(len, seed + i);
  return s[0].toUpperCase() + s.slice(1) + ".";
}

function loremParagraph(i: number, seed: number) {
  return Array.from({ length: 4 + ((i + seed) % 3) }, (_, j) => loremSentence(i * 4 + j, seed)).join(" ");
}

/* ------------------------------------------------------------------ */

function CopyBtn({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
          } catch {}
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
        copied ? "bg-accent-500/15 text-accent-400" : "surface hover:border-brand-400/60"
      } ${className}`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function GeneratorStudio({ tool }: { tool: Tool }) {
  const mode = tool.mode ?? "password";

  /* ---------------- password ---------------- */
  const [length, setLength] = useState(20);
  const [sets, setSets] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [noAmbiguous, setNoAmbiguous] = useState(false);
  const [password, setPassword] = useState("");

  const alphabet = useMemo(() => {
    let a = Object.entries(sets)
      .filter(([, on]) => on)
      .map(([k]) => SETS[k as keyof typeof SETS])
      .join("");
    if (noAmbiguous) a = a.replace(AMBIGUOUS, "");
    return a;
  }, [sets, noAmbiguous]);

  const makePassword = useCallback(() => {
    if (!alphabet) {
      setPassword("");
      return;
    }
    setPassword(randomFrom(alphabet, length));
  }, [alphabet, length]);

  /* ---------------- uuid ---------------- */
  const [count, setCount] = useState(5);
  const [uuidStyle, setUuidStyle] = useState<"lower" | "upper" | "braces">("lower");
  const [uuids, setUuids] = useState<string[]>([]);

  const makeUuids = useCallback(() => {
    const list = Array.from({ length: count }, () =>
      // randomUUID needs a secure context; fall back to getRandomValues, which does not
      typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uuidV4Fallback(),
    );
    setUuids(
      list.map((u) => (uuidStyle === "upper" ? u.toUpperCase() : uuidStyle === "braces" ? `{${u}}` : u)),
    );
  }, [count, uuidStyle]);

  /* ---------------- qr ---------------- */
  const [qrText, setQrText] = useState("https://snapgrab.app");
  const [qrSize, setQrSize] = useState(512);
  const [qrDark, setQrDark] = useState("#0f0d1c");
  const [qrPng, setQrPng] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "qr") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!qrText.trim()) {
        setQrPng("");
        setQrSvg("");
        return;
      }
      try {
        const QR = (await import("qrcode")).default;
        const opts = { width: qrSize, margin: 2, color: { dark: qrDark, light: "#ffffff" } };
        const [png, svg] = await Promise.all([
          QR.toDataURL(qrText, opts),
          QR.toString(qrText, { ...opts, type: "svg" as const }),
        ]);
        if (cancelled) return;
        setQrPng(png);
        setQrSvg(svg);
        setQrError(null);
      } catch (e) {
        if (!cancelled) setQrError(e instanceof Error ? e.message : "Could not build that QR code.");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [qrText, qrSize, qrDark, mode]);

  /* ---------------- color ---------------- */
  const [hex, setHex] = useState("#7048f0");
  const rgb = useMemo(() => hexToRgb(hex), [hex]);
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null), [rgb]);

  /* ---------------- lorem ---------------- */
  const [unit, setUnit] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [amount, setAmount] = useState(3);
  const [seed, setSeed] = useState(1);
  const lorem = useMemo(() => {
    if (unit === "words") return loremWords(amount, seed);
    if (unit === "sentences") return Array.from({ length: amount }, (_, i) => loremSentence(i, seed)).join(" ");
    return Array.from({ length: amount }, (_, i) => loremParagraph(i, seed)).join("\n\n");
  }, [unit, amount, seed]);

  /* ----------- generation, deferred so the values never differ between server and client ----------- */
  useEffect(() => {
    if (mode !== "password") return;
    const raf = requestAnimationFrame(makePassword);
    return () => cancelAnimationFrame(raf);
  }, [mode, makePassword]);

  useEffect(() => {
    if (mode !== "uuid") return;
    const raf = requestAnimationFrame(makeUuids);
    return () => cancelAnimationFrame(raf);
  }, [mode, makeUuids]);

  const track = useCallback(() => {
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ tool: tool.slug, files: 1 }),
    }).catch(() => {});
  }, [tool.slug]);

  const entropy = alphabet ? Math.round(length * Math.log2(alphabet.length)) : 0;
  const strength = entropy >= 128 ? "Excellent" : entropy >= 90 ? "Very strong" : entropy >= 60 ? "Strong" : entropy >= 40 ? "Fair" : "Weak";
  const strengthTone =
    entropy >= 90 ? "text-accent-400" : entropy >= 60 ? "text-brand-400" : entropy >= 40 ? "text-amber-400" : "text-red-400";

  const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          {/* ======================= PASSWORD ======================= */}
          {mode === "password" && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl surface p-4">
                <code className="min-w-0 flex-1 break-all font-mono text-lg font-bold">{password || "Pick at least one character set"}</code>
                <button
                  type="button"
                  onClick={() => {
                    makePassword();
                    track();
                  }}
                  aria-label="Regenerate"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <CopyBtn value={password} />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold">
                  Strength: <span className={strengthTone}>{strength}</span>
                </span>
                <span className="text-xs text-muted">{entropy} bits of entropy</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                <motion.div
                  animate={{ width: `${Math.min(100, (entropy / 128) * 100)}%` }}
                  className={`h-full rounded-full ${
                    entropy >= 90 ? "bg-accent-500" : entropy >= 60 ? "bg-brand-500" : entropy >= 40 ? "bg-amber-500" : "bg-red-500"
                  }`}
                />
              </div>

              <label className="mt-5 block">
                <span className="mb-2 flex items-center justify-between text-sm font-semibold">
                  Length <span className="font-mono text-brand-400">{length}</span>
                </span>
                <input
                  type="range"
                  min={6}
                  max={64}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full accent-[var(--color-brand-500)]"
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSets((s) => ({ ...s, [k]: !s[k] }))}
                    className={`rounded-xl px-3 py-2.5 text-sm font-bold capitalize transition-all ${
                      sets[k] ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[var(--bg-soft)] px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">Avoid look-alike characters</span>
                  <span className="block text-xs text-muted">Excludes I, l, 1, O and 0 for passwords you must type</span>
                </span>
                <input
                  type="checkbox"
                  checked={noAmbiguous}
                  onChange={(e) => setNoAmbiguous(e.target.checked)}
                  className="h-5 w-5 accent-[var(--color-brand-500)]"
                />
              </label>

              <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
                Generated with crypto.getRandomValues in your browser — never sent anywhere.
              </p>
            </>
          )}

          {/* ======================= UUID ======================= */}
          {mode === "uuid" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">How many</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                    className={field}
                  />
                </label>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">Format</span>
                  <div className="flex gap-2">
                    {(["lower", "upper", "braces"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUuidStyle(s)}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold capitalize transition-all ${
                          uuidStyle === s ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    makeUuids();
                    track();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 font-bold text-white shadow-lg shadow-brand-500/25"
                >
                  <RefreshCw className="h-4 w-4" /> Generate
                </button>
                <CopyBtn value={uuids.join("\n")} className="py-3" />
              </div>

              <pre className="mt-4 max-h-80 overflow-auto rounded-2xl surface p-4 font-mono text-[13px] leading-relaxed">
                <code>{uuids.join("\n") || "—"}</code>
              </pre>
            </>
          )}

          {/* ======================= QR ======================= */}
          {mode === "qr" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Content</span>
                <textarea
                  rows={3}
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder="https://example.com — or any text"
                  className={`${field} resize-y`}
                />
                <span className="mt-1.5 block text-xs text-muted">
                  WiFi format: <code className="font-mono">WIFI:T:WPA;S:NetworkName;P:password;;</code>
                </span>
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-sm font-semibold">
                    Size <span className="font-mono text-brand-400">{qrSize}px</span>
                  </span>
                  <input
                    type="range"
                    min={128}
                    max={1024}
                    step={64}
                    value={qrSize}
                    onChange={(e) => setQrSize(Number(e.target.value))}
                    className="w-full accent-[var(--color-brand-500)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Foreground colour</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={qrDark}
                      onChange={(e) => setQrDark(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent"
                    />
                    <input value={qrDark} onChange={(e) => setQrDark(e.target.value)} className={`${field} font-mono`} />
                  </span>
                </label>
              </div>

              {qrError && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{qrError}</p>}

              {qrPng && (
                <div className="mt-5 flex flex-col items-center gap-4">
                  <motion.div
                    key={qrPng.slice(-20)}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-white p-4 shadow-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPng} alt="Generated QR code" width={220} height={220} className="h-[220px] w-[220px]" />
                  </motion.div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <a
                      href={qrPng}
                      download="snapgrab-qr.png"
                      onClick={track}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white"
                    >
                      <Download className="h-4 w-4" /> PNG
                    </a>
                    <a
                      href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
                      download="snapgrab-qr.svg"
                      onClick={track}
                      className="flex items-center gap-2 rounded-xl surface px-5 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60"
                    >
                      <Download className="h-4 w-4" /> SVG
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ======================= COLOR ======================= */}
          {mode === "color" && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={rgb ? hex : "#7048f0"}
                  onChange={(e) => setHex(e.target.value)}
                  aria-label="Pick a colour"
                  className="h-16 w-24 cursor-pointer rounded-2xl border border-[var(--line)] bg-transparent"
                />
                <input
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  placeholder="#7048f0"
                  className={`${field} flex-1 font-mono text-lg font-bold`}
                />
              </div>

              {!rgb ? (
                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  That is not a valid HEX colour. Try something like #7048f0 or #70f.
                </p>
              ) : (
                <>
                  <div className="mt-5 space-y-2">
                    {[
                      { label: "HEX", value: hex.toLowerCase().startsWith("#") ? hex.toLowerCase() : `#${hex.toLowerCase()}` },
                      { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
                      { label: "HSL", value: `hsl(${hsl!.h}, ${hsl!.s}%, ${hsl!.l}%)` },
                      { label: "CSS variable", value: `--brand: ${hex.toLowerCase()};` },
                    ].map((row) => (
                      <div key={row.label} className="flex flex-wrap items-center gap-3 rounded-xl surface p-3">
                        <span className="w-28 shrink-0 text-xs font-bold uppercase tracking-wider text-muted">{row.label}</span>
                        <code className="min-w-0 flex-1 break-all font-mono text-sm">{row.value}</code>
                        <CopyBtn value={row.value} className="px-3 py-1.5 text-xs" />
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 mb-2 text-sm font-semibold">Tints and shades</p>
                  <div className="flex overflow-hidden rounded-xl">
                    {[0.8, 0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6, 0.8].map((amt, i) => {
                      const color = i < 4 ? mix(rgb, 255, amt) : i === 4 ? hex : mix(rgb, 0, amt);
                      return (
                        <div key={i} className="group relative h-16 flex-1" style={{ background: color }} title={color}>
                          <span className="absolute inset-x-0 bottom-1 text-center font-mono text-[9px] text-white/0 transition-colors group-hover:text-white/90">
                            {color}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-5 mb-2 text-sm font-semibold">WCAG contrast</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "On white", ratio: contrast(rgb, true), fg: hex, bg: "#ffffff" },
                      { label: "On black", ratio: contrast(rgb, false), fg: hex, bg: "#000000" },
                    ].map((c) => (
                      <div key={c.label} className="rounded-xl surface p-4">
                        <div className="mb-2 grid h-12 place-items-center rounded-lg font-bold" style={{ background: c.bg, color: c.fg }}>
                          Sample
                        </div>
                        <p className="text-sm font-bold">{c.ratio}:1</p>
                        <p className="text-xs text-muted">
                          {c.label} ·{" "}
                          <span className={c.ratio >= 4.5 ? "text-accent-400" : c.ratio >= 3 ? "text-amber-400" : "text-red-400"}>
                            {c.ratio >= 7 ? "AAA" : c.ratio >= 4.5 ? "AA" : c.ratio >= 3 ? "AA large only" : "fails"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ======================= LOREM ======================= */}
          {mode === "lorem" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">Unit</span>
                  <div className="flex gap-2">
                    {(["paragraphs", "sentences", "words"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold capitalize transition-all ${
                          unit === u ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">How many</span>
                  <input
                    type="number"
                    min={1}
                    max={unit === "words" ? 500 : 30}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Math.min(unit === "words" ? 500 : 30, Number(e.target.value) || 1)))}
                    className={field}
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSeed((s) => s + 1);
                    track();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 font-bold text-white shadow-lg shadow-brand-500/25"
                >
                  <RefreshCw className="h-4 w-4" /> Shuffle
                </button>
                <CopyBtn value={lorem} className="py-3" />
              </div>

              <div className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl surface p-4 text-sm leading-relaxed text-muted">
                {lorem}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
