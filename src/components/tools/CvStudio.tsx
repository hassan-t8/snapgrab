"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ChevronDown, ChevronUp, Download, Eraser, Loader2, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import type { PDFFont } from "pdf-lib";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet from "@/components/ShareSheet";

/* ------------------------------------------------------------------ *
 * types & constants
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "sg-cv-draft";

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";

type Template = "classic" | "modern" | "compact" | "professional";

const TEMPLATES: { id: Template; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Centred, black & white" },
  { id: "modern", label: "Modern", hint: "Colour header band" },
  { id: "compact", label: "Compact", hint: "Dense one-page layout" },
  { id: "professional", label: "Professional", hint: "Serif, thin rules" },
];
const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

type Experience = { id: string; title: string; company: string; location: string; start: string; end: string; current: boolean; bullets: string };
type Education = { id: string; degree: string; institute: string; location: string; start: string; end: string; grade: string };
type Project = { id: string; name: string; tech: string; link: string; bullets: string };
type Certification = { id: string; name: string; issuer: string; year: string };

type Cv = {
  template: Template;
  accent: string;
  personal: { name: string; headline: string; email: string; phone: string; location: string; linkedin: string; website: string };
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string;
  projects: Project[];
  certifications: Certification[];
  languages: string;
};

type ListKey = "experience" | "education" | "projects" | "certifications";

const ACCENTS = ["#1f4e79", "#7048f0", "#0f766e", "#b91c1c", "#334155", "#9a3412"];
const DEFAULT_ACCENT = ACCENTS[0];

let seq = 0;
const uid = () => `e${++seq}`;

const newExperience = (p: Partial<Experience> = {}): Experience => ({
  title: "",
  company: "",
  location: "",
  start: "",
  end: "",
  current: false,
  bullets: "",
  ...p,
  id: uid(),
});
const newEducation = (p: Partial<Education> = {}): Education => ({
  degree: "",
  institute: "",
  location: "",
  start: "",
  end: "",
  grade: "",
  ...p,
  id: uid(),
});
const newProject = (p: Partial<Project> = {}): Project => ({ name: "", tech: "", link: "", bullets: "", ...p, id: uid() });
const newCertification = (p: Partial<Certification> = {}): Certification => ({ name: "", issuer: "", year: "", ...p, id: uid() });

function blankCv(template: Template = "classic", accent = DEFAULT_ACCENT): Cv {
  return {
    template,
    accent,
    personal: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "", website: "" },
    summary: "",
    experience: [newExperience()],
    education: [newEducation()],
    skills: "",
    projects: [],
    certifications: [],
    languages: "",
  };
}

function sampleCv(template: Template, accent: string): Cv {
  return {
    template,
    accent,
    personal: {
      name: "Ayesha Khan",
      headline: "Software Engineer — React, Node.js & Cloud",
      email: "ayesha.khan@email.com",
      phone: "+92 300 1234567",
      location: "Lahore, Pakistan",
      linkedin: "linkedin.com/in/ayeshakhan",
      website: "github.com/ayeshakhan",
    },
    summary:
      "Full-stack software engineer with 4+ years of experience building fast, accessible web applications for fintech and e-commerce clients. Comfortable owning features end to end — from database design to polished React interfaces — and mentoring junior developers.",
    experience: [
      newExperience({
        title: "Senior Software Engineer",
        company: "Arbisoft",
        location: "Lahore",
        start: "Mar 2023",
        current: true,
        bullets:
          "Led a team of 4 engineers rebuilding a payments dashboard in Next.js, cutting page load time by 45%\nDesigned a Node.js + PostgreSQL reporting service processing 2M+ transactions per day\nIntroduced automated testing and CI pipelines, reducing production bugs by 30%",
      }),
      newExperience({
        title: "Software Engineer",
        company: "Systems Limited",
        location: "Lahore",
        start: "Jul 2021",
        end: "Feb 2023",
        bullets:
          "Built responsive React interfaces for a retail client serving 500k monthly users\nIntegrated JazzCash and Easypaisa payment gateways\nImproved Lighthouse accessibility score from 68 to 96",
      }),
    ],
    education: [
      newEducation({
        degree: "BS Computer Science",
        institute: "FAST National University (NUCES)",
        location: "Lahore",
        start: "2017",
        end: "2021",
        grade: "CGPA 3.6 / 4.0",
      }),
    ],
    skills:
      "Languages: TypeScript, JavaScript, Python, SQL\nFrameworks: React, Next.js, Node.js, Express, Tailwind CSS\nTools: Git, Docker, AWS, PostgreSQL, MongoDB, Jest",
    projects: [
      newProject({
        name: "Rozgar Finder",
        tech: "Next.js, Prisma, PostgreSQL",
        link: "github.com/ayeshakhan/rozgar",
        bullets: "Job board for Pakistani freelancers with Urdu/English search\n1,200+ registered users within three months of launch",
      }),
    ],
    certifications: [
      newCertification({ name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", year: "2024" }),
      newCertification({ name: "Meta Front-End Developer Certificate", issuer: "Coursera", year: "2022" }),
    ],
    languages: "English (Professional), Urdu (Native), Punjabi (Native)",
  };
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** One bullet per line; leading "-", "*" or "•" markers are stripped. */
const bulletsOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•–·]\s*/, "").trim())
    .filter(Boolean);

function dateRange(start: string, end: string, current = false) {
  const s = start.trim();
  const e = current ? "Present" : end.trim();
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

const joinParts = (parts: string[], sep = " · ") => parts.map((p) => p.trim()).filter(Boolean).join(sep);

/** "Group: a, b" lines → { group, items }; plain lines have no group. */
function skillLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([^:]{1,40}):\s*(.+)$/);
      return m ? { group: m[1].trim(), items: m[2].trim() } : { group: "", items: l };
    });
}

