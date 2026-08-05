import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const POSTS = [
  {
    slug: "how-to-download-youtube-videos-in-4k",
    title: "How to Download YouTube Videos in 4K (2026 Guide)",
    excerpt:
      "A step-by-step walkthrough for saving YouTube videos at their maximum resolution — including Shorts, playlists and audio-only MP3 exports.",
    tags: "youtube,guide,4k",
    cover: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200&q=70",
    content: `## Why 4K matters

A 2160p master holds roughly four times the pixel data of 1080p. On a large screen the difference is obvious in motion-heavy footage — sports, drone shots, gameplay.

## Step by step

1. Open the video on YouTube and copy the address from the URL bar (or use **Share → Copy link**).
2. Return to SnapGrab. The moment you focus the input box, your clipboard link is detected automatically.
3. Press **Download**. SnapGrab reads every stream the source publishes.
4. Pick **2160p MP4** if it is listed. If it is not, the uploader never published a 4K render.

## Shorts and music

Shorts behave exactly like normal videos — paste the link and you get an MP4 plus an MP3 option. For music, choose the 320kbps audio row to skip the video payload entirely.

## A note on rights

Download content you own, content published under a permissive licence, or content you have permission to reuse. Personal offline viewing is generally fine; redistribution is not.`,
  },
  {
    slug: "download-instagram-reels-without-watermark",
    title: "Download Instagram Reels Without Losing Quality",
    excerpt:
      "Reels are compressed twice before they reach your feed. Here is how to pull the cleanest available copy and why screen recording is always worse.",
    tags: "instagram,reels,tips",
    cover: "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=1200&q=70",
    content: `## Screen recording loses more than you think

A screen recording re-encodes an already compressed stream, at your display's refresh rate, with UI overlays baked in. Pulling the source file skips all of that.

## The fast way

1. Tap the **···** menu on the Reel and choose **Copy link**.
2. Paste it into SnapGrab — the platform is detected instantly.
3. Download the top row, which is always the highest bitrate render available.

## What will not work

Private accounts, close-friends stories and archived posts are not publicly accessible, and SnapGrab will not attempt to reach them.

## Carousels

Multi-image posts return every attachment separately, so you can save just the frame you need.`,
  },
  {
    slug: "is-it-legal-to-download-social-media-videos",
    title: "Is It Legal to Download Social Media Videos?",
    excerpt:
      "Fair use, personal archiving and redistribution — a plain-English look at where the lines actually sit for downloaded video.",
    tags: "legal,copyright",
    cover: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=70",
    content: `## The short answer

Downloading for **private, personal viewing** is treated very differently from **republishing**. The first is broadly tolerated in most jurisdictions; the second is a copyright matter.

## Three safe categories

- **Your own uploads.** Always fine.
- **Creative Commons or public domain.** Check the licence terms for attribution requirements.
- **Explicit permission.** A DM saying "sure, go ahead" is worth keeping.

## Where people get into trouble

Re-uploading someone else's clip to your own account, running ads against it, or bundling it into a paid product. That is redistribution, and platform strikes follow quickly.

## Platform terms vs. law

Terms of service are a contract with the platform, not criminal law. Breaching them can get your account limited even where no copyright claim exists.

> This article is general information, not legal advice. When money is involved, ask a lawyer in your country.`,
  },
  {
    slug: "mp4-vs-mp3-which-format-should-you-pick",
    title: "MP4 vs MP3: Which Download Format Should You Pick?",
    excerpt:
      "Container, codec, bitrate — a five-minute primer that explains why a 720p file can look better than a 1080p one.",
    tags: "formats,audio,video",
    cover: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=1200&q=70",
    content: `## Container vs codec

MP4 is a **container** — a box. Inside sits a video codec (usually H.264 or AV1) and an audio codec (AAC). MP3 is audio only.

## Resolution is not quality

A 1080p file encoded at 1.5 Mbps can look worse than a 720p file at 4 Mbps. Bitrate decides how much detail survives compression. When two rows show the same resolution, pick the larger file size.

## When to choose MP3

- Podcasts, lectures, interviews, music.
- You want the file on a device with limited storage.
- 320kbps is transparent for almost all listeners; 128kbps is noticeably thinner on cymbals and reverb tails.

## When to choose MP4

Anything where the picture matters, or anything you plan to edit later.`,
  },
  {
    slug: "how-snapgrab-protects-your-privacy",
    title: "How SnapGrab Handles Your Data",
    excerpt:
      "What we log, why we log it, how long we keep it, and how to ask for deletion — written without the legal fog.",
    tags: "privacy,transparency",
    cover: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=70",
    content: `## What we store

- The link you paste, so a repeat request can be served from cache instead of burning API quota.
- A random anonymous ID in a cookie, plus your IP and browser string, for abuse prevention and aggregate analytics.
- Which platform and which format you downloaded.

## What we never store

We do not keep the media file itself. Downloads stream straight from the source CDN through our proxy to your device and are never written to disk.

## Retention

Analytics rows are pruned on a rolling basis. Contact messages stay until they are handled and removed from the dashboard.

## Your controls

Clear the \`sg_aid\` cookie to reset your anonymous ID. Email us to request removal of any record tied to your IP.`,
  },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@snapgrab.app").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Admin@12345";

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, name: "Site Owner", password: await bcrypt.hash(password, 10), role: "admin" },
    update: { password: await bcrypt.hash(password, 10) },
  });
  console.log(`✔ admin ready → ${email}`);

  for (const p of POSTS) {
    await prisma.blogPost.upsert({ where: { slug: p.slug }, create: p, update: p });
  }
  console.log(`✔ ${POSTS.length} blog posts seeded`);

  const defaults: Record<string, string> = {
    site_tagline: "Download video from anywhere, in seconds.",
    contact_email: process.env.MAIL_TO ?? "hello@snapgrab.app",
    announcement: "",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log("✔ settings seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
