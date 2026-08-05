"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Download,
  ImageIcon,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  Trash2,
  Unlock,
  UploadCloud,
} from "lucide-react";
import type { Tool } from "@/lib/tools";

type OutputMime = "image/jpeg" | "image/png" | "image/webp";

type Job = {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  status: "ready" | "working" | "done" | "error";
  outUrl?: string;
  outSize?: number;
  outName?: string;
  label?: string;
  error?: string;
};

const FAVICON_SIZES = [16, 32, 48, 96, 180, 192, 512];

const LABELS: Record<OutputMime, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

const EXT: Record<OutputMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function formatBytes(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

/** Decodes a file into a bitmap, with a plain <img> fallback for browsers/formats createImageBitmap refuses. */
async function decode(file: File): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ bitmap: img, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("This file is not an image your browser can open."));
      };
      img.src = url;
    });
  }
}

export default function ImageStudio({ tool }: { tool: Tool }) {
  const mode = tool.mode ?? "convert";
  const fixedOutput = (tool.output ?? null) as OutputMime | null;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [output, setOutput] = useState<OutputMime>(fixedOutput ?? (mode === "compress" ? "image/jpeg" : "image/webp"));
  const [quality, setQuality] = useState(mode === "compress" ? 75 : 90);
  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [lockRatio, setLockRatio] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dataUri, setDataUri] = useState("");
  const [copied, setCopied] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const target = fixedOutput ?? output;
  const lossy = target !== "image/png";

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name));
    if (!files.length) return;

    const next: Job[] = [];
    for (const file of files) {
      try {
        const { width: w, height: h } = await decode(file);
        next.push({
          id: `${file.name}-${file.size}-${next.length}-${jobsIdCounter++}`,
          file,
          previewUrl: URL.createObjectURL(file),
          width: w,
          height: h,
          status: "ready",
        });
      } catch {
        next.push({
          id: `err-${jobsIdCounter++}`,
          file,
          previewUrl: "",
          width: 0,
          height: 0,
          status: "error",
          error: "Could not read this file.",
        });
      }
    }
    setJobs((prev) => [...prev, ...next]);

    // seed the resize fields from the first image so the form is never empty
    const first = next.find((j) => j.width > 0);
    if (first) {
      setWidth((w) => (w === "" ? first.width : w));
      setHeight((h) => (h === "" ? first.height : h));
    }
  }, []);

  function onWidthChange(v: string) {
    const n = v === "" ? "" : Math.max(1, Math.min(20000, Number(v) || 0));
    setWidth(n);
    if (lockRatio && n !== "" && jobs[0]?.width) {
      setHeight(Math.round((n / jobs[0].width) * jobs[0].height));
    }
  }

  function onHeightChange(v: string) {
    const n = v === "" ? "" : Math.max(1, Math.min(20000, Number(v) || 0));
    setHeight(n);
    if (lockRatio && n !== "" && jobs[0]?.height) {
      setWidth(Math.round((n / jobs[0].height) * jobs[0].width));
    }
  }

  async function processOne(job: Job): Promise<Job> {
    const { bitmap, width: sw, height: sh } = await decode(job.file);

    let dw = sw;
    let dh = sh;
    if (mode === "resize") {
      if (width !== "" && height !== "") {
        dw = Number(width);
        dh = Number(height);
      } else if (width !== "") {
        dw = Number(width);
        dh = Math.round((dw / sw) * sh);
      } else if (height !== "") {
        dh = Number(height);
        dw = Math.round((dh / sh) * sw);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");

    // JPG has no alpha — flatten onto white instead of producing black boxes
    if (target === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dw, dh);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, dw, dh);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, target, lossy ? quality / 100 : undefined),
    );
    if (!blob) throw new Error("Your browser could not encode that format.");

    const base = job.file.name.replace(/\.[^.]+$/, "") || "image";
    return {
      ...job,
      status: "done",
      outUrl: URL.createObjectURL(blob),
      outSize: blob.size,
      outName: `${base}-snapgrab.${EXT[target]}`,
      width: dw,
      height: dh,
    };
  }

  async function runFavicon() {
    const source = jobs.find((j) => j.status !== "error");
    if (!source) return [] as Job[];
    const { bitmap } = await decode(source.file);
    const produced: Job[] = [];

    for (const size of FAVICON_SIZES) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // letterbox rather than stretch a non-square source
      const src = bitmap as CanvasImageSource & { width: number; height: number };
      const scale = Math.min(size / src.width, size / src.height);
      const w = src.width * scale;
      const h = src.height * scale;
      ctx.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) continue;
      produced.push({
        id: `fav-${size}`,
        file: source.file,
        previewUrl: source.previewUrl,
        width: size,
        height: size,
        status: "done",
        outUrl: URL.createObjectURL(blob),
        outSize: blob.size,
        outName: `favicon-${size}x${size}.png`,
        label: `${size}×${size}`,
      });
    }
    return produced;
  }

  async function runAll() {
    if (!jobs.length || busy) return;
    setBusy(true);

    if (mode === "to-base64") {
      const source = jobs.find((j) => j.status !== "error");
      if (source) {
        const uri = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("read failed"));
          fr.readAsDataURL(source.file);
        }).catch(() => "");
        setDataUri(uri);
        if (uri) {
          fetch("/api/tools/track", {
            method: "POST",
            headers: { "content-type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              tool: tool.slug,
              inputType: source.file.type || "image",
              outputType: "text/plain",
              files: 1,
              bytesIn: source.file.size,
              bytesOut: uri.length,
            }),
          }).catch(() => {});
        }
      }
      setBusy(false);
      return;
    }

    if (mode === "favicon") {
      const produced = await runFavicon();
      setJobs((prev) => [...prev.filter((j) => j.status === "error"), ...produced]);
      setBusy(false);
      if (produced.length) {
        fetch("/api/tools/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            tool: tool.slug,
            inputType: "image",
            outputType: "image/png",
            files: produced.length,
            bytesIn: produced[0]?.file.size,
            bytesOut: produced.reduce((n, j) => n + (j.outSize ?? 0), 0),
          }),
        }).catch(() => {});
      }
      return;
    }

    const pending = jobs.filter((j) => j.status !== "error");
    setJobs((prev) => prev.map((j) => (j.status === "error" ? j : { ...j, status: "working" })));

    const results: Job[] = [];
    for (const job of pending) {
      try {
        results.push(await processOne(job));
      } catch (err) {
        results.push({ ...job, status: "error", error: err instanceof Error ? err.message : "Conversion failed." });
      }
      setJobs((prev) => prev.map((j) => results.find((r) => r.id === j.id) ?? j));
    }

    setBusy(false);

    const done = results.filter((r) => r.status === "done");
    if (done.length) {
      fetch("/api/tools/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          tool: tool.slug,
          inputType: done[0].file.type || "image",
          outputType: target,
          files: done.length,
          bytesIn: done.reduce((n, j) => n + j.file.size, 0),
          bytesOut: done.reduce((n, j) => n + (j.outSize ?? 0), 0),
        }),
      }).catch(() => {});
    }
  }

  function downloadAll() {
    jobs
      .filter((j) => j.status === "done" && j.outUrl)
      .forEach((j, i) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = j.outUrl as string;
          a.download = j.outName as string;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, i * 250); // browsers throttle simultaneous downloads
      });
  }

  function removeJob(id: string) {
    setJobs((prev) => {
      const target = prev.find((j) => j.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.outUrl) URL.revokeObjectURL(target.outUrl);
      return prev.filter((j) => j.id !== id);
    });
  }

  function reset() {
    jobs.forEach((j) => {
      if (j.previewUrl) URL.revokeObjectURL(j.previewUrl);
      if (j.outUrl) URL.revokeObjectURL(j.outUrl);
    });
    setJobs([]);
  }

  const doneJobs = jobs.filter((j) => j.status === "done");
  const totalIn = doneJobs.reduce((n, j) => n + j.file.size, 0);
  const totalOut = doneJobs.reduce((n, j) => n + (j.outSize ?? 0), 0);
  const saved = totalIn > 0 ? Math.round(((totalIn - totalOut) / totalIn) * 100) : 0;

  return (
    <div className="scroll-mt-24" id="tool">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          {/* dropzone */}
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
            <p className="mt-4 font-bold">Drop images here, or tap to browse</p>
            <p className="mt-1 text-sm text-muted">
              {tool.inputs.join(" · ")} — processed in your browser, never uploaded
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={tool.accept}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* controls */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {!fixedOutput && mode !== "favicon" && mode !== "to-base64" && (
              <div>
                <label className="mb-2 block text-sm font-semibold">Output format</label>
                <div className="flex gap-2">
                  {(["image/webp", "image/jpeg", "image/png"] as OutputMime[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOutput(m)}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                        target === m
                          ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                          : "surface text-muted hover:text-[var(--fg)]"
                      }`}
                    >
                      {LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lossy && mode !== "favicon" && mode !== "to-base64" && (
              <div>
                <label className="mb-2 flex items-center justify-between text-sm font-semibold">
                  Quality
                  <span className="font-mono text-brand-400">{quality}%</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-[var(--color-brand-500)]"
                />
                <p className="mt-1 text-xs text-muted">
                  {quality >= 90 ? "Near-original detail, larger file." : quality >= 70 ? "The sweet spot for most photos." : "Small files, visible artefacts in gradients."}
                </p>
              </div>
            )}

            {mode === "resize" && (
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold">Dimensions (pixels)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={width}
                    onChange={(e) => onWidthChange(e.target.value)}
                    placeholder="Width"
                    aria-label="Width in pixels"
                    className="w-28 rounded-xl surface px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  />
                  <button
                    type="button"
                    onClick={() => setLockRatio((v) => !v)}
                    aria-label={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                      lockRatio ? "bg-brand-500/15 text-brand-400" : "surface text-muted"
                    }`}
                  >
                    {lockRatio ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={height}
                    onChange={(e) => onHeightChange(e.target.value)}
                    placeholder="Height"
                    aria-label="Height in pixels"
                    className="w-28 rounded-xl surface px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  />
                  <span className="text-xs text-muted">
                    {lockRatio ? "Aspect ratio locked" : "Free — the image may stretch"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={runAll}
              disabled={!jobs.length || busy}
              whileHover={{ scale: jobs.length && !busy ? 1.02 : 1 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:flex-none sm:min-w-[200px]"
            >
              {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
              {busy
                ? "Working…"
                : mode === "compress"
                  ? "Compress images"
                  : mode === "resize"
                    ? "Resize images"
                    : mode === "favicon"
                      ? "Generate favicons"
                      : mode === "to-base64"
                        ? "Encode to Base64"
                        : `Convert to ${LABELS[target]}`}
            </motion.button>

            {doneJobs.length > 1 && (
              <button
                type="button"
                onClick={downloadAll}
                className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60"
              >
                <Download className="h-[18px] w-[18px]" /> Download all ({doneJobs.length})
              </button>
            )}

            {jobs.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                <RotateCcw className="h-[18px] w-[18px]" /> Clear
              </button>
            )}
          </div>

          {dataUri && mode === "to-base64" && (
            <div className="mt-5 space-y-3">
              {[
                { label: "Data URI", value: dataUri },
                { label: "CSS", value: `background-image: url("${dataUri}");` },
                { label: "HTML", value: `<img src="${dataUri}" alt="" />` },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(row.value);
                        } catch {
                          const ta = document.createElement("textarea");
                          ta.value = row.value;
                          document.body.appendChild(ta);
                          ta.select();
                          try { document.execCommand("copy"); } catch {}
                          ta.remove();
                        }
                        setCopied(row.label);
                        setTimeout(() => setCopied(""), 1600);
                      }}
                      className="rounded-lg surface px-3 py-1.5 text-xs font-bold transition-colors hover:border-brand-400/60"
                    >
                      {copied === row.label ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="max-h-32 overflow-auto rounded-xl surface p-3 font-mono text-[11px] leading-relaxed">
                    <code className="break-all whitespace-pre-wrap">{row.value}</code>
                  </pre>
                </div>
              ))}
              <p className="text-xs text-muted">
                {formatBytes(jobs[0]?.file.size ?? 0)} source → {formatBytes(dataUri.length)} encoded (Base64 adds ~33%).
              </p>
            </div>
          )}

          {doneJobs.length > 0 && totalIn > 0 && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-2.5 text-sm text-accent-400"
            >
              {formatBytes(totalIn)} → {formatBytes(totalOut)}
              {saved > 0 ? ` · ${saved}% smaller` : saved < 0 ? ` · ${Math.abs(saved)}% larger` : " · same size"}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* queue */}
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-3"
          >
            {jobs.map((job, i) => (
              <motion.li
                key={job.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="flex flex-wrap items-center gap-4 rounded-2xl surface p-3 sm:p-4"
              >
                <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--bg-soft)]">
                  {job.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.outUrl ?? job.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {job.label ? `${job.label} — ` : ""}
                    {job.outName ?? job.file.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span>{formatBytes(job.file.size)}</span>
                    {job.status === "done" && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-semibold text-accent-400">{formatBytes(job.outSize ?? 0)}</span>
                      </>
                    )}
                    {job.width > 0 && <span>· {job.width}×{job.height}</span>}
                  </span>
                  {job.error && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3 w-3" /> {job.error}
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-2">
                  {job.status === "working" && <Loader2 className="h-4 w-4 animate-spin text-brand-400" />}
                  {job.status === "done" && job.outUrl && (
                    <a
                      href={job.outUrl}
                      download={job.outName}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-bold text-white"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Save</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => removeJob(job.id)}
                    aria-label="Remove"
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

let jobsIdCounter = 0;
