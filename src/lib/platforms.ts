export type PlatformId =
  | "youtube"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "twitter"
  | "pinterest"
  | "snapchat"
  | "linkedin"
  | "reddit"
  | "vimeo"
  | "dailymotion"
  | "soundcloud"
  | "threads"
  | "twitch";

export type Platform = {
  id: PlatformId;
  name: string;
  slug: string;
  color: string;
  gradient: string;
  hosts: string[];
  blurb: string;
  formats: string[];
  /** short marketing copy for the dedicated landing page */
  headline: string;
  description: string;
  faqs: { q: string; a: string }[];
};

export const PLATFORMS: Platform[] = [
  {
    id: "youtube",
    name: "YouTube",
    slug: "youtube",
    color: "#FF0033",
    gradient: "from-[#FF0033] to-[#FF6B6B]",
    hosts: ["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"],
    blurb: "Videos, Shorts & MP3 up to 4K",
    formats: ["MP4 4K", "MP4 1080p", "MP4 720p", "MP3 320kbps"],
    headline: "YouTube Video Downloader",
    description:
      "Download YouTube videos and Shorts in 4K, 1080p, 720p or pull the audio out as a 320kbps MP3. No software, no signup, no watermarks — just paste the link.",
    faqs: [
      { q: "Can I download YouTube Shorts?", a: "Yes. Paste any Shorts link and SnapGrab returns the full-resolution MP4 plus an MP3 option." },
      { q: "Is 4K supported?", a: "When the source video was uploaded in 4K, the 2160p stream is offered in the results list." },
      { q: "Can I convert YouTube to MP3?", a: "Yes — every result page includes audio-only formats at up to 320kbps." },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    slug: "instagram",
    color: "#E1306C",
    gradient: "from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    hosts: ["instagram.com", "instagr.am", "ddinstagram.com"],
    blurb: "Reels, Stories, Posts & IGTV",
    formats: ["Reels MP4", "Story MP4", "Photo JPG", "Profile picture HD"],
    headline: "Instagram Reels & Video Downloader",
    description:
      "Save Instagram Reels, Stories, carousel posts, IGTV clips and HD profile pictures straight to your device in original quality.",
    faqs: [
      { q: "Can I download private posts?", a: "No. SnapGrab only processes publicly accessible content, in line with Instagram's terms." },
      { q: "Do Stories work?", a: "Public Stories work while they are live (24 hours)." },
      { q: "Are photos supported?", a: "Yes — single images and every image inside a carousel post." },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    slug: "facebook",
    color: "#1877F2",
    gradient: "from-[#1877F2] to-[#42A5F5]",
    hosts: ["facebook.com", "fb.watch", "fb.com", "m.facebook.com", "web.facebook.com"],
    blurb: "Videos, Reels & Watch clips",
    formats: ["MP4 HD", "MP4 SD", "MP3 audio"],
    headline: "Facebook Video Downloader",
    description:
      "Grab Facebook videos, Reels and Watch clips in HD or SD. Works with public posts, page videos and fb.watch short links.",
    faqs: [
      { q: "Does fb.watch work?", a: "Yes, short links are resolved automatically before downloading." },
      { q: "Why is only SD available?", a: "Some uploads never had an HD render. SnapGrab shows every stream the source actually provides." },
      { q: "Can I download private group videos?", a: "No — only public content can be processed." },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    slug: "tiktok",
    color: "#00F2EA",
    gradient: "from-[#00F2EA] via-[#25F4EE] to-[#FE2C55]",
    hosts: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"],
    blurb: "No watermark MP4 & MP3",
    formats: ["MP4 no watermark", "MP4 HD", "MP3 audio"],
    headline: "TikTok Downloader — No Watermark",
    description:
      "Download TikTok videos without the watermark, in full HD, plus the original sound as MP3. Short vm./vt. links are supported.",
    faqs: [
      { q: "Is the watermark really removed?", a: "Yes — SnapGrab requests the clean render whenever the source exposes it." },
      { q: "Can I save the sound only?", a: "Yes, the audio track is offered as a separate MP3 download." },
      { q: "Do slideshows work?", a: "Photo slideshows return each image individually plus the background audio." },
    ],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    slug: "twitter",
    color: "#111827",
    gradient: "from-slate-700 to-slate-900",
    hosts: ["twitter.com", "x.com", "t.co", "mobile.twitter.com"],
    blurb: "Videos & GIFs from posts",
    formats: ["MP4 HD", "MP4 SD", "GIF"],
    headline: "X / Twitter Video Downloader",
    description: "Save videos and GIFs from X (formerly Twitter) posts in the highest bitrate the platform serves.",
    faqs: [
      { q: "Do x.com links work?", a: "Both x.com and twitter.com URLs are accepted." },
      { q: "Can I download GIFs?", a: "Twitter GIFs are really MP4s — they download as MP4 and loop the same way." },
      { q: "Are protected accounts supported?", a: "No, protected posts cannot be accessed." },
    ],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    slug: "pinterest",
    color: "#E60023",
    gradient: "from-[#E60023] to-[#FF5A5F]",
    hosts: ["pinterest.com", "pin.it", "pinterest.co.uk", "pinterest.ca"],
    blurb: "Pins, Idea Pins & images",
    formats: ["MP4 HD", "Image PNG/JPG"],
    headline: "Pinterest Video & Image Downloader",
    description: "Download Pinterest video pins, Idea Pins and full-resolution images without the app.",
    faqs: [
      { q: "Do pin.it links work?", a: "Yes, shortened pin.it links are expanded automatically." },
      { q: "What resolution do images use?", a: "SnapGrab always requests the original uploaded resolution." },
      { q: "Are secret boards supported?", a: "No — only public pins." },
    ],
  },
  {
    id: "snapchat",
    name: "Snapchat",
    slug: "snapchat",
    color: "#FFFC00",
    gradient: "from-[#FFFC00] to-[#FFD400]",
    hosts: ["snapchat.com", "t.snapchat.com"],
    blurb: "Spotlight & public Stories",
    formats: ["MP4 HD"],
    headline: "Snapchat Spotlight Downloader",
    description: "Save Snapchat Spotlight clips and public Story videos as clean MP4 files.",
    faqs: [
      { q: "Can I download a friend's snap?", a: "No. Only public Spotlight and public profile Stories are supported." },
      { q: "Will the sender be notified?", a: "SnapGrab never touches private snaps, so there is nothing to notify." },
      { q: "Is there a quality loss?", a: "No, the original upload stream is served untouched." },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    slug: "linkedin",
    color: "#0A66C2",
    gradient: "from-[#0A66C2] to-[#3B9CE8]",
    hosts: ["linkedin.com", "lnkd.in"],
    blurb: "Post & article videos",
    formats: ["MP4 HD", "MP4 SD"],
    headline: "LinkedIn Video Downloader",
    description: "Download videos from public LinkedIn posts, articles and company pages for offline reference.",
    faqs: [
      { q: "Do I need to be logged in?", a: "No, but the post must be publicly visible." },
      { q: "Are LinkedIn Learning videos supported?", a: "No — paid course content is out of scope." },
      { q: "Does lnkd.in work?", a: "Yes, short links are resolved first." },
    ],
  },
  {
    id: "reddit",
    name: "Reddit",
    slug: "reddit",
    color: "#FF4500",
    gradient: "from-[#FF4500] to-[#FF8717]",
    hosts: ["reddit.com", "redd.it", "v.redd.it", "old.reddit.com"],
    blurb: "v.redd.it with audio merged",
    formats: ["MP4 with audio", "MP4 video only", "GIF"],
    headline: "Reddit Video Downloader (with sound)",
    description:
      "Reddit splits video and audio into separate streams — SnapGrab merges them so your download actually has sound.",
    faqs: [
      { q: "Why do other sites give silent videos?", a: "They grab only the v.redd.it video track. SnapGrab merges the audio track back in." },
      { q: "Do NSFW posts work?", a: "Public NSFW posts resolve, but you must be of legal age in your country." },
      { q: "Are crossposts supported?", a: "Yes, the original source is followed automatically." },
    ],
  },
  {
    id: "vimeo",
    name: "Vimeo",
    slug: "vimeo",
    color: "#1AB7EA",
    gradient: "from-[#1AB7EA] to-[#5CD5FF]",
    hosts: ["vimeo.com", "player.vimeo.com"],
    blurb: "Up to 4K source files",
    formats: ["MP4 4K", "MP4 1080p", "MP4 720p"],
    headline: "Vimeo Video Downloader",
    description: "Download public Vimeo videos in up to 4K, including embedded player links.",
    faqs: [
      { q: "Are password-protected videos supported?", a: "No, they require the owner's password and are excluded." },
      { q: "Does the embed player URL work?", a: "Yes, player.vimeo.com links are accepted." },
      { q: "Is 4K available?", a: "When the uploader published a 4K render, it appears in the list." },
    ],
  },
  {
    id: "dailymotion",
    name: "Dailymotion",
    slug: "dailymotion",
    color: "#0066DC",
    gradient: "from-[#0066DC] to-[#00A2FF]",
    hosts: ["dailymotion.com", "dai.ly"],
    blurb: "All qualities up to 1080p",
    formats: ["MP4 1080p", "MP4 720p", "MP4 480p"],
    headline: "Dailymotion Video Downloader",
    description: "Save Dailymotion videos in every resolution the platform publishes, including dai.ly short links.",
    faqs: [
      { q: "Do dai.ly links work?", a: "Yes." },
      { q: "Is there a length limit?", a: "No hard limit, though very long videos take longer to resolve." },
      { q: "Can I extract audio?", a: "Yes, an MP3 option is generated where available." },
    ],
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    slug: "soundcloud",
    color: "#FF5500",
    gradient: "from-[#FF5500] to-[#FF8800]",
    hosts: ["soundcloud.com", "on.soundcloud.com", "snd.sc"],
    blurb: "Tracks & sets as MP3",
    formats: ["MP3 320kbps", "MP3 128kbps"],
    headline: "SoundCloud to MP3 Downloader",
    description: "Turn public SoundCloud tracks into MP3 files with artwork and metadata preserved.",
    faqs: [
      { q: "Are private tracks supported?", a: "No, only publicly streamable tracks." },
      { q: "What bitrate do I get?", a: "The highest the uploader provided, typically 128kbps or 320kbps." },
      { q: "Do playlists work?", a: "Playlist links return every track individually." },
    ],
  },
  {
    id: "threads",
    name: "Threads",
    slug: "threads",
    color: "#000000",
    gradient: "from-neutral-700 to-black",
    hosts: ["threads.net", "threads.com"],
    blurb: "Videos & images from posts",
    formats: ["MP4 HD", "Image JPG"],
    headline: "Threads Video Downloader",
    description: "Download videos and images posted on Threads in their original quality.",
    faqs: [
      { q: "Is a login required?", a: "No, public threads resolve without an account." },
      { q: "Can I grab every image in a post?", a: "Yes, each attachment is listed separately." },
      { q: "Are replies supported?", a: "Yes, link directly to the reply containing the media." },
    ],
  },
  {
    id: "twitch",
    name: "Twitch",
    slug: "twitch",
    color: "#9146FF",
    gradient: "from-[#9146FF] to-[#C79CFF]",
    hosts: ["twitch.tv", "clips.twitch.tv", "m.twitch.tv"],
    blurb: "Clips & VOD segments",
    formats: ["MP4 1080p60", "MP4 720p"],
    headline: "Twitch Clip Downloader",
    description: "Download Twitch clips and public VOD segments at up to 1080p60.",
    faqs: [
      { q: "Do sub-only VODs work?", a: "No, subscriber-gated content is not accessible." },
      { q: "Is 60fps preserved?", a: "Yes, when the clip was recorded at 60fps." },
      { q: "Can I download a whole stream?", a: "Long VODs may time out; clips are the reliable path." },
    ],
  },
];

export const PLATFORM_MAP: Record<string, Platform> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p]),
);

/** Detect which platform a pasted URL belongs to. Returns null when unknown. */
export function detectPlatform(input: string): Platform | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const p of PLATFORMS) {
    if (p.hosts.some((h) => host === h || host.endsWith("." + h))) return p;
  }
  return null;
}

/** Accepts bare links (`youtu.be/x`) and trims tracking junk. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim().replace(/\s+/g, "");
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "igshid"].forEach((k) =>
      u.searchParams.delete(k),
    );
    return u.toString();
  } catch {
    return null;
  }
}

export function isSupported(input: string): boolean {
  return detectPlatform(input) !== null;
}