/** The Compact template's single skills line: "Group: a, b  •  Group: c, d". */
const compactSkills = (skills: ReturnType<typeof skillLines>) => skills.map((s) => (s.group ? `${s.group}: ${s.items}` : s.items)).join("  •  ");

function hexToRgb(hex: string) {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

/** True when white text would be hard to read on this colour. */
function isLight(hex: string) {
  const c = hexToRgb(hex);
  if (!c) return false;
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b) > 0.45;
}

const safeAccent = (hex: string) => (hexToRgb(hex) ? (hex.startsWith("#") ? hex : `#${hex}`) : DEFAULT_ACCENT);

/* --------------------------- draft storage --------------------------- */

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const objs = (v: unknown) => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : []);

function normalise(raw: unknown): Cv | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = (r.personal ?? {}) as Record<string, unknown>;
  return {
    template: TEMPLATE_IDS.includes(r.template as Template) ? (r.template as Template) : "classic",
    accent: typeof r.accent === "string" && hexToRgb(r.accent) ? r.accent : DEFAULT_ACCENT,
    personal: {
      name: str(p.name),
      headline: str(p.headline),
      email: str(p.email),
      phone: str(p.phone),
      location: str(p.location),
      linkedin: str(p.linkedin),
      website: str(p.website),
    },
    summary: str(r.summary),
    experience: objs(r.experience).map((e) =>
      newExperience({
        title: str(e.title),
        company: str(e.company),
        location: str(e.location),
        start: str(e.start),
        end: str(e.end),
        current: e.current === true,
        bullets: str(e.bullets),
      }),
    ),
    education: objs(r.education).map((e) =>
      newEducation({
        degree: str(e.degree),
        institute: str(e.institute),
        location: str(e.location),
        start: str(e.start),
        end: str(e.end),
        grade: str(e.grade),
      }),
    ),
    skills: str(r.skills),
    projects: objs(r.projects).map((e) => newProject({ name: str(e.name), tech: str(e.tech), link: str(e.link), bullets: str(e.bullets) })),
    certifications: objs(r.certifications).map((e) => newCertification({ name: str(e.name), issuer: str(e.issuer), year: str(e.year) })),
    languages: str(r.languages),
  };
}

