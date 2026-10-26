"use client";

import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Cpu,
  Download,
  Film,
  Info,
  Loader2,
  Music,
  Play,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  VolumeX,
  X,
} from "lucide-react";
import type { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet, { blobToFile } from "@/components/ShareSheet";
import { formatBytes } from "./ImageStudio";

/* ------------------------------------------------------------------ *
 * engine & constants
 * ------------------------------------------------------------------ */

/**
 * Single-thread ffmpeg core: runs without SharedArrayBuffer, so the site does not need
 * COOP/COEP headers (which would break AdSense and other cross-origin embeds).
 * Pinned — the wasm size below must match this version.
 */
const CORE_VERSION = "0.12.10";
const CORE_MIRRORS = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];
/** decompressed size of ffmpeg-core.wasm for CORE_VERSION — CDNs send it compressed, so content-length is useless */
const WASM_BYTES = 32_232_419;

/**
 * Our own copy of the @ffmpeg/ffmpeg worker, started from a blob: URL (`classWorkerURL`).
 * The package's worker is referenced as `new URL("./worker.js", import.meta.url)`, which the
 * bundler copies as a loose asset without its imports, so it cannot start. This speaks the same
 * message protocol for the calls we use.
 */
const WORKER_SOURCE = `
let ffmpeg;
self.onmessage = async ({ data: { id, type, data } }) => {
  const trans = [];
  let out;
  try {
    if (type !== "LOAD" && !ffmpeg) throw new Error("ffmpeg is not loaded");
    switch (type) {
      case "LOAD": {
        const first = !ffmpeg;
        const { coreURL, wasmURL } = data;
        const create = (await import(coreURL)).default;
        ffmpeg = await create({ mainScriptUrlOrBlob: coreURL + "#" + btoa(JSON.stringify({ wasmURL, workerURL: "" })) });
        ffmpeg.setLogger((d) => self.postMessage({ type: "LOG", data: d }));
        ffmpeg.setProgress((d) => self.postMessage({ type: "PROGRESS", data: d }));
        out = first;
        break;
      }
      case "EXEC":
        ffmpeg.setTimeout(data.timeout ?? -1);
        ffmpeg.exec(...data.args);
        out = ffmpeg.ret;
        ffmpeg.reset();
        break;
      case "WRITE_FILE":
        ffmpeg.FS.writeFile(data.path, data.data);
        out = true;
        break;
      case "READ_FILE":
        out = ffmpeg.FS.readFile(data.path, { encoding: data.encoding });
        break;
      case "DELETE_FILE":
        ffmpeg.FS.unlink(data.path);
        out = true;
        break;
      case "CREATE_DIR":
        ffmpeg.FS.mkdir(data.path);
        out = true;
        break;
      case "MOUNT": {
        const fs = ffmpeg.FS.filesystems[data.fsType];
        if (!fs) { out = false; break; }
        ffmpeg.FS.mount(fs, data.options, data.mountPoint);
        out = true;
        break;
      }
      case "UNMOUNT":
        ffmpeg.FS.unmount(data.mountPoint);
        out = true;
        break;
      default:
        throw new Error("unknown message type " + type);
    }
  } catch (e) {
    self.postMessage({ id, type: "ERROR", data: String(e) });
    return;
  }
  if (out instanceof Uint8Array) trans.push(out.buffer);
  self.postMessage({ id, type, data: out }, trans);
};
`;

const SOFT_LIMIT = 500 * 1024 * 1024;
const HARD_LIMIT = 2 * 1024 * 1024 * 1024;
const GIF_MAX = 15;

type Mode = "video-trim" | "video-compress" | "video-to-gif" | "mute-video" | "extract-audio";
type Phase = "idle" | "ready" | "engine" | "working" | "done";
type Source = { file: File; url: string; ext: string };
type Meta = { duration: number | null; width: number; height: number };
type Probe = {
  duration: number | null;
  width: number;
  height: number;
  fps: number;
  video: string | null;
  audio: string | null;
};
type Result = { blob: Blob; url: string; name: string; kind: "video" | "gif" | "audio"; note?: string };
type Job = {
  args: string[];
  out: string;
  mime: string;
  name: string;
  kind: Result["kind"];
  total: number;
  note?: string;
  /** tried when the first command fails (e.g. stream copy into a container that refuses the codec) */
  fallback?: Omit<Job, "fallback" | "total">;
};

type Preset = "small" | "balanced" | "high";
/** x264 in single-thread wasm encodes roughly 0.3–1× real time on a laptop, so lean on the faster presets */
const PRESETS: Record<Preset, { label: string; hint: string; res: number; crf: number; audio: number; bpp: number; speed: string }> = {
  small: { label: "Small", hint: "480p · for chats", res: 480, crf: 30, audio: 64, bpp: 0.045, speed: "superfast" },
  balanced: { label: "Balanced", hint: "720p · most uses", res: 720, crf: 27, audio: 96, bpp: 0.06, speed: "superfast" },
  high: { label: "High", hint: "1080p · keep detail", res: 1080, crf: 23, audio: 128, bpp: 0.085, speed: "veryfast" },
};
const RESOLUTIONS = [0, 1080, 720, 480] as const;

const GIF_WIDTHS = [240, 320, 480, 640] as const;
const GIF_FPS = [8, 10, 12, 15, 20] as const;
const MP3_RATES = [128, 192, 320] as const;

/** containers we can stream-copy into as-is */
const COPY_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "3gp", "avi", "ts"]);
const MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  ts: "video/mp2t",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

const COPY: Record<Mode, { cta: string; working: string; done: string; icon: typeof Film }> = {
  "video-trim": { cta: "Cut video", working: "Cutting video…", done: "Video trimmed", icon: Scissors },
  "video-compress": { cta: "Compress video", working: "Compressing video…", done: "Video compressed", icon: Sparkles },
  "video-to-gif": { cta: "Create GIF", working: "Creating GIF…", done: "GIF created", icon: Film },
  "mute-video": { cta: "Remove audio", working: "Removing audio…", done: "Audio removed", icon: VolumeX },
  "extract-audio": { cta: "Extract audio", working: "Extracting audio…", done: "Audio extracted", icon: Music },
};

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sec = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);
const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);

