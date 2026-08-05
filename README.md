<div align="center">

# SnapGrab

**An all-in-one media downloader and browser toolkit.**
Paste a link from 14 platforms to get the file — plus 24 offline tools for images, PDFs, text and generators that never upload a byte.

Ships with a complete admin panel: visitor tracking, download logs, API-quota monitoring, tool analytics, a blog CMS and an SMTP contact inbox.

`Next.js 16` · `React 19` · `TypeScript` · `Tailwind 4` · `Prisma 6` · `Framer Motion` · `Recharts` · `pdf-lib` · `qrcode`

</div>

---

## Table of contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Features](#features)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [SEO](#seo)
- [Admin panel](#admin-panel)
- [API reference](#api-reference)
- [Deploying](#deploying)
- [Scripts](#scripts)
- [Roadmap](#roadmap)
- [Legal](#legal)

---

## Quick start

```bash
git clone git@github.com:hassan-t8/snapgrab.git
cd snapgrab

cp .env.example .env      # then fill in the values you need
npm install               # also runs prisma generate
npm run setup             # push the schema + seed admin, blog posts and settings
npm run dev               # http://localhost:3000
```

| | |
| --- | --- |
| **Site** | http://localhost:3000 |
| **Admin** | http://localhost:3000/admin |
| **Login** | `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (default `admin@snapgrab.app` / `Admin@12345`) |

> **Demo mode.** With no RapidAPI key set, link resolves return sample media so you can exercise the whole product — UI, logging, dashboard, charts — before paying for anything. The image tools are fully functional either way, because they never touch the server. Add `RAPIDAPI_KEY` and demo mode switches off automatically.

---

## Configuration

Every setting lives in `.env`. Copy `.env.example` to start.

### Database

```env
DATABASE_URL="file:./dev.db"     # SQLite for local dev
```

### Downloader provider (RapidAPI)

```env
RAPIDAPI_KEY="your-key"
RAPIDAPI_HOST="social-download-all-in-one.p.rapidapi.com"
RAPIDAPI_ENDPOINT="https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink"

# optional: a dedicated provider just for YouTube
RAPIDAPI_YT_HOST=""
RAPIDAPI_YT_ENDPOINT=""
```

**Swapping providers.** Upstream responses are normalised by `normalizeProviderPayload` in [`src/lib/provider.ts`](src/lib/provider.ts), which already tolerates the common shapes (`medias`, `url`, `links`, `formats`, `video`) and the usual field aliases (`link`/`download_url`/`src`, `quality`/`label`/`resolution`, …). A new host usually needs no code change; if it does, that single function is the only place to touch.

### SMTP (contact form)

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="you@gmail.com"
SMTP_PASS="app-password"          # Gmail needs an App Password, not your login
MAIL_FROM="SnapGrab <no-reply@yourdomain.com>"
MAIL_TO="you@yourdomain.com"
```

Each submission sends two emails: a notification to `MAIL_TO` with reply-to set to the sender, and a confirmation to the visitor. Without SMTP configured, messages still land in the admin inbox — nothing is lost, and the UI says so honestly.

### Ads and SEO

```env
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"   # canonicals, sitemap, OG images
NEXT_PUBLIC_SITE_NAME="SnapGrab"
NEXT_PUBLIC_ADSENSE_CLIENT="ca-pub-xxxxxxxxxxxxxxxx"
GOOGLE_SITE_VERIFICATION=""                     # optional Search Console token
```

Until `NEXT_PUBLIC_ADSENSE_CLIENT` is set, `<AdSlot />` renders a neutral reserved block so layout never shifts. Pass real slot ids per placement: `<AdSlot slot="1234567890" />`.

### Auth

```env
AUTH_SECRET="run: openssl rand -base64 32"
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="a-strong-password"
```

Run `npm run seed` after changing these to apply them.

---

## Features

### Downloaders — 14 platforms

YouTube · Instagram · Facebook · TikTok · X (Twitter) · Pinterest · Snapchat · LinkedIn · Reddit · Vimeo · Dailymotion · SoundCloud · Threads · Twitch

- **Auto link detection** — the clipboard is read on focus (permission-gated, fails silently) and pasting starts the resolve on its own. A live badge shows the detected platform as you type.
- **Every published quality** — 4K down to 360p, plus audio-only rows, sorted best-first and de-duplicated.
- **No watermark, no re-encoding** — the original stream is passed through untouched.
- Each platform gets a **dedicated landing page** with its own copy, format list, how-to and FAQ.

### Browser tools — 27 and counting

Every tool below is generated from a single registry entry in [`src/lib/tools.ts`](src/lib/tools.ts): the page, copy, steps, FAQ, metadata, JSON-LD, sitemap entry, nav and footer links all come from that one object. Adding a tool is one object, not a new page.

**Image** — runs on the Canvas API

| Tool | What it does |
| --- | --- |
| Image Converter | JPG ⇄ PNG ⇄ WEBP, batch, quality control |
| PNG to JPG | Fixed-output converter, flattens alpha onto white |
| JPG to PNG | Lossless output for editing |
| WEBP Converter | To and from WEBP |
| Image Compressor | Live quality slider with before/after size readout |
| Image Resizer | Exact pixels, aspect-ratio lock, batch |
| Favicon Generator | 16–512px set plus the HTML snippet |
| Image to Base64 | Data URI with ready-made CSS and HTML snippets |

**PDF** — runs on pdf-lib

| Tool | What it does |
| --- | --- |
| Image to PDF | JPG/PNG pages combined into one document |
| Merge PDF | Join several PDFs in order |
| Split PDF | Extract a page range, or one file per page |
| Rotate PDF | 90/180/270°, written into the file so it sticks |

**Text & developer** — pure JS and Web Crypto

| Tool | What it does |
| --- | --- |
| Word Counter | Words, characters, sentences, paragraphs, reading time |
| Case Converter | 9 cases including camel, Pascal, snake, kebab |
| JSON Formatter | Prettify, minify, validate with error positions |
| Base64 Encoder | Encode/decode with full UTF-8 support |
| URL Encoder | Percent-encode and decode |
| Hash Generator | SHA-1, SHA-256, SHA-384, SHA-512 |
| Slug Generator | SEO permalinks with accents transliterated |

**Generators**

| Tool | What it does |
| --- | --- |
| Password Generator | crypto.getRandomValues, live entropy readout |
| UUID Generator | v4 in bulk, three formats |
| QR Code Generator | PNG and SVG, no redirect, no expiry |
| Color Converter | HEX/RGB/HSL, tint scale, WCAG contrast |
| Lorem Ipsum | Paragraphs, sentences or words |

**Media** — the only tools that talk to the server (they receive the URL, never a file)

| Tool | What it does |
| --- | --- |
| Video to MP3 | Extracts the audio track from any supported link |
| Audio Downloader | SoundCloud, podcasts, TikTok sounds |
| Video Downloader | The universal all-platform downloader |

**Nothing is uploaded by the 24 offline tools.** Images decode and re-encode through the Canvas API, PDFs are assembled with pdf-lib, hashes come from Web Crypto, and randomness from `crypto.getRandomValues` — all in your browser. Only an anonymous run count is reported for analytics.

> **Secure-context note:** the hash generator needs `crypto.subtle`, which browsers only expose over HTTPS or on localhost. Over plain `http://` on a LAN IP it shows a clear notice instead of failing. Everything else works in both contexts.

### Service switches

Any of the 41 services (27 tools + 14 downloaders) can be switched off from **Admin → Services** without a deploy. Turning one off:

- removes it from the navbar, footer, home page, tools index and the 404 page's suggestions
- replaces its page with a `noindex` "temporarily unavailable" notice carrying your own message, plus links to live alternatives
- drops it from `sitemap.xml`
- makes the API return **503**, so a bookmarked link or a saved `curl` cannot bypass the switch

Toggles are **opt-out** — a service with no database row is enabled, so adding a new tool never needs a migration or seed to go live. Changes apply on the next request; there is no cache to clear.

### Content and trust pages

Blog with markdown CMS · About · Contact · FAQ · Privacy policy · Terms of service · DMCA — all written to describe what the code actually does, which is what AdSense review looks for.

### Design

Dark and light themes with no flash-of-wrong-theme, an animated conic gradient border on the input, blob aurora backgrounds, scroll-reveal and stagger animations throughout, a marquee platform strip, animated counters, and full `prefers-reduced-motion` support. Responsive from 360px up.

---

## Project structure

```
src/
├── app/
│   ├── (site)/                  # public site — has Navbar/Footer/tracker
│   │   ├── page.tsx             # home
│   │   ├── tools/[slug]/        # 27 dynamic tool pages, 4 engines
│   │   ├── download/[platform]/ # dynamic platform pages
│   │   ├── blog/[slug]/
│   │   └── about|contact|faq|privacy|terms|dmca/
│   ├── admin/
│   │   ├── login/               # outside the guard
│   │   └── (dash)/              # guarded route group, own chrome
│   ├── api/                     # resolve, download, contact, track, og, admin
│   ├── sitemap.ts · robots.ts · manifest.ts · icon.svg
│   └── layout.tsx               # html shell, fonts, metadata, theme script
├── components/
│   ├── admin/                   # shell, charts, tables, editors
│   ├── tools/                   # ImageStudio · PdfStudio · TextStudio · GeneratorStudio
│   ├── Downloader.tsx           # the link resolver UI
│   └── sections.tsx             # reusable marketing sections
└── lib/
    ├── platforms.ts             # platform registry + URL detection
    ├── tools.ts                 # tool registry (drives the dynamic pages)
    ├── provider.ts              # RapidAPI adapter, cache, normalisation
    ├── seo.ts                   # JSON-LD builders, OG helpers
    ├── tracking.ts · stats.ts · auth.ts · mailer.ts · ratelimit.ts
    └── markdown.ts              # escape-first markdown renderer
```

---

## How it works

1. **Detect** — `detectPlatform()` matches the pasted URL's hostname against the registry in [`src/lib/platforms.ts`](src/lib/platforms.ts). Tracking parameters are stripped first.
2. **Resolve** — `POST /api/resolve` checks the TTL cache (`ResolveCache`), then calls the provider, normalises the response into one predictable format list, and logs the call to `ApiCall` with its latency.
3. **Download** — `GET /api/download` streams the chosen file through the server so it saves with a clean filename in every browser. Loopback and private-range destinations are blocked (SSRF guard); range requests pass through for seeking.
5. **Track** — every request upserts a `Visitor` keyed by an anonymous cookie, and each route change records a `PageView`, producing the per-visitor footstep trail in the admin panel.

Media is never written to disk — it is piped straight from the source CDN to the visitor.

**Rate limits** (per IP, in memory): 20 resolves/min · 30 downloads/min · 60 tool runs/min · 5 contact posts/10 min · 8 login attempts/10 min. Swap [`src/lib/ratelimit.ts`](src/lib/ratelimit.ts) for Redis when you run more than one instance.

---

## SEO

Implemented across every route, not just the home page:

- **Metadata** — per-page title templates, descriptions, keywords and canonicals; `metadataBase` so every relative URL resolves absolutely.
- **Dynamic OG images** — `/api/og` renders a branded 1200×630 card per page via `next/og`; wired into both Open Graph and Twitter card tags.
- **Structured data** — `Organization` + `WebSite` (with SearchAction) on the home page, `SoftwareApplication` + `HowTo` + `FAQPage` + `BreadcrumbList` on tool and platform pages, `BlogPosting` + `BreadcrumbList` on articles, `CollectionPage` + `ItemList` on the tools index.
- **Crawl control** — generated `sitemap.xml` covering all 55 public URLs (static pages, 14 platforms, 27 tools, every published post), `robots.txt` that blocks `/admin` and `/api/` while explicitly allowing `/api/og`, and `googleBot` directives for large image previews.
- **PWA/manifest** — `manifest.webmanifest`, SVG icon, theme colours per colour scheme.
- **On-page** — one `<h1>` per route, visible breadcrumbs, internal linking between related tools and platforms, semantic landmarks, alt text and a skip link.

Verify locally with `curl localhost:3000/sitemap.xml` or paste any page into Google's Rich Results Test.

---

## Admin panel

| Page | What it shows |
| --- | --- |
| **Dashboard** | 7-day downloads, visitors, page views and success rate with deltas; 14-day traffic area chart; platform bars; country and device donuts; provider health; recent activity |
| **Downloads** | Every resolve and transfer — source link, format, size, IP, country, status — filterable by platform and status |
| **Visitors** | Unique visitors with IP, geo, device, browser and visit counts; searchable by IP, country or city |
| **Visitor detail** | The full footsteps trail — every page view in order, plus that visitor's download history |
| **Tools usage** | Runs per tool across all 27 tools, files processed, bytes in/out and average size saving |
| **Services** | One switch per tool and downloader — hide any service from the whole site, with an optional visitor-facing message |
| **API usage** | Call volume, billable vs cached calls, cache hit rate, latency, failures, per-provider and per-platform breakdown |
| **Blog posts** | Create, edit, publish/unpublish, delete — with live markdown preview |
| **Messages** | Contact inbox with reply, mark-handled and delete |
| **Subscribers** | Newsletter list with copy-all |
| **Settings** | Environment status readout plus editable tagline, contact email and site-wide announcement banner |

Auth is a JWT in an httpOnly cookie, 8-hour expiry, bcrypt-hashed passwords, brute-force limited. `/admin` is `noindex` and blocked in robots.txt.

---

## API reference

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/resolve` | `{ url }` → normalised media with every available format |
| `GET` | `/api/download` | Streams a chosen format as an attachment |
| `POST` | `/api/contact` | Validates, stores and emails a contact message |
| `POST` | `/api/subscribe` | Newsletter signup |
| `POST` | `/api/track` | Records a page view |
| `POST` | `/api/tools/track` | Records an anonymous tool run |
| `GET` | `/api/og` | Renders a social preview card |
| `POST` | `/api/admin/login` · `/logout` | Session management |
| `POST`/`DELETE` | `/api/admin/blogs` | Blog CRUD (auth required) |
| `PATCH`/`DELETE` | `/api/admin/messages` | Inbox management (auth required) |
| `POST` | `/api/admin/settings` | Site settings (auth required) |
| `PATCH` | `/api/admin/services` | Enable/disable services in bulk (auth required) |

---

## Deploying

1. **Change the secrets.** `AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Re-run `npm run seed`.
2. **Set `NEXT_PUBLIC_SITE_URL`** to your real domain — canonicals, the sitemap and OG images all derive from it.
3. **Move off SQLite.** In `prisma/schema.prisma` set `provider = "postgresql"`, point `DATABASE_URL` at your database, then `npx prisma db push && npm run seed`. Serverless platforms have no persistent writable disk.
4. **Deploy.** On Vercel the `x-vercel-ip-country` / `-city` headers populate visitor geo automatically; behind Cloudflare, `cf-ipcountry` is used instead. No extra configuration needed.

```bash
npm run build && npm start
```

### Testing from your phone

`next dev` already listens on every interface. Point a phone on the same Wi-Fi at your machine's LAN address:

```bash
ipconfig getifaddr en0        # macOS — your LAN IP
npx next dev -H 0.0.0.0 -p 3001
```

`allowedDevOrigins` in [`next.config.ts`](next.config.ts) must list that IP, otherwise Next blocks the dev asset requests and the page loads but never hydrates. Set `NEXT_PUBLIC_SITE_URL` to the same address so canonicals and OG images match.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | generate + db push + seed |
| `npm run seed` | Re-seed admin, posts and settings |
| `npm run db:studio` | Prisma Studio |
| `npm run lint` | ESLint |

---

## Roadmap

- Local audio and video conversion via ffmpeg.wasm
- PDF compression and page reordering by drag
- Batch and playlist downloads with a queue
- Redis-backed rate limiting and cache for multi-instance deploys

---

## Legal

SnapGrab hosts no media and only processes publicly accessible links. Users are responsible for holding the rights to whatever they download; the [DMCA page](/dmca) documents the takedown process, and the [privacy policy](/privacy) describes exactly what is logged and why.

Not affiliated with YouTube, Meta, TikTok, X, Pinterest, Reddit, Snapchat, LinkedIn, Vimeo, Dailymotion, SoundCloud or Twitch. All trademarks belong to their respective owners.

Licensed under the [MIT License](LICENSE).