function readDraft(): Cv | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeDraft(cv: Cv): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cv));
    return true;
  } catch {
    return false;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — nothing to clear
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
    // emoji & pictographs: drop rather than litter the CV with "?"
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

/* ------------------------------------------------------------------ *
 * PDF builder — single column, real text, standard headings (ATS-friendly)
 * ------------------------------------------------------------------ */

type EntrySpec = { title: string; right?: string; sub?: string; bullets: string[] };

/** Per-template typography. Classic and Modern keep their original metrics. */
type PdfLook = {
  margin: number;
  title: { size: number; lh: number };
  sub: { size: number; lh: number };
  bul: { size: number; lh: number; indent: number };
  right: number;
  para: { size: number; lh: number };
  sec: { gap: number; lh: number; size: number; ruleGap: number; after: number; rule: number };
  entryGap: number;
};

const PDF_LOOKS: Record<Template, PdfLook> = {
  classic: {
    margin: 45.35, // 16 mm
    title: { size: 10.5, lh: 14 },
    sub: { size: 10, lh: 13.5 },
    bul: { size: 10, lh: 13.5, indent: 11 },
    right: 9.5,
    para: { size: 10, lh: 14 },
    sec: { gap: 10, lh: 14, size: 11, ruleGap: 5, after: 7, rule: 0.7 },
    entryGap: 8,
  },
  modern: {
    margin: 45.35,
    title: { size: 10.5, lh: 14 },
    sub: { size: 10, lh: 13.5 },
    bul: { size: 10, lh: 13.5, indent: 11 },
    right: 9.5,
    para: { size: 10, lh: 14 },
    sec: { gap: 10, lh: 14, size: 11, ruleGap: 5, after: 7, rule: 1.1 },
    entryGap: 8,
  },
  compact: {
    margin: 36, // 12.7 mm
    title: { size: 10, lh: 12.5 },
    sub: { size: 9.5, lh: 12 },
    bul: { size: 9.5, lh: 12, indent: 10 },
    right: 9,
    para: { size: 9.5, lh: 12.5 },
    sec: { gap: 7, lh: 12.5, size: 10, ruleGap: 3.5, after: 5, rule: 0.6 },
    entryGap: 5,
  },
  professional: {
    margin: 48, // 17 mm
    title: { size: 11, lh: 14 },
    sub: { size: 10.5, lh: 13.5 },
    bul: { size: 10.5, lh: 13.5, indent: 12 },
    right: 10,
    para: { size: 10.5, lh: 14 },
    sec: { gap: 10, lh: 15, size: 11.5, ruleGap: 4, after: 7, rule: 0.5 },
    entryGap: 7,
  },
};

async function buildCvPdf(cv: Cv): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const p = cv.personal;
  const name = p.name.trim();
  doc.setTitle(name ? `${name} — CV` : "CV");
  if (name) doc.setAuthor(name);
  doc.setSubject("Curriculum vitae / resume");
  doc.setCreator("SnapGrab CV Builder");

  const tpl = cv.template;
  const L = PDF_LOOKS[tpl] ?? PDF_LOOKS.classic;
  const serif = tpl === "professional";
  const font = await doc.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const bold = await doc.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const italic = serif ? await doc.embedFont(StandardFonts.TimesRomanItalic) : font;

  const W = 595.28;
  const H = 841.89;
  const M = L.margin;
  const CW = W - 2 * M;
  const BOTTOM = Math.max(M, 40);
  const modern = tpl === "modern";
  const coloured = tpl !== "classic";
  const ac = hexToRgb(cv.accent) ?? hexToRgb(DEFAULT_ACCENT)!;
  const accent = rgb(ac.r / 255, ac.g / 255, ac.b / 255);
  const ink = tpl === "classic" ? rgb(0, 0, 0) : rgb(0.1, 0.1, 0.12);
  const subInk = rgb(0.22, 0.22, 0.25);
  const muted = rgb(0.36, 0.36, 0.4);
  const white = rgb(1, 1, 1);
  const headInk = coloured && !isLight(cv.accent) ? accent : ink; // light accents fall back to dark text for contrast
  const ruleInk = coloured ? accent : ink;

  let page = doc.addPage([W, H]);
  let y = H - M;
  const atTop = () => y >= H - M - 0.5;
  const ensure = (h: number) => {
    if (y - h < BOTTOM) {
      page = doc.addPage([W, H]);
      y = H - M;
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
  /** Advance one line (breaking the page first if needed) and return its baseline. */
  const nextLine = (lh: number) => {
    ensure(lh);
    y -= lh;
    return y + lh * 0.26;
  };
  const rule = (thickness: number, color = ruleInk) => page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness, color });

  /* ---------------- header ---------------- */
  const contacts = joinParts([p.email, p.phone, p.location, p.linkedin, p.website], "  |  ");
  const nameText = name || "Your Name";
  const centred = (s: string, size: number, lh: number, f: PDFFont, color = ink) => {
    for (const l of wrap(s, f, size, CW)) {
      const base = nextLine(lh);
      draw(l, M + (CW - f.widthOfTextAtSize(l, size)) / 2, base, size, f, color);
    }
  };
  const leftAligned = (s: string, size: number, lh: number, f: PDFFont, color = ink) => {
    for (const l of wrap(s, f, size, CW)) draw(l, M, nextLine(lh), size, f, color);
  };

  if (modern) {
    const onAccent = isLight(cv.accent) ? rgb(0.08, 0.08, 0.1) : white;
    const nameLines = wrap(nameText, bold, 24, CW);
    const headLines = p.headline.trim() ? wrap(p.headline, font, 12, CW) : [];
    const contactLines = contacts ? wrap(contacts, font, 9.5, CW) : [];
    const padTop = 30;
    const padBottom = 20;
    const blockH = padTop + nameLines.length * 28 + (headLines.length ? 4 + headLines.length * 15 : 0) + (contactLines.length ? 6 + contactLines.length * 13 : 0) + padBottom;
    page.drawRectangle({ x: 0, y: H - blockH, width: W, height: blockH, color: accent });
    let hy = H - padTop;
    nameLines.forEach((l) => {
      hy -= 28;
      draw(l, M, hy + 6, 24, bold, onAccent);
    });
    if (headLines.length) hy -= 4;
    headLines.forEach((l) => {
      hy -= 15;
      draw(l, M, hy + 3.5, 12, font, onAccent);
    });
    if (contactLines.length) hy -= 6;
    contactLines.forEach((l) => {
      hy -= 13;
      draw(l, M, hy + 3, 9.5, font, onAccent);
    });
    y = H - blockH - 8;
  } else if (tpl === "compact") {
    leftAligned(nameText, 19, 22, bold, ink);
    if (p.headline.trim()) leftAligned(p.headline, 10.5, 13.5, font, headInk);
    if (contacts) {
      y -= 1;
      leftAligned(contacts, 9, 12, font, subInk);
    }
    y -= 5;
    rule(1);
    y -= 1;
  } else if (serif) {
    centred(nameText, 24, 28, bold, ink);
    if (p.headline.trim()) {
      y -= 1;
      centred(p.headline, 12, 15.5, italic, subInk);
    }
    if (contacts) {
      y -= 3;
      centred(contacts, 10, 13.5, font, subInk);
    }
    y -= 8;
    rule(0.5);
    y -= 2.2;
    rule(0.5);
    y -= 2;
  } else {
    centred(nameText, 22, 27, bold);
    if (p.headline.trim()) {
      y -= 2;
      centred(p.headline, 11.5, 15, font, subInk);
    }
    if (contacts) {
      y -= 3;
      centred(contacts, 9.5, 13, font, subInk);
    }
    y -= 8;
    rule(1.2, ink);
    y -= 2;
  }

  /* ---------------- building blocks ---------------- */
  const S = L.sec;
  const SEC_H = S.gap + S.lh + S.ruleGap + S.after;
  const section = (title: string, keep: number) => {
    ensure(SEC_H + keep);
    if (!atTop()) y -= S.gap;
    y -= S.lh;
    draw(title.toUpperCase(), M, y + 3, S.size, bold, headInk);
    y -= S.ruleGap;
    rule(S.rule);
    y -= S.after;
  };

  const TITLE = L.title;
  const SUB = L.sub;
  const BUL = L.bul;
  const subFont = italic; // the serif template sets company / institute lines in italic
  const rightFont = italic;

  const prepare = (e: EntrySpec) => {
    const right = e.right?.trim() ? pdfSafe(e.right.trim()) : "";
    const rightW = right ? rightFont.widthOfTextAtSize(right, L.right) : 0;
    const rightInline = rightW > 0 && rightW < CW * 0.4;
    const reserve = rightInline ? rightW + 14 : 0;
    const titleLines = e.title.trim() ? wrap(e.title, bold, TITLE.size, CW - reserve) : [];
    const subText = rightInline || !right ? e.sub ?? "" : joinParts([e.sub ?? "", right], "  |  ");
    const subLines = subText.trim() ? wrap(subText, subFont, SUB.size, CW - (titleLines.length ? 0 : reserve)) : [];
    const bullets = e.bullets.map((b) => wrap(b, font, BUL.size, CW - BUL.indent));
    const headH = titleLines.length * TITLE.lh + subLines.length * SUB.lh + 4;
    const firstH = bullets[0] ? Math.min(bullets[0].length, 3) * BUL.lh : 0;
    return { right, rightInline, titleLines, subLines, bullets, keep: headH + firstH };
  };

  const drawEntry = (e: ReturnType<typeof prepare>, gap = 6) => {
    ensure(e.keep + gap);
    if (!atTop()) y -= gap;
    let rightDone = !e.rightInline;
    e.titleLines.forEach((l) => {
      const base = nextLine(TITLE.lh);
      draw(l, M, base, TITLE.size, bold, ink);
      if (!rightDone) {
        drawRight(e.right, M + CW, base, L.right, rightFont, muted);
        rightDone = true;
      }
    });
    e.subLines.forEach((l) => {
      const base = nextLine(SUB.lh);
      draw(l, M, base, SUB.size, subFont, subInk);
      if (!rightDone) {
        drawRight(e.right, M + CW, base, L.right, rightFont, muted);
        rightDone = true;
      }
    });
    if (e.bullets.length) y -= 2;
    e.bullets.forEach((lines) => {
      lines.forEach((l, i) => {
        const base = nextLine(BUL.lh);
        if (i === 0) draw("•", M + 2, base, BUL.size, font, headInk);
        draw(l, M + BUL.indent, base, BUL.size, font, ink);
      });
    });
  };

  const paragraph = (text: string, size = L.para.size, lh = L.para.lh) => {
    for (const l of wrap(text, font, size, CW)) {
      const base = nextLine(lh);
      draw(l, M, base, size, font, ink);
    }
  };

  const listSection = (title: string, specs: EntrySpec[]) => {
    const prepared = specs.filter((s) => s.title.trim() || s.sub?.trim() || s.right?.trim() || s.bullets.length).map(prepare);
    if (!prepared.length) return;
    section(title, prepared[0].keep + 4);
    prepared.forEach((e, i) => drawEntry(e, i === 0 ? 2 : L.entryGap));
  };

  /* ---------------- sections ---------------- */
  if (cv.summary.trim()) {
    section("Summary", 2 * L.para.lh);
    y -= 2;
    paragraph(cv.summary);
  }

  listSection(
    "Experience",
    cv.experience.map((e) => ({
      title: e.title,
      right: dateRange(e.start, e.end, e.current),
      sub: joinParts([e.company, e.location]),
      bullets: bulletsOf(e.bullets),
    })),
  );

  listSection(
    "Education",
    cv.education.map((e) => ({
      title: e.degree,
      right: dateRange(e.start, e.end),
      sub: joinParts([joinParts([e.institute, e.location], ", "), e.grade]),
      bullets: [],
    })),
  );

  listSection(
    "Projects",
    cv.projects.map((e) => ({
      title: e.name,
      sub: joinParts([e.tech ? `Tech: ${e.tech}` : "", e.link], "  |  "),
      bullets: bulletsOf(e.bullets),
    })),
  );

  const skills = skillLines(cv.skills);
  if (skills.length) {
    section("Skills", 2 * L.para.lh);
    y -= 2;
    if (tpl === "compact") {
      // one dense, wrapped line: "Group: a, b  •  Group: c, d"
      paragraph(compactSkills(skills));
    } else {
      const size = L.para.size;
      for (const s of skills) {
        const label = s.group ? pdfSafe(`${s.group}: `) : "";
        const labelW = label ? bold.widthOfTextAtSize(label, size) : 0;
        if (label && labelW < CW * 0.5) {
          wrap(s.items, font, size, CW, CW - labelW).forEach((l, i) => {
            const base = nextLine(L.para.lh);
            if (i === 0) draw(label, M, base, size, bold, ink);
            draw(l, M + (i === 0 ? labelW : 0), base, size, font, ink);
          });
        } else paragraph(s.group ? `${s.group}: ${s.items}` : s.items);
      }
    }
  }

  listSection(
    "Certifications",
    cv.certifications.map((c) =>
      tpl === "compact"
        ? { title: joinParts([c.name, c.issuer], " — "), right: c.year, bullets: [] }
        : { title: c.name, right: c.year, sub: c.issuer, bullets: [] },
    ),
  );

  if (cv.languages.trim()) {
    section("Languages", L.para.lh);
    y -= 2;
    paragraph(cv.languages);
  }

  /* ---------------- page numbers (multi-page only) ---------------- */
  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      const label = pdfSafe(`${name ? `${name} — ` : ""}Page ${i + 1} of ${pages.length}`);
      pg.drawText(label, { x: M + CW - font.widthOfTextAtSize(label, 8), y: BOTTOM / 2 - 3, size: 8, font, color: muted });
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
  type = "text",
  inputMode,
  autoComplete,
  error,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "email" | "tel" | "url" | "text";
  autoComplete?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={`${field} disabled:opacity-50 ${error ? "border-red-500/60" : ""}`}
      />
      {error && (
        <span className="mt-1 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </span>
      )}
    </label>
  );
}

