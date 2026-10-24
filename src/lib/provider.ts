import { prisma } from "./prisma";
import { detectPlatform, normalizeUrl } from "./platforms";
import type { MediaFormat, ResolvedMedia } from "./types";
import { assertQuota, formatRenewal, recordQuotaCall, QuotaExceededError } from "./quota";
import { getIntegrations, isGroupConfigured } from "./integrations";

const RAPID_KEYS = ["RAPIDAPI_KEY", "RAPIDAPI_HOST", "RAPIDAPI_ENDPOINT", "RAPIDAPI_YT_HOST", "RAPIDAPI_YT_ENDPOINT", "RESOLVE_CACHE_TTL_MIN"] as const;
/** RapidAPI settings from Admin → Integrations, falling back to .env. */
export const rapidConfig = () => getIntegrations([...RAPID_KEYS]);

export class ProviderError extends Error {
  code: string;
  constructor(message: string, code = "PROVIDER_ERROR") {
    super(message);
    this.code = code;
  }
}

function cacheKey(url: string) {
  return url.toLowerCase();
}

async function logApiCall(data: {
  provider: string;
  endpoint: string;
  platform?: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  cached?: boolean;
  errorMsg?: string;
  quotaRemaining?: number | null;
  quotaLimit?: number | null;
}) {
  try {
    await prisma.apiCall.create({ data });
  } catch {
    /* logging must never break a download */
  }
}

/* ------------------------------------------------------------------ *
 * Normalisation — RapidAPI hosts all return slightly different shapes,
 * so everything funnels through one tolerant mapper.
 * ------------------------------------------------------------------ */

const KIND_BY_EXT: Record<string, MediaFormat["kind"]> = {
  mp4: "video", webm: "video", mov: "video", mkv: "video", m4v: "video",
  mp3: "audio", m4a: "audio", aac: "audio", opus: "audio", wav: "audio",
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image",
};

function guessExt(u: string, given?: string): string {
  if (given) return given.replace(/^\./, "").toLowerCase();
  const m = u.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : "mp4";
}

function qualityRank(q: string): number {
  const m = q.match(/(\d{3,4})\s*p/i);
  if (m) return Number(m[1]);
  if (/4k|2160/i.test(q)) return 2160;
  if (/2k|1440/i.test(q)) return 1440;
  if (/\bhd\b/i.test(q)) return 720;
  if (/\bsd\b/i.test(q)) return 480;
  const kbps = q.match(/(\d{2,3})\s*kbps/i);
  if (kbps) return Number(kbps[1]);
  return 0;
}

function toArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object") return [v as Record<string, unknown>];
  return [];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function normalizeProviderPayload(
  raw: Record<string, unknown>,
  sourceUrl: string,
  platformId: string,
  platformName: string,
): ResolvedMedia {
  const root = (raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : raw) as Record<
    string,
    unknown
  >;

  const candidates =
    toArray(root.medias).length ? toArray(root.medias)
    : toArray(root.url).length ? toArray(root.url)
    : toArray(root.links).length ? toArray(root.links)
    : toArray(root.formats).length ? toArray(root.formats)
    : toArray(root.video).length ? toArray(root.video)
    : [];

  const formats: MediaFormat[] = [];
  candidates.forEach((c, i) => {
    const url = str(c.url) ?? str(c.link) ?? str(c.download_url) ?? str(c.src);
    if (!url || !/^https?:\/\//i.test(url)) return;
    const ext = guessExt(url, str(c.extension) ?? str(c.ext) ?? str(c.format));
    const typeHint = (str(c.type) ?? "").toLowerCase();
    const kind: MediaFormat["kind"] =
      typeHint === "audio" || typeHint === "video" || typeHint === "image"
        ? (typeHint as MediaFormat["kind"])
        : KIND_BY_EXT[ext] ?? "video";
    const quality =
      str(c.quality) ?? str(c.label) ?? str(c.resolution) ?? (kind === "audio" ? "Audio" : "Original");
    formats.push({
      id: `f${i}`,
      url,
      ext,
      kind,
      quality,
      sizeBytes: num(c.size) ?? num(c.filesize) ?? num(c.contentLength),
      hasAudio: c.audio === false ? false : true,
      label: `${quality} · ${ext.toUpperCase()}`,
    });
  });

  // de-dup by url, best quality first, video → audio → image
  const seen = new Set<string>();
  const kindOrder = { video: 0, audio: 1, image: 2 } as const;
  const unique = formats
    .filter((f) => (seen.has(f.url) ? false : (seen.add(f.url), true)))
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || qualityRank(b.quality) - qualityRank(a.quality));

  if (!unique.length) {
    throw new ProviderError(
      "No downloadable media was found at that link. It may be private, deleted or region-locked.",
      "NO_MEDIA",
    );
  }

  return {
    platform: platformId,
    platformName,
    sourceUrl,
    title: str(root.title) ?? str(root.description)?.slice(0, 120) ?? `${platformName} media`,
    author: str(root.author) ?? str(root.owner) ?? str(root.username) ?? str(root.channel),
    thumbnail: str(root.thumbnail) ?? str(root.thumb) ?? str(root.cover) ?? str(root.picture),
    durationSec: num(root.duration) ?? num(root.durationSec),
    formats: unique,
    cached: false,
  };
}

