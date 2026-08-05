export type ToolEngine = "image" | "link-audio" | "link-video";

export type ToolCategory = "Image" | "Audio" | "Video";

export type Tool = {
  slug: string;
  name: string;
  /** H1 on the tool page — keep it keyword-led */
  headline: string;
  category: ToolCategory;
  tagline: string;
  description: string;
  engine: ToolEngine;
  /** for the image engine: which output format the converter targets, or null to let the user pick */
  output?: "image/jpeg" | "image/png" | "image/webp" | null;
  /** image engine mode */
  mode?: "convert" | "compress" | "resize";
  accept?: string;
  inputs: string[];
  outputs: string[];
  color: string;
  keywords: string[];
  steps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  /** related tool slugs */
  related: string[];
};

const IMAGE_ACCEPT = "image/*";

const IMAGE_INPUTS = ["JPG", "JPEG", "PNG", "WEBP", "GIF", "BMP", "AVIF", "HEIC*", "SVG"];

const IMAGE_PRIVACY_FAQ = {
  q: "Are my files uploaded to your server?",
  a: "No. Image tools run entirely inside your browser using the Canvas API — the file never leaves your device. We only record an anonymous count of how many conversions ran, never the image itself.",
};

const IMAGE_SIZE_FAQ = {
  q: "Is there a file size limit?",
  a: "There is no server limit because nothing is uploaded. The practical ceiling is your device's memory — very large images (over roughly 8000×8000) can be slow on older phones.",
};

