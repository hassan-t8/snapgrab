"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Tool } from "@/lib/tools";
import { trackEvent } from "@/lib/track-event";
import { formatBytes } from "./ImageStudio";

type Item = {
  id: string;
  file: File;
  pages?: number;
  error?: string;
};

type Output = { name: string; url: string; size: number };

let counter = 0;

export default function PdfStudio({ tool }: { tool: Tool }) {
  const mode = tool.mode ?? "merge";
  const wantsImages = mode === "images-to-pdf";

  const [items, setItems] = useState<Item[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [range, setRange] = useState("");
  const [splitAll, setSplitAll] = useState(false);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [numPos, setNumPos] = useState<"bottom-center" | "bottom-right" | "bottom-left" | "top-right">("bottom-center");
  const [numFormat, setNumFormat] = useState<"n" | "page-n" | "n-of-total">("n");
  const [startAt, setStartAt] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | File[]) {
    const wanted = Array.from(list).filter((f) =>
      wantsImages ? /^image\/(jpeg|png)$/.test(f.type) : f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    if (!wanted.length) {
      setError(wantsImages ? "Please add JPG or PNG images." : "Please add PDF files.");
      return;
    }
    setError(null);

    const next: Item[] = [];
    for (const file of wanted) {
      const item: Item = { id: `i${counter++}`, file };
      if (!wantsImages) {
        try {
          const { PDFDocument } = await import("pdf-lib");
          const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
          item.pages = doc.getPageCount();
        } catch {
          item.error = "Could not read this PDF — it may be password protected.";
        }
      }
      next.push(item);
    }
    setItems((prev) => (mode === "merge" || wantsImages ? [...prev, ...next] : next.slice(0, 1)));
    if (mode === "split" && next[0]?.pages && !range) setRange(`1-${next[0].pages}`);
  }

  function parseRange(text: string, max: number): number[] {
    const m = text.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) throw new Error('Use a range like "2-5" or a single page number.');
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) throw new Error("That range does not make sense.");
    if (to > max) throw new Error(`This document only has ${max} page${max === 1 ? "" : "s"}.`);
    return Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  }

  function publish(name: string, bytes: Uint8Array): Output {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    return { name, url: URL.createObjectURL(blob), size: blob.size };
  }

  async function run() {
    if (!items.length || busy) return;
    setBusy(true);
    setError(null);
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    setOutputs([]);

    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const produced: Output[] = [];

      if (wantsImages) {
        const doc = await PDFDocument.create();
        for (const item of items) {
          const bytes = new Uint8Array(await item.file.arrayBuffer());
          const img =
            item.file.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const page = doc.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        produced.push(publish("snapgrab-images.pdf", await doc.save()));
      }

      if (mode === "merge") {
        if (items.length < 2) throw new Error("Add at least two PDFs to merge.");
        const out = await PDFDocument.create();
        for (const item of items) {
          const src = await PDFDocument.load(await item.file.arrayBuffer());
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        }
        produced.push(publish("snapgrab-merged.pdf", await out.save()));
      }

      if (mode === "split") {
        const item = items[0];
        const src = await PDFDocument.load(await item.file.arrayBuffer());
        const total = src.getPageCount();
        const base = item.file.name.replace(/\.pdf$/i, "");

        if (splitAll) {
          for (let i = 0; i < total; i++) {
            const out = await PDFDocument.create();
            const [page] = await out.copyPages(src, [i]);
            out.addPage(page);
            produced.push(publish(`${base}-page-${i + 1}.pdf`, await out.save()));
          }
        } else {
          const indices = parseRange(range, total);
          const out = await PDFDocument.create();
          const pages = await out.copyPages(src, indices);
          pages.forEach((p) => out.addPage(p));
          produced.push(publish(`${base}-pages-${range.trim()}.pdf`, await out.save()));
        }
      }

      if (mode === "page-numbers") {
        const { StandardFonts, rgb } = await import("pdf-lib");
        const item = items[0];
        const doc = await PDFDocument.load(await item.file.arrayBuffer());
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        const first = Math.max(0, Math.floor(Number(startAt)) || 1);
        const last = first + pages.length - 1;
        const size = 11;
        pages.forEach((page, i) => {
          const n = first + i;
          const label = numFormat === "page-n" ? `Page ${n}` : numFormat === "n-of-total" ? `${n} of ${last}` : String(n);
          const { width, height } = page.getSize();
          const w = font.widthOfTextAtSize(label, size);
          const margin = 28;
          const x = numPos === "bottom-left" ? margin : numPos === "bottom-center" ? (width - w) / 2 : width - margin - w;
          const y = numPos === "top-right" ? height - margin : margin - size / 2;
          page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
        });
        produced.push(publish(item.file.name.replace(/\.pdf$/i, "") + "-numbered.pdf", await doc.save()));
      }

      if (mode === "rotate") {
        const item = items[0];
        const doc = await PDFDocument.load(await item.file.arrayBuffer());
        doc.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + angle) % 360)));
        produced.push(publish(item.file.name.replace(/\.pdf$/i, "") + `-rotated-${angle}.pdf`, await doc.save()));
      }

      setOutputs(produced);

      fetch("/api/tools/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          tool: tool.slug,
          inputType: wantsImages ? "image" : "application/pdf",
          outputType: "application/pdf",
          files: items.length,
          bytesIn: items.reduce((n, i) => n + i.file.size, 0),
          bytesOut: produced.reduce((n, o) => n + o.size, 0),
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong with that document.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    outputs.forEach((o) => URL.revokeObjectURL(o.url));
    setItems([]);
    setOutputs([]);
    setError(null);
    setRange("");
  }

  const single = mode === "split" || mode === "rotate" || mode === "page-numbers";
  const totalPages = items[0]?.pages;

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
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
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${
              dragging ? "border-brand-400 bg-brand-500/10" : "border-[var(--line)] hover:border-brand-400/60"
            }`}
          >
            <motion.span
              animate={dragging ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
            >
              <UploadCloud className="h-6 w-6" />
            </motion.span>
            <p className="mt-4 font-bold">
              {wantsImages ? "Drop JPG or PNG images" : single ? "Drop a PDF file" : "Drop your PDF files"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {single ? "One document at a time" : "Added in the order you queue them"} — processed in your browser
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={tool.accept}
              multiple={!single}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {mode === "split" && items.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">
                  Page range {totalPages ? <span className="font-normal text-muted">(1–{totalPages})</span> : null}
                </span>
                <input
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  disabled={splitAll}
                  placeholder="2-5"
                  className="w-full rounded-xl surface px-4 py-2.5 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-xl bg-[var(--bg-soft)] px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">Split every page</span>
                  <span className="block text-xs text-muted">One PDF per page</span>
                </span>
                <input
                  type="checkbox"
                  checked={splitAll}
                  onChange={(e) => setSplitAll(e.target.checked)}
                  className="h-5 w-5 accent-[var(--color-brand-500)]"
                />
              </label>
            </div>
          )}

          {mode === "rotate" && (
            <div className="mt-5">
              <span className="mb-2 block text-sm font-semibold">Rotation</span>
              <div className="flex gap-2">
                {([90, 180, 270] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAngle(a)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                      angle === a
                        ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                        : "surface text-muted hover:text-[var(--fg)]"
                    }`}
                  >
                    <RotateCw className="h-4 w-4" style={{ transform: `rotate(${a}deg)` }} />
                    {a}°
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "page-numbers" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Position</span>
                <select
                  value={numPos}
                  onChange={(e) => setNumPos(e.target.value as typeof numPos)}
                  className="w-full rounded-xl surface px-4 py-2.5 text-sm outline-none focus:border-brand-400"
                >
                  <option value="bottom-center">Bottom centre</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-right">Top right</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Format</span>
                <select
                  value={numFormat}
                  onChange={(e) => setNumFormat(e.target.value as typeof numFormat)}
                  className="w-full rounded-xl surface px-4 py-2.5 text-sm outline-none focus:border-brand-400"
                >
                  <option value="n">1, 2, 3</option>
                  <option value="page-n">Page 1, Page 2</option>
                  <option value="n-of-total">1 of 10</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Start at</span>
                <input
                  inputMode="numeric"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full rounded-xl surface px-4 py-2.5 text-sm outline-none focus:border-brand-400"
                />
              </label>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={run}
              disabled={!items.length || busy}
              whileHover={{ scale: items.length && !busy ? 1.02 : 1 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:flex-none sm:min-w-[210px]"
            >
              {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
              {busy
                ? "Working…"
                : mode === "merge"
                  ? "Merge PDFs"
                  : mode === "split"
                    ? "Split PDF"
                    : mode === "rotate"
                      ? `Rotate ${angle}°`
                      : mode === "page-numbers"
                        ? "Add page numbers"
                        : "Create PDF"}
            </motion.button>

            {items.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                <Trash2 className="h-[18px] w-[18px]" /> Clear
              </button>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </motion.p>
          )}

          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent-400" />
            Documents are processed locally with pdf-lib — nothing is uploaded.
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {items.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-2">
            {items.map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="flex items-center gap-3 rounded-2xl surface p-3 sm:p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-400">
                  {wantsImages ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.file.name}</span>
                  <span className="block text-xs text-muted">
                    {formatBytes(item.file.size)}
                    {item.pages ? ` · ${item.pages} page${item.pages === 1 ? "" : "s"}` : ""}
                  </span>
                  {item.error && <span className="mt-0.5 block text-xs text-red-400">{item.error}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                  aria-label="Remove"
                  className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {outputs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl surface p-4">
            <p className="mb-3 text-sm font-bold">
              {outputs.length} file{outputs.length === 1 ? "" : "s"} ready
            </p>
            <div className="space-y-2">
              {outputs.map((o) => (
                <div key={o.name} className="flex items-center gap-3 rounded-xl bg-[var(--bg-soft)] p-3">
                  <FileText className="h-5 w-5 shrink-0 text-accent-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{o.name}</span>
                    <span className="block text-xs text-muted">{formatBytes(o.size)}</span>
                  </span>
                  <a
                    href={o.url}
                    download={o.name}
                    onClick={() => trackEvent("download")}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-bold text-white"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Save</span>
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