/* ------------------------------------------------------------------ *
 * Demo payload — lets the whole product run before a RapidAPI key
 * is added, so the UI, logging and admin panel are testable day one.
 * ------------------------------------------------------------------ */
function demoPayload(sourceUrl: string, platformId: string, platformName: string): ResolvedMedia {
  const sample = "https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files/big_buck_bunny.mp4";
  return {
    platform: platformId,
    platformName,
    sourceUrl,
    title: `Demo result — ${platformName} link detected`,
    author: "SnapGrab demo mode",
    thumbnail: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&q=70",
    durationSec: 60,
    demo: true,
    cached: false,
    formats: [
      { id: "d1", url: sample, quality: "1080p", ext: "mp4", kind: "video", label: "1080p · MP4", sizeBytes: 5_242_880, hasAudio: true },
      { id: "d2", url: sample, quality: "720p", ext: "mp4", kind: "video", label: "720p · MP4", sizeBytes: 2_621_440, hasAudio: true },
      { id: "d3", url: sample, quality: "320kbps", ext: "mp3", kind: "audio", label: "320kbps · MP3", sizeBytes: 1_048_576 },
    ],
  };
}

export async function isDemoMode() {
  return !(await isGroupConfigured("rapidapi"));
}

/* ------------------------------------------------------------------ */

