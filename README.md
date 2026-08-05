# SnapGrab

An all-in-one social media downloader — paste a link from YouTube, Instagram, Facebook, TikTok, X and ten more platforms and get the file. Ships with a full admin panel: visitor tracking, download logs, API-quota monitoring, a blog CMS, a contact inbox and an SMTP mailer.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 6 · Framer Motion · Recharts**.

---

## Quick start

```bash
npm install          # also runs prisma generate
npm run setup        # push the schema + seed admin, blog posts and settings
npm run dev          # http://localhost:3000
```

Admin panel: **/admin** → sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
(defaults: `admin@snapgrab.app` / `Admin@12345` — change these before deploying).

The app runs out of the box in **demo mode**: without a RapidAPI key, resolves return sample media so you can exercise the entire UI, logging and dashboard before paying for anything.

---

## Configuration

Everything lives in `.env` (copy `.env.example`).

### Downloader provider (RapidAPI)

```env
RAPIDAPI_KEY="your-key"
RAPIDAPI_HOST="social-download-all-in-one.p.rapidapi.com"
RAPIDAPI_ENDPOINT="https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink"
```

The moment `RAPIDAPI_KEY` is set, demo mode switches off and real media is resolved.

Optionally point YouTube at a dedicated provider (some hosts handle it better):

```env
RAPIDAPI_YT_HOST="..."
RAPIDAPI_YT_ENDPOINT="..."
```

**Swapping providers.** Responses are normalised in [`src/lib/provider.ts`](src/lib/provider.ts) by `normalizeProviderPayload`, which already tolerates the common shapes (`medias`, `url`, `links`, `formats`, `video`) and the usual field aliases. A new host usually needs no code change; if it does, that one function is the only place to touch.

### SMTP (contact form)

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="you@gmail.com"
SMTP_PASS="app-password"      # Gmail requires an App Password, not your login
MAIL_FROM="SnapGrab <no-reply@yourdomain.com>"
MAIL_TO="you@yourdomain.com"
```

Two emails go out per submission: a notification to `MAIL_TO` (with reply-to set to the sender) and a confirmation to the visitor. Without SMTP, messages still land in the admin inbox — nothing is lost.

### AdSense

```env
NEXT_PUBLIC_ADSENSE_CLIENT="ca-pub-xxxxxxxxxxxxxxxx"
```

Until that is set, `<AdSlot />` renders a neutral reserved block, so layout never shifts. Pass real slot ids per placement: `<AdSlot slot="1234567890" />`.

The site is built to pass AdSense review: privacy policy, terms, DMCA, about, contact, a real blog, no pop-ups and no deceptive download buttons.

---

## What is in the box

### Public site

| Route | Purpose |
| --- | --- |
| `/` | Hero downloader, platform grid, how-it-works, features, testimonials, FAQ |
| `/download/[platform]` | 14 SEO landing pages, each with its own copy, formats and FAQ |
| `/blog`, `/blog/[slug]` | Blog index and article pages with reading time, share row and related posts |
| `/about`, `/contact`, `/faq` | Company pages; contact posts through SMTP |
| `/privacy`, `/terms`, `/dmca` | Legal pages written to match what the code actually does |
| `/sitemap.xml`, `/robots.txt` | Generated, including every platform page and published post |

### Admin panel (`/admin`)

| Page | What it shows |
| --- | --- |
| Dashboard | 7-day downloads/visitors/views/success-rate, 14-day traffic chart, platform bars, country + device donuts, provider health, recent activity |
| Downloads | Every resolve and transfer with source link, format, IP, country and status — filterable by platform and status |
| Visitors | Unique visitors with IP, geo, device, browser, visit counts; search by IP/country/city |
| Visitor detail | The full "footsteps" trail — every page view in order, plus that visitor's downloads |
| API usage | Call volume, billable vs cached calls, cache hit rate, latency, failures, per-provider and per-platform breakdown |
| Blog posts | Create, edit, publish/unpublish and delete, with a live markdown preview |
| Messages | Contact inbox with reply, mark-handled and delete |
| Subscribers | Newsletter list with copy-all |
| Settings | Environment status readout plus editable tagline, contact email and announcement banner |

---

## How it works

1. **Detect** — `detectPlatform()` matches the pasted URL's host against the platform registry in [`src/lib/platforms.ts`](src/lib/platforms.ts). Adding a platform is one object in that array.
2. **Resolve** — `POST /api/resolve` checks a TTL cache first (`ResolveCache`), then calls the provider, normalises the response and logs the call to `ApiCall`.
3. **Download** — `GET /api/download` streams the chosen file through the server so it saves with a clean filename in every browser. Private/loopback destinations are blocked (SSRF guard) and range requests pass through.
4. **Track** — every request touches a `Visitor` row keyed by an anonymous cookie; `PageTracker` records each route change as a `PageView`.

Nothing is ever written to disk: media is piped straight from the source CDN to the visitor.

### Rate limits

In-memory per IP: 20 resolves/min, 30 downloads/min, 5 contact posts per 10 min, 8 login attempts per 10 min. Swap [`src/lib/ratelimit.ts`](src/lib/ratelimit.ts) for Redis when you run more than one instance.

---

## Deploying

1. Change `AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
2. Set `NEXT_PUBLIC_SITE_URL` to your real domain — canonicals and the sitemap use it.
3. **Move off SQLite.** In `prisma/schema.prisma` set `provider = "postgresql"`, point `DATABASE_URL` at your database and run `npx prisma db push && npm run seed`. Serverless hosts do not keep a writable SQLite file.
4. Deploy. On Vercel, `x-vercel-ip-country`/`-city` headers populate visitor geo automatically; behind Cloudflare, `cf-ipcountry` is used instead.

```bash
npm run build && npm start
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run setup` | generate + db push + seed |
| `npm run seed` | Re-seed admin, posts and settings |
| `npm run db:studio` | Prisma Studio |
| `npm run lint` | ESLint |

## Legal note

SnapGrab hosts no media and only processes publicly accessible links. Users are responsible for having the right to keep what they download; the DMCA page documents the takedown process.