export const TOOLS: Tool[] = [
  /* ------------------------------- image converters ------------------------------- */
  {
    slug: "image-converter",
    name: "Image Converter",
    headline: "Free Image Converter — JPG, PNG, WEBP & more",
    category: "Image",
    tagline: "Convert between JPG, PNG and WEBP",
    description:
      "Convert images between JPG, PNG and WEBP right in your browser. Drop in a batch, pick the output format and quality, and download the results — nothing is uploaded to a server.",
    engine: "image",
    mode: "convert",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG", "WEBP"],
    color: "#7048f0",
    keywords: ["image converter", "convert jpg to png", "png to jpg", "webp converter", "free image converter online"],
    steps: [
      { title: "Drop your images", body: "Drag files onto the panel or tap to browse. You can queue as many as your device can hold." },
      { title: "Choose the output", body: "Pick JPG, PNG or WEBP, then set the quality if the format supports it." },
      { title: "Convert", body: "Everything runs locally — a large batch finishes in seconds with no upload wait." },
      { title: "Save", body: "Download files one by one, or use Download all to save the whole batch." },
    ],
    faqs: [
      IMAGE_PRIVACY_FAQ,
      {
        q: "Which format should I pick?",
        a: "WEBP for the web — it is typically 25–35% smaller than JPG at the same visual quality. JPG for maximum compatibility with older software. PNG when you need lossless quality or transparency.",
      },
      {
        q: "Does converting to JPG remove transparency?",
        a: "Yes. JPG has no alpha channel, so transparent areas are flattened onto a white background. Convert to PNG or WEBP if you need to keep transparency.",
      },
      IMAGE_SIZE_FAQ,
    ],
    related: ["png-to-jpg", "jpg-to-png", "webp-converter", "image-compressor"],
  },
  {
    slug: "png-to-jpg",
    name: "PNG to JPG",
    headline: "PNG to JPG Converter — free and instant",
    category: "Image",
    tagline: "Flatten PNGs into smaller JPGs",
    description:
      "Turn PNG files into JPG in one step. JPG files are dramatically smaller for photographs, which makes them faster to email, upload and post.",
    engine: "image",
    mode: "convert",
    output: "image/jpeg",
    accept: IMAGE_ACCEPT,
    inputs: ["PNG", "JPG", "WEBP", "GIF", "BMP", "AVIF"],
    outputs: ["JPG"],
    color: "#f59e0b",
    keywords: ["png to jpg", "convert png to jpg", "png to jpeg converter", "png jpg online free"],
    steps: [
      { title: "Add your PNG files", body: "Drag them in, or tap the panel to browse your device." },
      { title: "Set the quality", body: "85% is the sweet spot — visually identical to most eyes at roughly a fifth of the size." },
      { title: "Convert and save", body: "Files are produced locally and download straight away." },
    ],
    faqs: [
      {
        q: "Why is my PNG so much bigger than the JPG?",
        a: "PNG is lossless — it stores every pixel exactly. JPG discards detail the eye is poor at noticing, which is why a photograph often shrinks by 80% or more with no visible difference.",
      },
      {
        q: "What happens to transparent areas?",
        a: "They are filled with white, because JPG cannot store transparency. If you need the transparent background, use the WEBP converter instead.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["jpg-to-png", "image-converter", "image-compressor", "webp-converter"],
  },
  {
    slug: "jpg-to-png",
    name: "JPG to PNG",
    headline: "JPG to PNG Converter — lossless output",
    category: "Image",
    tagline: "Convert photos to lossless PNG",
    description:
      "Convert JPG images to PNG when you need a lossless file for editing, screenshots or graphics with sharp edges and text.",
    engine: "image",
    mode: "convert",
    output: "image/png",
    accept: IMAGE_ACCEPT,
    inputs: ["JPG", "PNG", "WEBP", "GIF", "BMP", "AVIF"],
    outputs: ["PNG"],
    color: "#14c8be",
    keywords: ["jpg to png", "jpeg to png", "convert jpg to png free", "png converter online"],
    steps: [
      { title: "Add your JPGs", body: "Drop in one file or a whole folder's worth." },
      { title: "Convert", body: "PNG is lossless, so there is no quality setting to worry about." },
      { title: "Save", body: "Download individually or grab the whole batch." },
    ],
    faqs: [
      {
        q: "Will this restore quality my JPG lost?",
        a: "No, and no tool can. JPG compression is destructive — converting to PNG preserves what is left without adding further loss, which matters if you plan to edit and re-save repeatedly.",
      },
      {
        q: "When is PNG the right choice?",
        a: "Screenshots, logos, line art, anything with text or hard edges, and any image you will edit in several passes.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["png-to-jpg", "image-converter", "webp-converter", "image-resizer"],
  },
  {
    slug: "webp-converter",
    name: "WEBP Converter",
    headline: "WEBP Converter — to and from WEBP",
    category: "Image",
    tagline: "Modern format, much smaller files",
    description:
      "Convert images to WEBP for faster page loads, or convert existing WEBP files back to JPG and PNG for software that cannot open them.",
    engine: "image",
    mode: "convert",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: ["WEBP", "JPG", "PNG", "GIF", "BMP", "AVIF"],
    outputs: ["WEBP", "JPG", "PNG"],
    color: "#8f74ff",
    keywords: ["webp converter", "webp to jpg", "webp to png", "convert to webp", "jpg to webp"],
    steps: [
      { title: "Add your files", body: "WEBP in, or anything you want turned into WEBP." },
      { title: "Pick the direction", body: "Choose WEBP as the output to shrink files, or JPG/PNG to make a WEBP openable anywhere." },
      { title: "Convert and save", body: "All local, all instant." },
    ],
    faqs: [
      {
        q: "Why does WEBP produce smaller files?",
        a: "It uses more modern compression than JPG — typically 25–35% smaller at matching visual quality, with transparency support JPG lacks.",
      },
      {
        q: "Why will my software not open WEBP?",
        a: "Older applications predate the format. Converting to JPG or PNG here solves it in one step.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["image-converter", "png-to-jpg", "jpg-to-png", "image-compressor"],
  },
  {
    slug: "image-compressor",
    name: "Image Compressor",
    headline: "Image Compressor — shrink photos without the mush",
    category: "Image",
    tagline: "Cut file size, keep the detail",
    description:
      "Compress JPG, PNG and WEBP images with a live quality control and a before/after size readout, so you can see exactly what each setting costs you.",
    engine: "image",
    mode: "compress",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "WEBP", "PNG"],
    color: "#ef4444",
    keywords: ["image compressor", "compress jpg", "reduce image size", "photo compressor online", "compress png"],
    steps: [
      { title: "Add your images", body: "Drop in the files you need to slim down." },
      { title: "Move the quality slider", body: "The saving is shown per file, so you can trade size against detail with your eyes open." },
      { title: "Compress", body: "Runs locally at full speed — no upload, no queue." },
      { title: "Save", body: "Keep the results that hit your target and re-run the rest at a different setting." },
    ],
    faqs: [
      {
        q: "What quality should I use?",
        a: "80–85% is invisible to almost everyone and usually cuts file size by 60–80%. Below 60% you start to see blocking in skies, gradients and flat colour.",
      },
      {
        q: "Can I compress a PNG?",
        a: "Yes, but PNG is lossless, so real savings come from converting it to WEBP or JPG. The tool will show you the difference for your own file.",
      },
      IMAGE_PRIVACY_FAQ,
      IMAGE_SIZE_FAQ,
    ],
    related: ["image-converter", "image-resizer", "webp-converter", "png-to-jpg"],
  },
  {
    slug: "image-resizer",
    name: "Image Resizer",
    headline: "Image Resizer — exact pixel dimensions",
    category: "Image",
    tagline: "Resize by width, height or percentage",
    description:
      "Resize images to an exact width or height, with the aspect ratio locked by default. Ideal for upload limits, thumbnails and profile pictures.",
    engine: "image",
    mode: "resize",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG", "WEBP"],
    color: "#0aa39c",
    keywords: ["image resizer", "resize image online", "resize photo pixels", "bulk image resize"],
    steps: [
      { title: "Add your images", body: "One file or a whole batch — the same dimensions apply to all of them." },
      { title: "Set the size", body: "Enter a width and leave the ratio locked, and the height follows automatically." },
      { title: "Resize and save", body: "Output format and quality are yours to choose." },
    ],
    faqs: [
      {
        q: "Will enlarging an image make it sharper?",
        a: "No. Scaling up invents pixels from the ones you already have, so it always looks softer. Downscaling is the operation that preserves quality.",
      },
      {
        q: "Can I resize a batch to the same size?",
        a: "Yes — every queued file gets the same settings, which is the fastest way to prepare a consistent set of thumbnails.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["image-compressor", "image-converter", "jpg-to-png", "webp-converter"],
  },

  /* ------------------------------- link based media ------------------------------- */
  {
    slug: "video-to-mp3",
    name: "Video to MP3",
    headline: "Video to MP3 Converter — extract audio from any link",
    category: "Audio",
    tagline: "Pull the audio out of any supported video",
    description:
      "Paste a video link from YouTube, Facebook, TikTok, Instagram or any supported platform and download just the audio track as an MP3 — no video payload, no re-encoding.",
    engine: "link-audio",
    inputs: ["YouTube", "Facebook", "TikTok", "Instagram", "X", "SoundCloud", "+8 more"],
    outputs: ["MP3", "M4A"],
    color: "#14c8be",
    keywords: ["video to mp3", "youtube to mp3", "convert video to audio", "extract audio from video", "mp3 converter"],
    steps: [
      { title: "Copy the video link", body: "Use the Share or Copy link button in any supported app." },
      { title: "Paste it here", body: "The platform is detected automatically the moment you paste." },
      { title: "Pick the audio track", body: "Only audio formats are listed, at the highest bitrate the source published." },
      { title: "Download", body: "The MP3 saves straight to your device." },
    ],
    faqs: [
      {
        q: "What bitrate will I get?",
        a: "The best the source provides — usually 128kbps or 320kbps. No tool can add detail that was never in the upload.",
      },
      {
        q: "Is the audio re-encoded?",
        a: "No. The original audio stream is passed through untouched, so there is no second round of compression loss.",
      },
      {
        q: "Which platforms work?",
        a: "All fourteen the downloader supports, including YouTube, Facebook, Instagram, TikTok, X and SoundCloud.",
      },
      {
        q: "Can I convert a file from my computer?",
        a: "Not yet — this tool works from links. Local audio and video conversion needs a heavier engine, and it is on the roadmap.",
      },
    ],
    related: ["audio-downloader", "video-downloader", "image-converter"],
  },
  {
    slug: "audio-downloader",
    name: "Audio Downloader",
    headline: "Audio Downloader — save tracks and podcasts",
    category: "Audio",
    tagline: "SoundCloud, podcasts and background sound",
    description:
      "Download the audio behind any supported link — SoundCloud tracks, podcast episodes, TikTok sounds and the background music from reels.",
    engine: "link-audio",
    inputs: ["SoundCloud", "YouTube", "TikTok", "Instagram", "Facebook", "+9 more"],
    outputs: ["MP3", "M4A"],
    color: "#FF5500",
    keywords: ["audio downloader", "soundcloud downloader", "download podcast mp3", "tiktok sound download"],
    steps: [
      { title: "Copy the track link", body: "From SoundCloud, a podcast page or any supported platform." },
      { title: "Paste and resolve", body: "Audio-only formats are filtered out for you." },
      { title: "Download", body: "Artwork and metadata are preserved where the source provides them." },
    ],
    faqs: [
      {
        q: "Do private tracks work?",
        a: "No — only publicly streamable content can be processed.",
      },
      {
        q: "Can I download a whole playlist?",
        a: "Playlist links return each track separately so you can pick what you want. Queued batch downloads are on the roadmap.",
      },
      {
        q: "Is it legal to keep these files?",
        a: "For personal offline listening, generally yes. Redistributing or monetising someone else's audio is a copyright matter and your responsibility.",
      },
    ],
    related: ["video-to-mp3", "video-downloader"],
  },
  {
    slug: "video-downloader",
    name: "Video Downloader",
    headline: "Video Downloader — every platform, one box",
    category: "Video",
    tagline: "All 14 platforms in a single tool",
    description:
      "The universal downloader: paste a link from any supported platform and pick from every video quality the source published, up to 4K, with no watermark.",
    engine: "link-video",
    inputs: ["YouTube", "Instagram", "Facebook", "TikTok", "X", "+9 more"],
    outputs: ["MP4", "WEBM", "MP3"],
    color: "#7048f0",
    keywords: ["video downloader", "download video online", "4k video downloader", "all in one video downloader"],
    steps: [
      { title: "Copy any video link", body: "From any of the fourteen supported platforms." },
      { title: "Paste it in", body: "Detection is automatic; you never pick the platform yourself." },
      { title: "Choose a quality", body: "From 4K down to 360p, plus audio-only options." },
      { title: "Save", body: "The file downloads with a clean, readable filename." },
    ],
    faqs: [
      {
        q: "How is this different from the home page?",
        a: "It is the same engine — this page simply exists as a direct entry point for people searching for a general video downloader rather than a specific platform.",
      },
      {
        q: "Is 4K really available?",
        a: "When the uploader published a 4K render, yes. If it is missing from the list, the source never had it.",
      },
      {
        q: "Are watermarks removed?",
        a: "On platforms that publish a clean render — TikTok being the notable one — you get the version without the watermark.",
      },
    ],
    related: ["video-to-mp3", "audio-downloader", "image-converter"],
  },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

export const TOOL_CATEGORIES: ToolCategory[] = ["Image", "Audio", "Video"];

export function toolsByCategory(category: ToolCategory) {
  return TOOLS.filter((t) => t.category === category);
}

export function relatedTools(tool: Tool) {
  return tool.related.map((s) => TOOL_MAP[s]).filter(Boolean);
}