function fmtTime(t: number, precise = false) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = precise ? s.toFixed(1).padStart(4, "0") : String(Math.floor(s)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function fmtDuration(t: number) {
  if (t < 60) return `${Math.max(1, Math.round(t))} s`;
  const m = Math.floor(t / 60);
  const s = Math.round(t % 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}

function extOf(name: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : "mp4";
}

function baseName(name: string) {
  return (name.replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "").trim() || "video").slice(0, 60);
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

/** fetches a file into a blob: URL, reporting decompressed bytes as they arrive */
async function fetchToBlobURL(url: string, type: string, onBytes?: (n: number) => void) {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  if (!onBytes || !res.body) return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(got);
  }
  return URL.createObjectURL(new Blob(chunks, { type }));
}

/** downloads the ffmpeg core (≈32 MB wasm, ≈9 MB over the wire), trying a second CDN if the first fails */
async function downloadCore(onPct: (pct: number) => void) {
  let lastErr: unknown;
  for (const base of CORE_MIRRORS) {
    try {
      const { toBlobURL } = await import("@ffmpeg/util");
      const [core, wasm] = await Promise.all([
        toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        fetchToBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm", (n) =>
          onPct(Math.min(99, Math.round((n / Math.max(WASM_BYTES, n)) * 100))),
        ),
      ]);
      const worker = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      return { core, wasm, worker };
    } catch (err) {
      lastErr = err;
      onPct(0);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("The video engine could not be downloaded.");
}

function parseProbe(text: string): Probe {
  const p: Probe = { duration: null, width: 0, height: 0, fps: 0, video: null, audio: null };
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  if (d) p.duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
  for (const line of text.split("\n")) {
    if (!/Stream #\d+:\d+/.test(line)) continue;
    if (!p.video && /: Video: /.test(line) && !/attached pic/.test(line)) {
      p.video = /: Video: (\w+)/.exec(line)?.[1] ?? "video";
      const r = /\b(\d{2,5})x(\d{2,5})\b/.exec(line);
      if (r) {
        p.width = Number(r[1]);
        p.height = Number(r[2]);
      }
      const f = /([\d.]+) fps/.exec(line) ?? /([\d.]+) tbr/.exec(line);
      if (f) p.fps = Number(f[1]);
    } else if (!p.audio && /: Audio: /.test(line)) {
      p.audio = /: Audio: (\w+)/.exec(line)?.[1] ?? "audio";
    }
  }
  if (/rotation of -?90/.test(text)) [p.width, p.height] = [p.height, p.width];
  return p;
}

function friendlyError(log: string) {
  if (/matches no streams|does not contain any stream|Output file #0 does not contain/i.test(log))
    return "This video has no track of the kind this tool needs (for example, no audio).";
  if (/Invalid data found|could not find codec parameters|moov atom not found/i.test(log))
    return "This file could not be read as a video. It may be damaged or still downloading — try another copy.";
  if (/Cannot enlarge memory|out of memory|Aborted\(\)|memory access out of bounds/i.test(log))
    return "Your device ran out of memory for this video. Try a shorter clip, a smaller preset, or a computer.";
  if (/Unknown encoder|Encoder not found/i.test(log)) return "This conversion is not supported by the in-browser engine.";
  return "The video engine could not process this file. Try another video or a different setting.";
}

async function requestWakeLock() {
  try {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) return await navigator.wakeLock.request("screen");
  } catch {
    // not allowed (battery saver, background tab) — processing still works
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * small presentational pieces (module scope — never defined in render)
 * ------------------------------------------------------------------ */

const pillOn = "bg-brand-500/15 text-brand-400 ring-1 ring-brand-400";
const pillOff = "surface text-muted hover:text-[var(--fg)]";

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; hint?: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            className={`min-w-[64px] flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              value === o.value ? pillOn : pillOff
            }`}
          >
            {o.label}
            {o.hint && <span className="block font-normal opacity-75">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const thumb =
  "pointer-events-none absolute inset-x-0 top-0 h-8 w-full appearance-none bg-transparent outline-none " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-grab " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white " +
  "[&::-webkit-slider-thumb]:bg-[var(--color-brand-500)] [&::-webkit-slider-thumb]:shadow-md " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--color-brand-500)] " +
  "[&::-moz-range-track]:bg-transparent focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-brand-400/40";

/** two-handle range: start / end over the full clip */
function RangeTrack({
  duration,
  start,
  end,
  onStart,
  onEnd,
  disabled,
}: {
  duration: number;
  start: number;
  end: number;
  onStart: (v: number) => void;
  onEnd: (v: number) => void;
  disabled?: boolean;
}) {
  const step = duration > 600 ? 0.5 : duration > 60 ? 0.1 : 0.05;
  const a = (start / duration) * 100;
  const b = (end / duration) * 100;
  return (
    <div className="relative h-8 select-none">
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--bg-soft)] ring-1 ring-[var(--line)]" />
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
        style={{ left: `${a}%`, width: `${Math.max(0, b - a)}%` }}
      />
      <input
        type="range"
        aria-label="Start time"
        min={0}
        max={duration}
        step={step}
        value={start}
        disabled={disabled}
        onChange={(e) => onStart(Number(e.target.value))}
        className={`${thumb} ${a > 90 ? "z-20" : "z-10"}`}
      />
      <input
        type="range"
        aria-label="End time"
        min={0}
        max={duration}
        step={step}
        value={end}
        disabled={disabled}
        onChange={(e) => onEnd(Number(e.target.value))}
        className={`${thumb} z-10`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function VideoStudio({ tool }: { tool: Tool }) {
  const mode = (tool.mode ?? "video-compress") as Mode;
  const copy = COPY[mode] ?? COPY["video-compress"];

  const [src, setSrc] = useState<Source | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [previewOk, setPreviewOk] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [enginePct, setEnginePct] = useState(0);
  const [progress, setProgress] = useState<{ pct: number; eta: string }>({ pct: 0, eta: "" });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phone, setPhone] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  // mode settings
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [cut, setCut] = useState<"fast" | "precise">("fast");
  const [preset, setPreset] = useState<Preset>("balanced");
  const [res, setRes] = useState<number>(PRESETS.balanced.res);
  const [gif, setGif] = useState({ start: 0, dur: 5, fps: 12 as number, width: 480 as number });
  const [audioFmt, setAudioFmt] = useState<"mp3" | "m4a">("mp3");
  const [mp3Rate, setMp3Rate] = useState<number>(192);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const store = useRef<{
    ff: FFmpeg | null;
    loading: Promise<FFmpeg> | null;
    urls: { core: string; wasm: string; worker: string } | null;
    run: number;
    /** engine generation — bumped when the worker is terminated */
    gen: number;
    logs: string[];
    total: number;
    started: number;
    tick: number;
    fixDuration: boolean;
    previewEnd: number | null;
  }>({ ff: null, loading: null, urls: null, run: 0, gen: 0, logs: [], total: 0, started: 0, tick: 0, fixDuration: false, previewEnd: null });

  useEffect(() => {
    if (!src) return;
    const url = src.url;
    return () => URL.revokeObjectURL(url);
  }, [src]);

  useEffect(() => {
    if (!result) return;
    const url = result.url;
    return () => URL.revokeObjectURL(url);
  }, [result]);

  // stop the engine and free its memory when the tool is left
  useEffect(() => {
    const s = store.current;
    return () => {
      s.run++;
      s.gen++;
      s.ff?.terminate();
      s.ff = null;
      s.loading = null;
      if (s.urls) {
        URL.revokeObjectURL(s.urls.core);
        URL.revokeObjectURL(s.urls.wasm);
        URL.revokeObjectURL(s.urls.worker);
        s.urls = null;
      }
    };
  }, []);

  /* ------------------------------ engine ------------------------------- */

  function onEngineTime(t: number) {
    const s = store.current;
    if (!s.total || !(t >= 0)) return;
    const now = performance.now();
    if (now - s.tick < 150) return;
    s.tick = now;
    const pct = clamp(t / s.total, 0, 0.995);
    const elapsed = (now - s.started) / 1000;
    const eta = pct > 0.03 && elapsed > 2 ? fmtDuration((elapsed * (1 - pct)) / pct) : "";
    setProgress({ pct, eta });
  }

  function getEngine() {
    const s = store.current;
    if (s.ff) return Promise.resolve(s.ff);
    if (s.loading) return s.loading;
    const gen = ++s.gen;
    const p = (async () => {
      const [{ FFmpeg }, urls] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        s.urls ? Promise.resolve(s.urls) : downloadCore(setEnginePct),
      ]);
      s.urls = urls;
      setEnginePct(100);
      const ff = new FFmpeg();
      ff.on("log", ({ message }) => {
        s.logs.push(message);
        if (s.logs.length > 600) s.logs.splice(0, 200);
        const m = /time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
        if (m) onEngineTime(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
      });
      ff.on("progress", ({ time }) => {
        // ffmpeg-core reports output time in microseconds
        if (time > 0) onEngineTime(time / 1_000_000);
      });
      await ff.load({ coreURL: urls.core, wasmURL: urls.wasm, classWorkerURL: urls.worker });
      if (s.gen === gen) s.ff = ff;
      else ff.terminate(); // cancelled while loading
      return ff;
    })();
    s.loading = p;
    p.then(
      () => {
        if (s.gen === gen) s.loading = null;
      },
      () => {
        if (s.gen === gen) s.loading = null; // allow a retry
      },
    );
    return p;
  }

  async function mountInput(ff: FFmpeg, file: File, ext: string) {
    const name = `input.${ext}`;
    try {
      await ff.createDir("/work").catch(() => {});
      // WORKERFS reads the file lazily — the video is not copied into wasm memory
      const ok = await ff.mount("WORKERFS" as unknown as FFFSType, { files: [new File([file], name, { type: file.type })] }, "/work");
      if (!ok) throw new Error("WORKERFS unavailable");
      return { path: `/work/${name}`, cleanup: () => ff.unmount("/work") };
    } catch {
      await ff.writeFile(name, new Uint8Array(await file.arrayBuffer()));
      return { path: name, cleanup: () => ff.deleteFile(name) };
    }
  }

  async function probe(ff: FFmpeg, path: string) {
    const s = store.current;
    s.logs = [];
    s.total = 0;
    await ff.exec(["-hide_banner", "-i", path]); // exits 1 (no output) — we only want the stream info
    return parseProbe(s.logs.join("\n"));
  }

  /* ------------------------------- input -------------------------------- */

  function initSettings(duration: number | null) {
    const d = duration ?? 0;
    setRange({ start: 0, end: d });
    setGif((g) => ({ ...g, start: 0, dur: d ? Math.min(5, d) : 5 }));
  }

  function loadFile(file: File | undefined) {
    if (!file) return;
    const looksVideo = file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|mkv|3gp|avi|ts|mts|wmv|flv|mpe?g)$/i.test(file.name);
    if (!looksVideo) {
      setError("Please choose a video file (MP4, MOV, WEBM…).");
      notify.error("That isn't a video", "Choose an MP4, MOV or WEBM file.");
      return;
    }
    if (file.size > HARD_LIMIT) {
      setError(`This video is ${formatBytes(file.size)} — files over 2 GB are too big for the in-browser engine. Trim or compress it on a computer first.`);
      notify.error("Video too large", "Files over 2 GB cannot be processed in the browser.");
      return;
    }
    store.current.run++;
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    setPhone(Boolean(coarse));
    setSrc({ file, url: URL.createObjectURL(file), ext: extOf(file.name) });
    setMeta(null);
    setPreviewOk(true);
    setResult(null);
    setError(null);
    setProgress({ pct: 0, eta: "" });
    setPhase("ready");
    initSettings(null);
    if (file.size > SOFT_LIMIT)
      notify.warning("Large video", "This works best under about 500 MB — it may be slow or run out of memory on a phone.");
  }

  function onMeta(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (!Number.isFinite(v.duration)) {
      // recorded WEBMs often report Infinity until the browser has seeked to the end
      store.current.fixDuration = true;
      v.currentTime = 1e7;
      return;
    }
    setMeta({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    initSettings(v.duration);
  }

  function onDurationChange(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    const s = store.current;
    if (!s.fixDuration || !Number.isFinite(v.duration)) return;
    s.fixDuration = false;
    v.currentTime = 0;
    setMeta({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    initSettings(v.duration);
  }

  function onTimeUpdate(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    const end = store.current.previewEnd;
    if (end != null && v.currentTime >= end) {
      v.pause();
      store.current.previewEnd = null;
    }
  }

  /** the browser cannot play this format (MKV, AVI, HEVC on some desktops) — read the details with ffmpeg instead */
  async function analyse(source: Source) {
    const s = store.current;
    const run = s.run;
    setPreviewOk(false);
    setAnalysing(true);
    try {
      setPhase(s.ff ? "ready" : "engine");
      const ff = await getEngine();
      if (s.run !== run) return;
      const input = await mountInput(ff, source.file, source.ext);
      try {
        const p = await probe(ff, input.path);
        if (s.run !== run) return;
        setMeta({ duration: p.duration, width: p.width, height: p.height });
        initSettings(p.duration);
      } finally {
        await input.cleanup().catch(() => {});
      }
      setPhase("ready");
    } catch {
      if (s.run !== run) return;
      setPhase("ready");
      setMeta({ duration: null, width: 0, height: 0 });
    } finally {
      if (s.run === run) setAnalysing(false);
    }
  }

  function seek(t: number) {
    const v = videoRef.current;
    if (v && Number.isFinite(t)) v.currentTime = t;
  }

  function currentTime() {
    return videoRef.current?.currentTime ?? 0;
  }

  function playSelection(from: number, to: number) {
    const v = videoRef.current;
    if (!v) return;
    store.current.previewEnd = to;
    v.currentTime = from;
    void v.play().catch(() => {});
  }

  /* ------------------------------- jobs --------------------------------- */

  const duration = meta?.duration ?? null;

  /** a target at or above the source's short side means "keep the original size" */
  const shortSide = meta?.width ? Math.min(meta.width, meta.height) : 0;
  const effectiveRes = res && shortSide && shortSide <= res ? 0 : res;

  function compressDims(target: number) {
    if (!meta?.width || !meta.height) return null;
    const short = Math.min(meta.width, meta.height);
    const t = target ? Math.min(target, short) : short;
    const k = t / short;
    return { w: even(meta.width * k), h: even(meta.height * k) };
  }

  function estimateCompressed() {
    if (!src || !duration) return null;
    const dims = compressDims(res);
    if (!dims) return null;
    const p = PRESETS[preset];
    const fps = 30;
    const videoKbps = (dims.w * dims.h * fps * p.bpp) / 1000;
    const bytes = (duration * (videoKbps + p.audio) * 1000) / 8;
    return Math.min(bytes, src.file.size * 0.95);
  }

  function buildJob(source: Source, info: Probe): Job {
    const base = baseName(source.file.name);
    const total = info.duration ?? duration ?? 0;
    const copyExt = COPY_EXT.has(source.ext) ? source.ext : "mkv";
    const fast = (ext: string) => (ext === "mp4" || ext === "m4v" || ext === "mov" ? ["-movflags", "+faststart"] : []);
    const x264 = (crf: number, speed = "superfast") => ["-c:v", "libx264", "-preset", speed, "-crf", String(crf), "-pix_fmt", "yuv420p"];

    switch (mode) {
      case "video-trim": {
        const start = clamp(range.start, 0, total || range.start);
        const len = Math.max(0.1, range.end - start);
        const head = ["-ss", sec(start), "-i", "", "-t", sec(len)];
        const precise: Omit<Job, "fallback" | "total"> = {
          args: [
            ...head,
            "-map", "0:v:0?", "-map", "0:a:0?",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            ...x264(20),
            "-c:a", "aac", "-b:a", "160k",
            "-movflags", "+faststart",
            "out.mp4",
          ],
          out: "out.mp4",
          mime: MIME.mp4,
          name: `${base}-trimmed.mp4`,
          kind: "video",
        };
        if (cut === "precise" || !info.video) return { ...precise, total: len };
        const out = `out.${copyExt}`;
        return {
          args: [...head, "-map", "0:v:0?", "-map", "0:a?", "-c", "copy", "-avoid_negative_ts", "make_zero", ...fast(copyExt), out],
          out,
          mime: MIME[copyExt] ?? "video/mp4",
          name: `${base}-trimmed.${copyExt}`,
          kind: "video",
          total: len,
          note: "Fast cut starts on the nearest keyframe, so the clip may begin slightly before your start point.",
          fallback: { ...precise, note: "This video could not be cut without re-encoding, so a precise MP4 cut was made instead." },
        };
      }
      case "video-compress": {
        if (!info.video) throw new Error("No video track was found in this file.");
        const p = PRESETS[preset];
        const T = res;
        const vf = T
          ? `scale='if(gte(iw,ih),-2,min(${T},iw))':'if(gte(iw,ih),min(${T},ih),-2)'`
          : "scale=trunc(iw/2)*2:trunc(ih/2)*2";
        return {
          args: [
            "-i", "",
            "-map", "0:v:0", "-map", "0:a:0?",
            "-vf", vf,
            ...(preset === "high" ? [] : ["-fpsmax", "30"]),
            ...x264(p.crf, p.speed),
            "-c:a", "aac", "-b:a", `${p.audio}k`, "-ac", "2",
            "-movflags", "+faststart",
            "out.mp4",
          ],
          out: "out.mp4",
          mime: MIME.mp4,
          name: `${base}-compressed.mp4`,
          kind: "video",
          total,
        };
      }
      case "video-to-gif": {
        if (!info.video) throw new Error("No video track was found in this file.");
        const start = clamp(gif.start, 0, Math.max(0, (total || gif.start + gif.dur) - 0.1));
        const len = clamp(gif.dur, 0.5, GIF_MAX);
        const vf =
          `fps=${gif.fps},scale='min(${gif.width},iw)':-2:flags=lanczos,split[a][b];` +
          `[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
        return {
          args: ["-ss", sec(start), "-t", sec(len), "-i", "", "-vf", vf, "-loop", "0", "out.gif"],
          out: "out.gif",
          mime: MIME.gif,
          name: `${base}.gif`,
          kind: "gif",
          total: Math.min(len, total ? total - start : len),
        };
      }
      case "mute-video": {
        if (!info.video) throw new Error("No video track was found in this file.");
        const out = `out.${copyExt}`;
        const note = info.audio ? undefined : "This video had no sound track already — the copy is identical apart from the container.";
        return {
          args: ["-i", "", "-map", "0:v:0", "-c", "copy", "-an", ...fast(copyExt), out],
          out,
          mime: MIME[copyExt] ?? "video/mp4",
          name: `${base}-muted.${copyExt}`,
          kind: "video",
          total,
          note,
          fallback: {
            args: ["-i", "", "-map", "0:v:0", "-an", ...x264(20), "-movflags", "+faststart", "out.mp4"],
            out: "out.mp4",
            mime: MIME.mp4,
            name: `${base}-muted.mp4`,
            kind: "video",
            note: "The video could not be copied as-is, so it was re-encoded to MP4.",
          },
        };
      }
      case "extract-audio": {
        if (!info.audio) throw new Error("This video has no audio track to extract.");
        const mp3: Omit<Job, "fallback" | "total"> = {
          args: ["-i", "", "-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", `${mp3Rate}k`, "out.mp3"],
          out: "out.mp3",
          mime: MIME.mp3,
          name: `${base}.mp3`,
          kind: "audio",
        };
        if (audioFmt === "mp3") return { ...mp3, total };
        const encodeM4a: Omit<Job, "fallback" | "total"> = {
          args: ["-i", "", "-map", "0:a:0", "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "out.m4a"],
          out: "out.m4a",
          mime: MIME.m4a,
          name: `${base}.m4a`,
          kind: "audio",
          note: info.audio === "aac" ? undefined : `The original audio is ${info.audio.toUpperCase()}, so it was converted to AAC (192 kbps).`,
        };
        if (info.audio !== "aac") return { ...encodeM4a, total };
        return {
          args: ["-i", "", "-map", "0:a:0", "-vn", "-c:a", "copy", "-movflags", "+faststart", "out.m4a"],
          out: "out.m4a",
          mime: MIME.m4a,
          name: `${base}.m4a`,
          kind: "audio",
          total,
          note: "The original AAC audio was copied without re-encoding — no quality lost.",
          fallback: encodeM4a,
        };
      }
    }
  }

  function report(outputType: string, bytesOut: number) {
    if (!src) return;
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        tool: tool.slug,
        inputType: src.file.type || "video",
        outputType,
        files: 1,
        bytesIn: src.file.size,
        bytesOut,
      }),
    }).catch(() => {});
  }

  async function runJob() {
    if (!src || phase === "engine" || phase === "working") return;
    const source = src;
    const s = store.current;
    const run = ++s.run;
    const stale = () => s.run !== run;
    setError(null);
    setResult(null);
    setProgress({ pct: 0, eta: "" });
    setEnginePct(0);
    setPhase(s.ff ? "working" : "engine");
    trackEvent("process", tool.slug);
    const wake = await requestWakeLock();

    try {
      const ff = await getEngine();
      if (stale()) return;
      setPhase("working");
      const input = await mountInput(ff, source.file, source.ext);
      try {
        const info = await probe(ff, input.path);
        if (stale()) return;
        if (!info.video && !info.audio) throw new Error("This file could not be read as a video. It may be damaged or in an unsupported format.");
        const job = buildJob(source, info);
        const withInput = (args: string[]) => args.map((a, i) => (a === "" && args[i - 1] === "-i" ? input.path : a));

        s.total = job.total;
        s.started = performance.now();
        s.tick = 0;
        s.logs = [];
        let done: Omit<Job, "fallback" | "total"> = job;
        let code = await ff.exec(withInput(job.args));
        if (stale()) return;
        if (code !== 0 && job.fallback) {
          await ff.deleteFile(job.out).catch(() => {});
          done = job.fallback;
          s.started = performance.now();
          s.logs = [];
          setProgress({ pct: 0, eta: "" });
          code = await ff.exec(withInput(job.fallback.args));
          if (stale()) return;
        }
        if (code !== 0) throw new Error(friendlyError(s.logs.join("\n")));

        const data = await ff.readFile(done.out);
        await ff.deleteFile(done.out).catch(() => {});
        if (stale()) return;
        if (typeof data === "string" || !data.byteLength) throw new Error(friendlyError(s.logs.join("\n")));
        const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: done.mime });
        setResult({ blob, url: URL.createObjectURL(blob), name: done.name, kind: done.kind, note: done.note });
        setProgress({ pct: 1, eta: "" });
        setPhase("done");
        report(done.mime, blob.size);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
        notify.success(copy.done, `${done.name} · ${formatBytes(blob.size)}`);
      } finally {
        await input.cleanup().catch(() => {});
      }
    } catch (err) {
      if (stale()) return;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const msg =
        offline && !s.urls
          ? "You appear to be offline — the video engine downloads the first time you use this tool."
          : err instanceof Error && err.message && !/^(called FFmpeg|ffmpeg is not loaded)/i.test(err.message)
            ? err.message
            : "Something went wrong while processing the video.";
      setError(msg);
      setPhase("ready");
      notify.error("Could not process the video", offline && !s.urls ? "Connect to the internet once, then try again." : undefined);
    } finally {
      void wake?.release().catch(() => {});
    }
  }

  function cancel() {
    const s = store.current;
    s.run++;
    // ffmpeg.wasm cannot interrupt a running command, so stop the worker; the core stays cached for a quick restart
    s.gen++;
    s.ff?.terminate();
    s.ff = null;
    s.loading = null;
    setPhase("ready");
    setProgress({ pct: 0, eta: "" });
    setAnalysing(false);
    notify.info("Cancelled", "Nothing was saved. Change a setting and try again.");
  }

  function reset() {
    const s = store.current;
    if (phase === "engine" || phase === "working") cancel();
    s.run++;
    setSrc(null);
    setMeta(null);
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  function download() {
    if (!result) return;
    saveBlob(result.blob, result.name);
    trackEvent("download", tool.slug);
  }

  /* ------------------------------- render ------------------------------- */

  const working = phase === "engine" || phase === "working";
  const Icon = copy.icon;
  const btnBase =
    "flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const needsDuration = mode === "video-trim" || mode === "video-to-gif";
  const ready = !!src && (!needsDuration || !!duration) && !analysing;
  const selLen = mode === "video-trim" ? Math.max(0, range.end - range.start) : mode === "video-to-gif" ? gif.dur : (duration ?? 0);
  const reencodes = mode === "video-compress" || mode === "video-to-gif" || (mode === "video-trim" && cut === "precise");
  const slowWarning = reencodes && selLen > (phone ? 30 : 300);
  const estimate = mode === "video-compress" ? estimateCompressed() : null;
  const resolutionLabel = meta?.width ? `${meta.width}×${meta.height}` : null;
  const gifMaxStart = duration ? Math.max(0, duration - 0.5) : 0;

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">
          <input
            ref={inputRef}
            type="file"
            accept={tool.accept ?? "video/*"}
            className="hidden"
            onChange={(e) => {
              loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {!src ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                loadFile(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Choose a video"
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
                <UploadCloud className="h-6 w-6" />
              </motion.span>
              <p className="mt-4 font-bold">Drop a video here, or tap to choose from your gallery</p>
              <p className="mt-1 text-sm text-muted">MP4, MOV, WEBM, MKV — processed on your device, never uploaded</p>
              <p className="mt-3 text-xs text-muted">Works best under ~500 MB. Very long videos may be slow on phones.</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
              {/* ------------------------------ input ------------------------------ */}
              <div className="min-w-0 space-y-4">
                <div className="relative overflow-hidden rounded-2xl bg-black shadow-xl">
                  <video
                    ref={videoRef}
                    key={src.url}
                    src={src.url}
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={onMeta}
                    onDurationChange={onDurationChange}
                    onTimeUpdate={onTimeUpdate}
                    onError={() => {
                      if (previewOk) void analyse(src);
                    }}
                    className="mx-auto block max-h-[58vh] w-full bg-black object-contain"
                  />
                  {!previewOk && (
                    <div className="absolute inset-0 grid place-items-center bg-black/80 p-4 text-center text-sm text-white">
                      <div>
                        <Film className="mx-auto h-7 w-7 opacity-80" />
                        <p className="mt-2 font-bold">Your browser can&apos;t preview this format</p>
                        <p className="mt-1 text-xs opacity-80">
                          {analysing ? "Reading the video with the engine…" : "The video engine can usually still convert it."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1.5 rounded-lg surface px-2.5 py-1.5 font-semibold">
                    <Film className="h-3.5 w-3.5 text-brand-400" />
                    <span className="max-w-[180px] truncate">{src.file.name}</span>
                  </span>
                  <span className="rounded-lg surface px-2.5 py-1.5 font-semibold">{formatBytes(src.file.size)}</span>
                  {duration != null && (
                    <span className="flex items-center gap-1 rounded-lg surface px-2.5 py-1.5 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-brand-400" /> {fmtTime(duration)}
                    </span>
                  )}
                  {resolutionLabel && <span className="rounded-lg surface px-2.5 py-1.5 font-semibold">{resolutionLabel}</span>}
                </div>

                {src.file.size > SOFT_LIMIT && (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    This is a large file ({formatBytes(src.file.size)}). It may be slow, and phones can run out of memory — a computer
                    handles big videos best.
                  </p>
                )}

                {/* trim timeline */}
                {mode === "video-trim" && duration != null && duration > 0 && (
                  <div className="rounded-2xl surface p-4">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                      <span>
                        Start <span className="font-mono text-brand-400">{fmtTime(range.start, true)}</span>
                      </span>
                      <span className="text-muted">Clip {fmtTime(Math.max(0, range.end - range.start), true)}</span>
                      <span>
                        End <span className="font-mono text-brand-400">{fmtTime(range.end, true)}</span>
                      </span>
                    </div>
                    <RangeTrack
                      duration={duration}
                      start={range.start}
                      end={range.end}
                      disabled={working}
                      onStart={(v) => {
                        const start = Math.min(v, range.end - 0.1);
                        setRange((r) => ({ ...r, start: Math.max(0, start) }));
                        seek(Math.max(0, start));
                      }}
                      onEnd={(v) => {
                        const end = Math.max(v, range.start + 0.1);
                        setRange((r) => ({ ...r, end: Math.min(duration, end) }));
                        seek(Math.min(duration, end));
                      }}
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          const t = currentTime();
                          setRange((r) => ({ start: Math.min(t, Math.max(0, r.end - 0.1)), end: r.end }));
                        }}
                        className="rounded-xl surface px-2 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        Set start here
                      </button>
                      <button
                        type="button"
                        onClick={() => playSelection(range.start, range.end)}
                        className="flex items-center justify-center gap-1 rounded-xl surface px-2 py-2 text-xs font-bold text-brand-400 transition-colors hover:border-brand-400/60"
                      >
                        <Play className="h-3.5 w-3.5" /> Preview
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          const t = currentTime();
                          setRange((r) => ({ start: r.start, end: Math.max(t, Math.min(duration, r.start + 0.1)) }));
                        }}
                        className="rounded-xl surface px-2 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        Set end here
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      Play or scrub the video above, then tap <b>Set start here</b> / <b>Set end here</b>, or drag the handles.
                    </p>
                  </div>
                )}

                {/* gif timeline */}
                {mode === "video-to-gif" && duration != null && duration > 0 && (
                  <div className="space-y-3 rounded-2xl surface p-4">
                    <div>
                      <label htmlFor="gif-start" className="mb-1 flex justify-between text-xs font-semibold">
                        <span>Start</span>
                        <span className="font-mono text-brand-400">{fmtTime(gif.start, true)}</span>
                      </label>
                      <input
                        id="gif-start"
                        type="range"
                        min={0}
                        max={gifMaxStart}
                        step={0.1}
                        value={Math.min(gif.start, gifMaxStart)}
                        disabled={working}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setGif((g) => ({ ...g, start: v, dur: Math.min(g.dur, Math.max(0.5, duration - v)) }));
                          seek(v);
                        }}
                        className="w-full accent-[var(--color-brand-500)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="gif-dur" className="mb-1 flex justify-between text-xs font-semibold">
                        <span>Length (max {GIF_MAX} s)</span>
                        <span className="font-mono text-brand-400">{gif.dur.toFixed(1)} s</span>
                      </label>
                      <input
                        id="gif-dur"
                        type="range"
                        min={0.5}
                        max={Math.max(0.5, Math.min(GIF_MAX, duration - gif.start))}
                        step={0.5}
                        value={gif.dur}
                        disabled={working}
                        onChange={(e) => setGif((g) => ({ ...g, dur: Number(e.target.value) }))}
                        className="w-full accent-[var(--color-brand-500)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          const t = Math.min(currentTime(), gifMaxStart);
                          setGif((g) => ({ ...g, start: t, dur: Math.min(g.dur, Math.max(0.5, duration - t)) }));
                        }}
                        className="rounded-xl surface px-2 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                      >
                        Start from current frame
                      </button>
                      <button
                        type="button"
                        onClick={() => playSelection(gif.start, gif.start + gif.dur)}
                        className="flex items-center justify-center gap-1 rounded-xl surface px-2 py-2 text-xs font-bold text-brand-400 transition-colors hover:border-brand-400/60"
                      >
                        <Play className="h-3.5 w-3.5" /> Preview part
                      </button>
                    </div>
                  </div>
                )}

                {needsDuration && !duration && !analysing && meta && (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    The length of this video could not be read, so it can&apos;t be cut here. Try converting it to MP4 with the
                    Video Compressor first.
                  </p>
                )}
              </div>

              {/* ----------------------------- controls ---------------------------- */}
              <div className="min-w-0 space-y-5">
                {mode === "video-trim" && (
                  <div>
                    <Choice
                      label="Cut type"
                      value={cut}
                      disabled={working}
                      onChange={setCut}
                      options={[
                        { value: "fast", label: "Fast cut", hint: "instant, lossless" },
                        { value: "precise", label: "Precise cut", hint: "frame-exact MP4" },
                      ]}
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      {cut === "fast"
                        ? "Copies the video without re-encoding. It can only start on a keyframe, so the clip may begin up to a second or two early."
                        : "Re-encodes the clip to MP4 so it starts and ends exactly where you chose. Slower — your device does the encoding."}
                    </p>
                  </div>
                )}

                {mode === "video-compress" && (
                  <>
                    <Choice
                      label="Quality"
                      value={preset}
                      disabled={working}
                      onChange={(p) => {
                        setPreset(p);
                        setRes(PRESETS[p].res);
                      }}
                      options={(Object.keys(PRESETS) as Preset[]).map((k) => ({ value: k, label: PRESETS[k].label, hint: PRESETS[k].hint }))}
                    />
                    <Choice
                      label="Resolution"
                      value={effectiveRes}
                      disabled={working}
                      onChange={setRes}
                      options={RESOLUTIONS.map((r) => ({
                        value: r,
                        label: r ? `${r}p` : "Original",
                        disabled: !!r && !!shortSide && shortSide <= r,
                      }))}
                    />
                    <div className="rounded-xl surface px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted">Original</span>
                        <span className="font-bold">{formatBytes(src.file.size)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-muted">Estimated result</span>
                        <span className="font-bold text-brand-400">
                          {estimate ? `≈ ${formatBytes(estimate)}` : duration ? "—" : "after reading the video"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted">A rough guide — the real size depends on how much movement the video has.</p>
                    </div>
                  </>
                )}

                {mode === "video-to-gif" && (
                  <>
                    <Choice
                      label="Width"
                      value={gif.width}
                      disabled={working}
                      onChange={(w) => setGif((g) => ({ ...g, width: w }))}
                      options={GIF_WIDTHS.map((w) => ({ value: w as number, label: `${w}px` }))}
                    />
                    <Choice
                      label="Frames per second"
                      value={gif.fps}
                      disabled={working}
                      onChange={(f) => setGif((g) => ({ ...g, fps: f }))}
                      options={GIF_FPS.map((f) => ({ value: f as number, label: String(f) }))}
                    />
                    <p className="text-xs text-muted">
                      {Math.round(gif.dur * gif.fps)} frames. Smaller width and fewer frames make a lighter GIF — 480px at 12 fps suits
                      WhatsApp and the web.
                    </p>
                  </>
                )}

                {mode === "mute-video" && (
                  <p className="flex items-start gap-2 rounded-xl surface px-3 py-2.5 text-xs text-muted">
                    <VolumeX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
                    The sound track is removed and the picture is copied untouched — no quality loss, usually done in seconds.
                  </p>
                )}

                {mode === "extract-audio" && (
                  <>
                    <Choice
                      label="Audio format"
                      value={audioFmt}
                      disabled={working}
                      onChange={setAudioFmt}
                      options={[
                        { value: "mp3", label: "MP3", hint: "plays everywhere" },
                        { value: "m4a", label: "M4A", hint: "original AAC, lossless copy" },
                      ]}
                    />
                    {audioFmt === "mp3" ? (
                      <Choice
                        label="MP3 quality"
                        value={mp3Rate}
                        disabled={working}
                        onChange={setMp3Rate}
                        options={MP3_RATES.map((r) => ({ value: r as number, label: `${r} kbps`, hint: r === 128 ? "smaller" : r === 192 ? "recommended" : "best" }))}
                      />
                    ) : (
                      <p className="text-xs text-muted">
                        Most phone videos have AAC audio, which is copied straight into the M4A — instant and lossless. Other audio is
                        converted to AAC.
                      </p>
                    )}
                  </>
                )}

                {slowWarning && (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {phone
                      ? `${fmtDuration(selLen)} of video is a lot to re-encode on a phone — it may take several minutes. Keep this tab open and the screen on, or use a computer for long videos.`
                      : `Re-encoding ${fmtDuration(selLen)} of video in the browser can take a while. Keep this tab open — the progress bar shows the time left.`}
                  </p>
                )}

                {/* action / progress */}
                {working ? (
                  <div className="rounded-2xl surface p-4" aria-live="polite">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
                      {phase === "engine" ? "Loading video engine (about 30 MB, first time only)" : copy.working}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                        animate={{ width: `${phase === "engine" ? enginePct : Math.round(progress.pct * 100)}%` }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                      <span>
                        {phase === "engine"
                          ? `${enginePct}% — cached for next time`
                          : `${Math.round(progress.pct * 100)}%${progress.eta ? ` · about ${progress.eta} left` : ""}`}
                      </span>
                      <button
                        type="button"
                        onClick={cancel}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-muted transition-colors hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => void runJob()}
                    disabled={!ready}
                    whileHover={{ scale: ready ? 1.02 : 1 }}
                    whileTap={{ scale: 0.97 }}
                    className={`${btnBase} w-full bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25`}
                  >
                    {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    {analysing ? "Reading video…" : phase === "done" ? `${copy.cta} again` : copy.cta}
                  </motion.button>
                )}

                {/* result */}
                <AnimatePresence>
                  {result && phase === "done" && (
                    <motion.div
                      ref={resultRef}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl surface p-4"
                    >
                      <p className="text-sm font-bold">{copy.done}</p>
                      <div className="mt-3 overflow-hidden rounded-xl bg-black/80">
                        {result.kind === "video" && (
                          <video src={result.url} controls playsInline className="block max-h-[40vh] w-full object-contain" />
                        )}
                        {result.kind === "gif" && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={result.url} alt="Your GIF" className="mx-auto block max-h-[40vh] w-auto" />
                        )}
                        {result.kind === "audio" && (
                          <div className="p-3">
                            <audio src={result.url} controls className="w-full" />
                          </div>
                        )}
                      </div>
                      <p className="mt-2 break-all text-xs text-muted">
                        {result.name} · <b className="text-[var(--fg)]">{formatBytes(result.blob.size)}</b>
                        {mode === "video-compress" &&
                          (result.blob.size < src.file.size
                            ? ` · ${Math.round((1 - result.blob.size / src.file.size) * 100)}% smaller`
                            : " · not smaller than the original")}
                      </p>
                      {mode === "video-compress" && result.blob.size >= src.file.size && (
                        <p className="mt-1 text-xs text-amber-400">This video was already well compressed. Try Small or a lower resolution.</p>
                      )}
                      {result.note && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" /> {result.note}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <motion.button
                          type="button"
                          onClick={download}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className={`${btnBase} flex-1 bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-500/25`}
                        >
                          <Download className="h-4 w-4" /> Download {result.name.split(".").pop()?.toUpperCase()}
                        </motion.button>
                        <ShareSheet
                          title={result.name}
                          text={`I made this with the free ${tool.name} on SnapGrab`}
                          getFiles={() => [blobToFile(result.blob, result.name)]}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {mode === "mute-video" && (
                  <Link href="/tools/extract-audio-from-video" className="flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline">
                    Want the sound instead? Extract the audio <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {mode === "video-compress" && (
                  <Link href="/tools/trim-video" className="flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline">
                    Still too big? Trim it shorter first <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {mode === "video-to-gif" && (
                  <Link href="/tools/compress-video" className="flex items-center gap-1.5 text-sm font-semibold text-brand-400 hover:underline">
                    GIF too heavy? Compress the video as MP4 <ArrowRight className="h-4 w-4" />
                  </Link>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={working}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> Another video
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Start over
                  </button>
                </div>
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
                {src && !working && ready && (
                  <button type="button" onClick={() => void runJob()} className="ml-auto shrink-0 font-bold underline">
                    Retry
                  </button>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-4 space-y-1.5 text-xs text-muted">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
              Your video is processed on this device and never uploaded. Only the video engine (FFmpeg, about 30 MB) is downloaded
              once from a public CDN and then cached by your browser.
            </p>
            <p className="flex items-start gap-2">
              <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
              Speed depends on your device. Works best under ~500 MB; very long videos may be slow on phones.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