function Area({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label} {hint && <span className="font-normal text-muted">({hint})</span>}
      </span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${field} resize-y`} />
    </label>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <fieldset className="rounded-2xl surface p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</legend>
      <div className="space-y-3">{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </fieldset>
  );
}

function EntryCard({
  label,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const btn = "grid h-9 w-9 place-items-center rounded-xl surface text-muted transition-colors disabled:opacity-40";
  return (
    <div className="rounded-xl bg-[var(--bg-soft)] p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{label}</span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`} className={`${btn} hover:text-[var(--fg)]`}>
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          aria-label={`Move ${label} down`}
          className={`${btn} hover:text-[var(--fg)]`}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className={`${btn} hover:text-red-400`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl surface px-4 py-2 text-sm font-bold hover:border-brand-400/60"
    >
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * component
 * ------------------------------------------------------------------ */

export default function CvStudio({ tool }: { tool: Tool }) {
  const [cv, setCv] = useState<Cv>(() => blankCv());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load the saved draft after mount so server and client render the same markup.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const draft = readDraft();
      if (draft) setCv(draft);
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Debounced auto-save.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      if (!writeDraft(cv)) return;
      const now = new Date();
      setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }, 700);
    return () => window.clearTimeout(t);
  }, [cv, ready]);

  const nameError = showErrors && !cv.personal.name.trim() ? "Add your full name — it is the CV heading and file name." : undefined;

  const setField = <K extends keyof Cv>(key: K, value: Cv[K]) => setCv((prev) => ({ ...prev, [key]: value }));
  const setPersonal = (key: keyof Cv["personal"], value: string) => setCv((prev) => ({ ...prev, personal: { ...prev.personal, [key]: value } }));

  function updateEntry<K extends ListKey>(key: K, id: string, patch: Partial<Cv[K][number]>) {
    setCv((prev) => ({ ...prev, [key]: (prev[key] as Cv[K][number][]).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  function addEntry<K extends ListKey>(key: K, entry: Cv[K][number]) {
    setCv((prev) => ({ ...prev, [key]: [...(prev[key] as Cv[K][number][]), entry] }));
  }
  function removeEntry(key: ListKey, id: string) {
    setCv((prev) => ({ ...prev, [key]: (prev[key] as { id: string }[]).filter((e) => e.id !== id) }));
  }
  function moveEntry(key: ListKey, index: number, dir: -1 | 1) {
    setCv((prev) => {
      const list = [...(prev[key] as { id: string }[])];
      const to = index + dir;
      if (to < 0 || to >= list.length) return prev;
      [list[index], list[to]] = [list[to], list[index]];
      return { ...prev, [key]: list };
    });
  }

  function loadSample() {
    setCv((prev) => sampleCv(prev.template, prev.accent));
    setShowErrors(false);
    trackEvent("sample", tool.slug);
    notify.info("Sample CV loaded", "Replace the details with your own — the preview updates live.");
  }

  function clearAll() {
    if (!window.confirm("Clear the whole CV? This removes every section and the saved draft.")) return;
    setCv((prev) => blankCv(prev.template, prev.accent));
    clearDraft();
    setShowErrors(false);
    trackEvent("reset", tool.slug);
    notify.info("CV cleared", "Start fresh, or load the sample to see the layout.");
  }

  async function download() {
    if (busy) return;
    setShowErrors(true);
    if (!cv.personal.name.trim()) {
      notify.error("Your name is missing", "Add your full name in the Personal section.");
      return;
    }
    setBusy(true);
    try {
      const bytes = await buildCvPdf(cv);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const fileName = `${slugify(cv.personal.name) || "my"}-cv.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
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

      notify.success("PDF downloaded", fileName);
    } catch (err) {
      notify.error("Could not build the PDF", err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const p = cv.personal;

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass @container rounded-[26px] p-4 sm:p-6">
          {/* template */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid min-w-[220px] flex-1 grid-cols-2 gap-2 @lg:grid-cols-4" role="radiogroup" aria-label="Template">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={cv.template === t.id}
                  onClick={() => setField("template", t.id)}
                  title={t.hint}
                  className={`rounded-xl px-3 py-2 text-left transition-all ${
                    cv.template === t.id
                      ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                      : "surface text-muted hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="block text-sm font-bold">{t.label}</span>
                  <span className={`block truncate text-[11px] ${cv.template === t.id ? "text-white/80" : "text-muted"}`}>{t.hint}</span>
                </button>
              ))}
            </div>
            {cv.template !== "classic" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold" id="accent-label">
                  Accent
                </span>
                <div className="flex gap-1.5" role="group" aria-labelledby="accent-label">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setField("accent", c)}
                      aria-label={`Accent colour ${c}`}
                      aria-pressed={cv.accent.toLowerCase() === c}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        cv.accent.toLowerCase() === c ? "border-[var(--fg)]" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={safeAccent(cv.accent)}
                  onChange={(e) => setField("accent", e.target.value)}
                  aria-label="Custom accent colour"
                  className="h-8 w-11 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent"
                />
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-6 @4xl:grid-cols-2">
            {/* =========================== FORM =========================== */}
            <div className="@container min-w-0 space-y-4">
              <Section title="Personal">
                <Field label="Full name" required value={p.name} onChange={(v) => setPersonal("name", v)} placeholder="Ayesha Khan" autoComplete="name" error={nameError} />
                <Field label="Headline / job title" value={p.headline} onChange={(v) => setPersonal("headline", v)} placeholder="Software Engineer" />
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label="Email" type="email" inputMode="email" autoComplete="email" value={p.email} onChange={(v) => setPersonal("email", v)} placeholder="you@email.com" />
                  <Field label="Phone" type="tel" inputMode="tel" autoComplete="tel" value={p.phone} onChange={(v) => setPersonal("phone", v)} placeholder="+92 300 1234567" />
                  <Field label="Location" value={p.location} onChange={(v) => setPersonal("location", v)} placeholder="Lahore, Pakistan" />
                  <Field label="LinkedIn" inputMode="url" value={p.linkedin} onChange={(v) => setPersonal("linkedin", v)} placeholder="linkedin.com/in/you" />
                </div>
                <Field label="Website / GitHub" inputMode="url" value={p.website} onChange={(v) => setPersonal("website", v)} placeholder="github.com/you" />
              </Section>

              <Section title="Professional summary">
                <Area
                  label="Summary"
                  hint="2–4 sentences"
                  rows={4}
                  value={cv.summary}
                  onChange={(v) => setField("summary", v)}
                  placeholder="Who you are, your years of experience, key strengths and what you are looking for."
                />
              </Section>

              <Section title="Experience" action={<AddButton onClick={() => addEntry("experience", newExperience())}>Add experience</AddButton>}>
                {cv.experience.length === 0 && <p className="text-sm text-muted">No experience entries — add one, or leave empty for a fresher CV.</p>}
                {cv.experience.map((e, i) => (
                  <EntryCard
                    key={e.id}
                    label={e.title.trim() || `Experience ${i + 1}`}
                    index={i}
                    count={cv.experience.length}
                    onMove={(d) => moveEntry("experience", i, d)}
                    onRemove={() => removeEntry("experience", e.id)}
                  >
                    <div className="grid gap-3 @md:grid-cols-2">
                      <Field label="Job title" value={e.title} onChange={(v) => updateEntry("experience", e.id, { title: v })} placeholder="Software Engineer" />
                      <Field label="Company" value={e.company} onChange={(v) => updateEntry("experience", e.id, { company: v })} placeholder="Company name" />
                      <Field label="Location" value={e.location} onChange={(v) => updateEntry("experience", e.id, { location: v })} placeholder="Karachi / Remote" />
                      <Field label="Start" value={e.start} onChange={(v) => updateEntry("experience", e.id, { start: v })} placeholder="Jan 2023" />
                      <Field label="End" value={e.current ? "Present" : e.end} disabled={e.current} onChange={(v) => updateEntry("experience", e.id, { end: v })} placeholder="Dec 2024" />
                      <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl surface px-4 py-2.5 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={e.current}
                          onChange={(ev) => updateEntry("experience", e.id, { current: ev.target.checked })}
                          className="h-4 w-4 accent-[var(--color-brand-500)]"
                        />
                        I currently work here
                      </label>
                    </div>
                    <Area
                      label="Achievements"
                      hint="one bullet per line"
                      rows={4}
                      value={e.bullets}
                      onChange={(v) => updateEntry("experience", e.id, { bullets: v })}
                      placeholder={"Increased sales by 20% by…\nLed a team of 5…"}
                    />
                  </EntryCard>
                ))}
              </Section>

              <Section title="Education" action={<AddButton onClick={() => addEntry("education", newEducation())}>Add education</AddButton>}>
                {cv.education.map((e, i) => (
                  <EntryCard
                    key={e.id}
                    label={e.degree.trim() || `Education ${i + 1}`}
                    index={i}
                    count={cv.education.length}
                    onMove={(d) => moveEntry("education", i, d)}
                    onRemove={() => removeEntry("education", e.id)}
                  >
                    <div className="grid gap-3 @md:grid-cols-2">
                      <Field label="Degree" value={e.degree} onChange={(v) => updateEntry("education", e.id, { degree: v })} placeholder="BS Computer Science" />
                      <Field label="Institute" value={e.institute} onChange={(v) => updateEntry("education", e.id, { institute: v })} placeholder="University name" />
                      <Field label="Location" value={e.location} onChange={(v) => updateEntry("education", e.id, { location: v })} placeholder="Islamabad" />
                      <Field label="Grade / CGPA" value={e.grade} onChange={(v) => updateEntry("education", e.id, { grade: v })} placeholder="CGPA 3.5 / 4.0" />
                      <Field label="Start year" value={e.start} onChange={(v) => updateEntry("education", e.id, { start: v })} placeholder="2019" />
                      <Field label="End year" value={e.end} onChange={(v) => updateEntry("education", e.id, { end: v })} placeholder="2023" />
                    </div>
                  </EntryCard>
                ))}
              </Section>

              <Section title="Skills">
                <Area
                  label="Skills"
                  hint='comma-separated, or one group per line like "Tools: Excel, Figma"'
                  rows={4}
                  value={cv.skills}
                  onChange={(v) => setField("skills", v)}
                  placeholder={"Languages: JavaScript, Python\nTools: Git, Figma, MS Excel"}
                />
              </Section>

              <Section title="Projects" action={<AddButton onClick={() => addEntry("projects", newProject())}>Add project</AddButton>}>
                {cv.projects.length === 0 && <p className="text-sm text-muted">Optional — great for students and developers.</p>}
                {cv.projects.map((e, i) => (
                  <EntryCard
                    key={e.id}
                    label={e.name.trim() || `Project ${i + 1}`}
                    index={i}
                    count={cv.projects.length}
                    onMove={(d) => moveEntry("projects", i, d)}
                    onRemove={() => removeEntry("projects", e.id)}
                  >
                    <div className="grid gap-3 @md:grid-cols-2">
                      <Field label="Project name" value={e.name} onChange={(v) => updateEntry("projects", e.id, { name: v })} placeholder="Final year project" />
                      <Field label="Tech used" value={e.tech} onChange={(v) => updateEntry("projects", e.id, { tech: v })} placeholder="React, Firebase" />
                    </div>
                    <Field label="Link" inputMode="url" value={e.link} onChange={(v) => updateEntry("projects", e.id, { link: v })} placeholder="github.com/you/project" />
                    <Area
                      label="Description"
                      hint="one bullet per line"
                      rows={3}
                      value={e.bullets}
                      onChange={(v) => updateEntry("projects", e.id, { bullets: v })}
                      placeholder="What it does and the impact it had"
                    />
                  </EntryCard>
                ))}
              </Section>

              <Section title="Certifications" action={<AddButton onClick={() => addEntry("certifications", newCertification())}>Add certification</AddButton>}>
                {cv.certifications.length === 0 && <p className="text-sm text-muted">Optional — courses, licences and certificates.</p>}
                {cv.certifications.map((e, i) => (
                  <EntryCard
                    key={e.id}
                    label={e.name.trim() || `Certification ${i + 1}`}
                    index={i}
                    count={cv.certifications.length}
                    onMove={(d) => moveEntry("certifications", i, d)}
                    onRemove={() => removeEntry("certifications", e.id)}
                  >
                    <Field label="Certification" value={e.name} onChange={(v) => updateEntry("certifications", e.id, { name: v })} placeholder="Google Data Analytics" />
                    <div className="grid gap-3 @md:grid-cols-2">
                      <Field label="Issuer" value={e.issuer} onChange={(v) => updateEntry("certifications", e.id, { issuer: v })} placeholder="Coursera" />
                      <Field label="Year" value={e.year} onChange={(v) => updateEntry("certifications", e.id, { year: v })} placeholder="2024" />
                    </div>
                  </EntryCard>
                ))}
              </Section>

              <Section title="Languages">
                <Field label="Languages" value={cv.languages} onChange={(v) => setField("languages", v)} placeholder="English (Fluent), Urdu (Native)" />
              </Section>
            </div>

            {/* =========================== PREVIEW =========================== */}
            <div className="min-w-0 @4xl:sticky @4xl:top-24 @4xl:max-h-[calc(100vh-7rem)] @4xl:self-start @4xl:overflow-y-auto">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Live preview — {TEMPLATES.find((t) => t.id === cv.template)?.label}</p>
              <CvPreview cv={cv} />
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
              title="My CV"
              text="Made with the free CV Maker on SnapGrab"
              getFiles={async () => {
                const bytes = await buildCvPdf(cv);
                return [new File([bytes as BlobPart], `${slugify(cv.personal.name) || "my"}-cv.pdf`, { type: "application/pdf" })];
              }}
            />
            <button
              type="button"
              onClick={loadSample}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60"
            >
              <Sparkles className="h-[18px] w-[18px] text-brand-400" /> Load sample CV
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              <Eraser className="h-[18px] w-[18px]" /> Clear all
            </button>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-400" />
            <span>
              Your CV never leaves this browser — the draft auto-saves locally{savedAt ? ` (last saved ${savedAt})` : ""}. The PDF is a
              single-column, text-based layout that applicant tracking systems can read. Standard PDF fonts are used, so Urdu script and
              emoji are replaced.
            </span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * live preview — mirrors the chosen template
 * ------------------------------------------------------------------ */

/** Preview typography per template — mirrors PDF_LOOKS. */
const PREVIEW_LOOKS: Record<
  Template,
  { root: string; pad: string; heading: string; entry: string; font: string; sub: string; right: string }
> = {
  classic: {
    root: "text-[10.5px] leading-snug sm:text-[11px]",
    pad: "px-6 pb-6 pt-1",
    heading: "mb-1.5 mt-3.5 border-b pb-0.5 text-[11px] font-bold uppercase tracking-wider sm:text-xs",
    entry: "mt-1.5",
    font: "Helvetica, Arial, sans-serif",
    sub: "text-zinc-600",
    right: "text-[10px] text-zinc-500",
  },
  modern: {
    root: "text-[10.5px] leading-snug sm:text-[11px]",
    pad: "px-6 pb-6 pt-1",
    heading: "mb-1.5 mt-3.5 border-b pb-0.5 text-[11px] font-bold uppercase tracking-wider sm:text-xs",
    entry: "mt-1.5",
    font: "Helvetica, Arial, sans-serif",
    sub: "text-zinc-600",
    right: "text-[10px] text-zinc-500",
  },
  compact: {
    root: "text-[9.5px] leading-[1.3] sm:text-[10px]",
    pad: "px-5 pb-5 pt-0.5",
    heading: "mb-1 mt-2.5 border-b pb-px text-[10px] font-bold uppercase tracking-wider sm:text-[10.5px]",
    entry: "mt-1",
    font: "Helvetica, Arial, sans-serif",
    sub: "text-zinc-600",
    right: "text-[9px] text-zinc-500",
  },
  professional: {
    root: "text-[11px] leading-snug sm:text-[11.5px]",
    pad: "px-7 pb-7 pt-1",
    heading: "mb-1.5 mt-4 border-b-[0.5px] pb-0.5 text-[11.5px] font-bold uppercase tracking-[0.12em] sm:text-[12px]",
    entry: "mt-2",
    font: '"Times New Roman", Times, Georgia, serif',
    sub: "italic text-zinc-600",
    right: "text-[10.5px] italic text-zinc-500",
  },
};

function CvPreview({ cv }: { cv: Cv }) {
  const tpl = cv.template;
  const look = PREVIEW_LOOKS[tpl] ?? PREVIEW_LOOKS.classic;
  const modern = tpl === "modern";
  const coloured = tpl !== "classic";
  const accent = safeAccent(cv.accent);
  const onAccent = isLight(accent) ? "#141418" : "#ffffff";
  const p = cv.personal;
  const contacts = joinParts([p.email, p.phone, p.location, p.linkedin, p.website], "  |  ");
  const headColor = coloured ? (isLight(accent) ? "#141418" : accent) : "#000000";
  const ruleColor = coloured ? accent : "#000000";

  const experience = cv.experience.filter((e) => e.title.trim() || e.company.trim() || e.bullets.trim());
  const education = cv.education.filter((e) => e.degree.trim() || e.institute.trim());
  const projects = cv.projects.filter((e) => e.name.trim() || e.bullets.trim());
  const certs = cv.certifications.filter((c) => c.name.trim());
  const skills = useMemo(() => skillLines(cv.skills), [cv.skills]);

  const empty =
    !p.name.trim() && !cv.summary.trim() && !experience.length && !education.length && !skills.length && !projects.length && !certs.length;

  const entryLook = { look, bulletColor: headColor };

  return (
    <div className={`overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-xl ${look.root}`} style={{ fontFamily: look.font }}>
      {modern ? (
        <div className="px-6 pb-4 pt-5" style={{ backgroundColor: accent, color: onAccent }}>
          <p className="break-words text-xl font-bold sm:text-2xl">{p.name || "Your Name"}</p>
          {p.headline && <p className="mt-0.5 break-words text-xs sm:text-sm">{p.headline}</p>}
          {contacts && <p className="mt-1.5 break-words text-[10px]">{contacts}</p>}
        </div>
      ) : tpl === "compact" ? (
        <div className="mx-5 border-b-[1.5px] pb-1.5 pt-4" style={{ borderColor: ruleColor }}>
          <p className="break-words text-lg font-bold leading-tight sm:text-xl">{p.name || "Your Name"}</p>
          {p.headline && (
            <p className="break-words text-[10.5px] font-semibold sm:text-[11px]" style={{ color: headColor }}>
              {p.headline}
            </p>
          )}
          {contacts && <p className="mt-0.5 break-words text-[9px] text-zinc-700">{contacts}</p>}
        </div>
      ) : tpl === "professional" ? (
        <div className="mx-7 border-b-[3px] border-double pb-2.5 pt-6 text-center" style={{ borderColor: ruleColor }}>
          <p className="break-words text-2xl font-bold sm:text-[28px] sm:leading-tight">{p.name || "Your Name"}</p>
          {p.headline && <p className="mt-0.5 break-words text-xs italic text-zinc-700 sm:text-sm">{p.headline}</p>}
          {contacts && <p className="mt-1 break-words text-[10.5px] text-zinc-700">{contacts}</p>}
        </div>
      ) : (
        <div className="mx-6 border-b-2 border-black pb-2.5 pt-5 text-center">
          <p className="break-words text-xl font-bold sm:text-2xl">{p.name || "Your Name"}</p>
          {p.headline && <p className="mt-0.5 break-words text-xs text-zinc-700 sm:text-sm">{p.headline}</p>}
          {contacts && <p className="mt-1 break-words text-[10px] text-zinc-700">{contacts}</p>}
        </div>
      )}

      <div className={look.pad}>
        {empty && <p className="mt-4 text-center text-zinc-400">Start filling in the form — or load the sample CV — to see your resume here.</p>}

        {cv.summary.trim() && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Summary</PreviewHeading>
            <p className="whitespace-pre-line break-words">{cv.summary}</p>
          </>
        )}

        {experience.length > 0 && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Experience</PreviewHeading>
            {experience.map((e) => (
              <PreviewEntry
                key={e.id}
                {...entryLook}
                title={e.title}
                right={dateRange(e.start, e.end, e.current)}
                sub={joinParts([e.company, e.location])}
                bullets={bulletsOf(e.bullets)}
              />
            ))}
          </>
        )}

        {education.length > 0 && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Education</PreviewHeading>
            {education.map((e) => (
              <PreviewEntry
                key={e.id}
                {...entryLook}
                title={e.degree}
                right={dateRange(e.start, e.end)}
                sub={joinParts([joinParts([e.institute, e.location], ", "), e.grade])}
              />
            ))}
          </>
        )}

        {projects.length > 0 && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Projects</PreviewHeading>
            {projects.map((e) => (
              <PreviewEntry
                key={e.id}
                {...entryLook}
                title={e.name}
                sub={joinParts([e.tech ? `Tech: ${e.tech}` : "", e.link], "  |  ")}
                bullets={bulletsOf(e.bullets)}
              />
            ))}
          </>
        )}

        {skills.length > 0 && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Skills</PreviewHeading>
            {tpl === "compact" ? (
              <p className="break-words">{compactSkills(skills)}</p>
            ) : (
              skills.map((s, i) => (
                <p key={i} className="break-words">
                  {s.group && <span className="font-bold">{s.group}: </span>}
                  {s.items}
                </p>
              ))
            )}
          </>
        )}

        {certs.length > 0 && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Certifications</PreviewHeading>
            {certs.map((c) =>
              tpl === "compact" ? (
                <PreviewEntry key={c.id} {...entryLook} title={joinParts([c.name, c.issuer], " — ")} right={c.year} />
              ) : (
                <PreviewEntry key={c.id} {...entryLook} title={c.name} right={c.year} sub={c.issuer} />
              ),
            )}
          </>
        )}

        {cv.languages.trim() && (
          <>
            <PreviewHeading look={look} color={headColor} rule={ruleColor}>Languages</PreviewHeading>
            <p className="break-words">{cv.languages}</p>
          </>
        )}
      </div>
    </div>
  );
}

type PreviewLook = (typeof PREVIEW_LOOKS)[Template];

function PreviewHeading({ look, color, rule, children }: { look: PreviewLook; color: string; rule: string; children: ReactNode }) {
  return (
    <h3 className={look.heading} style={{ color, borderColor: rule }}>
      {children}
    </h3>
  );
}

function PreviewEntry({
  look,
  title,
  right,
  sub,
  bullets,
  bulletColor,
}: {
  look: PreviewLook;
  title: string;
  right?: string;
  sub?: string;
  bullets?: string[];
  bulletColor: string;
}) {
  return (
    <div className={look.entry}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 break-words font-bold">{title}</p>
        {right && <p className={`shrink-0 ${look.right}`}>{right}</p>}
      </div>
      {sub && <p className={`break-words ${look.sub}`}>{sub}</p>}
      {bullets && bullets.length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-1.5 break-words">
              <span style={{ color: bulletColor }}>•</span>
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
