export type MediaFormat = {
  id: string;
  url: string;
  quality: string;
  ext: string;
  kind: "video" | "audio" | "image";
  sizeBytes?: number;
  label: string;
  hasAudio?: boolean;
};

export type ResolvedMedia = {
  platform: string;
  platformName: string;
  sourceUrl: string;
  title: string;
  author?: string;
  thumbnail?: string;
  durationSec?: number;
  formats: MediaFormat[];
  cached: boolean;
  demo?: boolean;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