export async function resolveMedia(inputUrl: string): Promise<ResolvedMedia> {
  const url = normalizeUrl(inputUrl);
  if (!url) throw new ProviderError("That does not look like a valid link.", "BAD_URL");

  const platform = detectPlatform(url);
  if (!platform) {
    throw new ProviderError(
      "That site is not supported yet. Try YouTube, Instagram, Facebook, TikTok, X, Pinterest and more.",
      "UNSUPPORTED",
    );
  }

  const cfg = await rapidConfig();
  const CACHE_TTL_MIN = Number(cfg.RESOLVE_CACHE_TTL_MIN) || 60;

  // 1. cache
  const key = cacheKey(url);
  const cached = await prisma.resolveCache.findUnique({ where: { key } }).catch(() => null);
  if (cached && cached.expiresAt > new Date()) {
    await prisma.resolveCache.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => {});
    await logApiCall({
      provider: "cache",
      endpoint: "resolve",
      platform: platform.id,
      status: 200,
      ok: true,
      latencyMs: 0,
      cached: true,
    });
    return { ...(JSON.parse(cached.payload) as ResolvedMedia), cached: true };
  }

  // 2. demo mode
  if (await isDemoMode()) {
    const demo = demoPayload(url, platform.id, platform.name);
    await logApiCall({ provider: "demo", endpoint: "resolve", platform: platform.id, status: 200, ok: true, latencyMs: 0 });
    return demo;
  }

  // 3. upstream RapidAPI call
  const isYt = platform.id === "youtube" && cfg.RAPIDAPI_YT_ENDPOINT;
  const host = (isYt ? cfg.RAPIDAPI_YT_HOST : cfg.RAPIDAPI_HOST) as string;
  const endpoint = (isYt ? cfg.RAPIDAPI_YT_ENDPOINT : cfg.RAPIDAPI_ENDPOINT) as string;
  if (!host || !endpoint) throw new ProviderError("Downloader provider is not configured.", "NO_PROVIDER");

  // plan allowance used up: fail fast instead of burning a call that will be refused
  try {
    await assertQuota("rapidapi-downloader");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      throw new ProviderError(
        `The downloader has reached its plan limit. It will be back on ${formatRenewal(err.resetsAt)}.`,
        "QUOTA_EXCEEDED",
      );
    }
    throw err;
  }

  const started = Date.now();
  let status = 0;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rapidapi-key": cfg.RAPIDAPI_KEY as string,
        "x-rapidapi-host": host,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    status = res.status;
    const text = await res.text();

    // RapidAPI reports the remaining monthly allowance on every response
    const quotaRemaining = Number(res.headers.get("x-ratelimit-requests-remaining"));
    const quotaLimit = Number(res.headers.get("x-ratelimit-requests-limit"));
    const headerQuota = {
      remaining: res.headers.has("x-ratelimit-requests-remaining") && Number.isFinite(quotaRemaining) ? quotaRemaining : null,
      limit: res.headers.has("x-ratelimit-requests-limit") && Number.isFinite(quotaLimit) ? quotaLimit : null,
    };

    if (!res.ok) {
      // 429 with nothing left = monthly plan exhausted; 429 otherwise = short burst limit
      const planGone = (status === 429 && headerQuota.remaining === 0) || (status === 403 && /quota|exceed|subscri/i.test(text));
      await recordQuotaCall("rapidapi-downloader", {
        ok: false,
        error: `HTTP ${status}`,
        ...headerQuota,
        exhausted: planGone,
      });
      if (planGone) {
        throw new ProviderError("The downloader has used its plan limit. It will switch back on automatically when the plan renews.", "QUOTA_EXCEEDED");
      }
      const msg =
        status === 429
          ? "We are getting a lot of requests right now. Please try again in a minute."
          : status === 403
            ? "Downloader quota reached. Please contact support."
            : `Downloader service returned ${status}.`;
      throw new ProviderError(msg, `HTTP_${status}`);
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      await recordQuotaCall("rapidapi-downloader", { ok: false, error: "unreadable response", ...headerQuota });
      throw new ProviderError("Downloader service returned an unreadable response.", "BAD_JSON");
    }
    // some hosts answer 200 with {error:true, message:"..."}; surface that reason
    const upstreamMessage =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : undefined;

    if (json.error === true || (json.error && typeof json.error === "string")) {
      // upstream wording is terse and often ungrammatical, so map it to our own copy
      const detail = upstreamMessage ?? "";
      const friendly = /private|restricted|consent|cookie|login/i.test(detail)
        ? "That post is private or restricted, so it cannot be downloaded."
        : /not found|no medias?|404/i.test(detail)
          ? "Nothing was found at that link. Check it is complete and the post still exists."
          : /region|country|geo/i.test(detail)
            ? "That video is blocked in the region our server runs from."
            : /limit|quota|exceed/i.test(detail)
              ? "The downloader has hit its plan limit. Please try again later."
              : "The downloader could not read that link. It may be private, deleted or unsupported.";
      await recordQuotaCall("rapidapi-downloader", { ok: false, error: detail || "upstream error", ...headerQuota });
      throw new ProviderError(friendly, "UPSTREAM");
    }

    const media = normalizeProviderPayload(json, url, platform.id, platform.name);
    await recordQuotaCall("rapidapi-downloader", { ok: true, ...headerQuota });

    await prisma.resolveCache
      .upsert({
        where: { key },
        create: {
          key,
          platform: platform.id,
          payload: JSON.stringify(media),
          expiresAt: new Date(Date.now() + CACHE_TTL_MIN * 60_000),
        },
        update: {
          payload: JSON.stringify(media),
          expiresAt: new Date(Date.now() + CACHE_TTL_MIN * 60_000),
        },
      })
      .catch(() => {});

    await logApiCall({
      provider: host,
      endpoint,
      platform: platform.id,
      status,
      ok: true,
      latencyMs: Date.now() - started,
      quotaRemaining: Number.isFinite(quotaRemaining) ? quotaRemaining : null,
      quotaLimit: Number.isFinite(quotaLimit) ? quotaLimit : null,
    });
    return media;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown provider failure";
    await logApiCall({
      provider: host,
      endpoint,
      platform: platform.id,
      status: status || 0,
      ok: false,
      latencyMs: Date.now() - started,
      errorMsg: message.slice(0, 300),
    });
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(
      message.includes("timeout") || message.includes("aborted")
        ? "The downloader took too long to respond. Please try again."
        : "We could not reach the downloader service. Please try again.",
      "NETWORK",
    );
  }
}
