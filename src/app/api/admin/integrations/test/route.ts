import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { INTEGRATIONS, resolveGroup, saveTestResult, type GroupId } from "@/lib/integrations";
import { sendTestMail, type SmtpConfig } from "@/lib/mailer";
import { normalizeProviderPayload } from "@/lib/provider";
import { recordQuotaCall } from "@/lib/quota";
import { detectPlatform, normalizeUrl } from "@/lib/platforms";
import { siteUrl } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROUPS = Object.keys(INTEGRATIONS) as [GroupId, ...GroupId[]];

const Body = z.object({
  group: z.enum(GROUPS),
  /** unsaved form values, so a key can be tested before it is saved */
  values: z.record(z.string(), z.string().max(2000).optional()).default({}),
  /** rapidapi: link to resolve; smtp: address to send the test email to */
  target: z.string().max(500).optional(),
});

type Outcome = { ok: boolean; message: string; detail?: string };

const fmtErr = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/* ------------------------------ RapidAPI ------------------------------ */

async function testRapid(cfg: Record<string, string | undefined>, target?: string): Promise<Outcome> {
  if (!cfg.RAPIDAPI_KEY || !cfg.RAPIDAPI_HOST || !cfg.RAPIDAPI_ENDPOINT) {
    return { ok: false, message: "Fill in the API key, host and endpoint first." };
  }
  const url = normalizeUrl(target || "https://www.youtube.com/watch?v=jNQXAC9IVRw");
  if (!url) return { ok: false, message: "The test link is not a valid URL." };
  const platform = detectPlatform(url);
  const useYt = platform?.id === "youtube" && cfg.RAPIDAPI_YT_ENDPOINT && cfg.RAPIDAPI_YT_HOST;
  const host = (useYt ? cfg.RAPIDAPI_YT_HOST : cfg.RAPIDAPI_HOST) as string;
  const endpoint = (useYt ? cfg.RAPIDAPI_YT_ENDPOINT : cfg.RAPIDAPI_ENDPOINT) as string;

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-rapidapi-key": cfg.RAPIDAPI_KEY, "x-rapidapi-host": host },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, message: "Could not reach the endpoint. Check the URL.", detail: fmtErr(e) };
  }
  const ms = Date.now() - started;
  const remaining = Number(res.headers.get("x-ratelimit-requests-remaining"));
  const limit = Number(res.headers.get("x-ratelimit-requests-limit"));
  const quota = Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0 ? `${remaining.toLocaleString()} of ${limit.toLocaleString()} calls left` : null;
  const text = await res.text();
  await recordQuotaCall("rapidapi-downloader", {
    ok: res.ok,
    error: res.ok ? undefined : `test: HTTP ${res.status}`,
    remaining: Number.isFinite(remaining) ? remaining : null,
    limit: Number.isFinite(limit) ? limit : null,
  });

  if (!res.ok) {
    const why: Record<number, string> = {
      401: "Key rejected. Copy the key again from your RapidAPI app.",
      403: "Not subscribed to this API, or the key belongs to another app. Subscribe to a plan on RapidAPI.",
      404: "Endpoint not found. Check the endpoint URL and host match the same API.",
      429: "Rate limit or monthly quota reached on your RapidAPI plan.",
    };
    return { ok: false, message: why[res.status] ?? `The API answered HTTP ${res.status}.`, detail: text.slice(0, 300) };
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: "Connected, but the answer is not JSON. Is the endpoint correct?", detail: text.slice(0, 200) };
  }
  if (json.error) {
    return { ok: false, message: "Connected and the key works, but the API could not read the test link.", detail: String(json.message ?? json.error).slice(0, 300) };
  }
  const media = normalizeProviderPayload(json, url, platform?.id ?? "unknown", platform?.name ?? "Link");
  if (!media.formats.length) {
    return { ok: false, message: "Connected, but no downloadable formats came back. This API's response shape may not be supported.", detail: text.slice(0, 300) };
  }
  return {
    ok: true,
    message: `Working — “${media.title ?? "test video"}”, ${media.formats.length} formats in ${(ms / 1000).toFixed(1)}s${quota ? ` · ${quota}` : ""}.`,
  };
}

/* ------------------------------ SMTP ------------------------------ */

async function testSmtp(cfg: Record<string, string | undefined>, target?: string): Promise<Outcome> {
  if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) return { ok: false, message: "Fill in host, username and password first." };
  const to = (target || cfg.MAIL_TO || cfg.SMTP_USER || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: "Enter an email address to send the test to." };
  try {
    await sendTestMail(cfg as SmtpConfig, to);
    return { ok: true, message: `Test email sent to ${to}. Check the inbox (and spam).` };
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    const msg =
      err.code === "EAUTH"
        ? "Login failed. For Gmail, turn on 2-step verification and use an App password, not your normal password."
        : err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET"
          ? `Could not connect to ${cfg.SMTP_HOST}:${cfg.SMTP_PORT ?? 587}. Check host and port, and that Secure is on for 465 / off for 587.`
          : err.code === "EENVELOPE"
            ? "The server refused the From or To address. Use your SMTP username as the From address."
            : "The mail server returned an error.";
    return { ok: false, message: msg, detail: fmtErr(e) };
  }
}

/* ------------------------------ AdSense ------------------------------ */

async function testAdsense(cfg: Record<string, string | undefined>): Promise<Outcome> {
  const client = cfg.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return { ok: false, message: "Enter your publisher ID (ca-pub-…)." };
  if (!/^ca-pub-\d{10,20}$/.test(client)) return { ok: false, message: "Publisher ID should look like ca-pub-1234567890123456." };
  try {
    const r = await fetch(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!r.ok) return { ok: false, message: `Google answered HTTP ${r.status} for this publisher ID.` };
  } catch (e) {
    return { ok: false, message: "Could not reach Google's ad server from this server.", detail: fmtErr(e) };
  }
  const slotNote = cfg.ADSENSE_SLOT ? `slot ${cfg.ADSENSE_SLOT} fills the ad boxes` : "no slot ID yet — only Auto ads will show";
  return {
    ok: true,
    message: `Ad script loads for ${client}; ${slotNote}. ads.txt is served at ${siteUrl()}/ads.txt. Ads appear only after Google approves the site.`,
  };
}

/* ------------------------------ Search Console ------------------------------ */

async function testGoogle(cfg: Record<string, string | undefined>, saved: boolean): Promise<Outcome> {
  const code = cfg.GOOGLE_SITE_VERIFICATION;
  if (!code) return { ok: false, message: "Paste the verification code first." };
  if (!saved) return { ok: true, message: "Code looks valid. Save it, then test again to check it is on the live page." };
  try {
    const html = await (await fetch(`${siteUrl()}/`, { signal: AbortSignal.timeout(15_000), cache: "no-store" })).text();
    return html.includes(`name="google-site-verification" content="${code}"`)
      ? { ok: true, message: `The verification tag is live on ${siteUrl()}. Click Verify in Search Console now.` }
      : { ok: false, message: `Saved, but the tag is not on ${siteUrl()} yet. Wait a few seconds and test again.` };
  } catch (e) {
    return { ok: false, message: `Could not load ${siteUrl()} from the server.`, detail: fmtErr(e) };
  }
}

/* ------------------------------ Exchange rates ------------------------------ */

async function testRates(): Promise<Outcome> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    const j = (await r.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (j.result !== "success" || !j.rates?.PKR) return { ok: false, message: `The rates API answered HTTP ${r.status} without rates.` };
    return { ok: true, message: `Working — 1 USD = ${j.rates.PKR.toFixed(2)} PKR (updated ${j.time_last_update_utc?.slice(5, 22) ?? "today"}).` };
  } catch (e) {
    return { ok: false, message: "This server could not reach open.er-api.com.", detail: fmtErr(e) };
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`int-test:${session.email ?? "admin"}`, 10, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many tests in a minute — wait a moment." }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  const { group, values, target } = parsed.data;

  const unsaved = Object.values(values).some((v) => v !== undefined && v.trim() !== "");
  const cfg = await resolveGroup(group, values);

  let outcome: Outcome;
  try {
    outcome =
      group === "rapidapi"
        ? await testRapid(cfg, target)
        : group === "smtp"
          ? await testSmtp(cfg, target)
          : group === "adsense"
            ? await testAdsense(cfg)
            : group === "google"
              ? await testGoogle(cfg, !unsaved)
              : await testRates();
  } catch (e) {
    outcome = { ok: false, message: "The test crashed unexpectedly.", detail: fmtErr(e) };
  }

  // only remember results for saved settings; a test of unsaved values says nothing about the live site
  if (!unsaved) await saveTestResult(group, outcome).catch(() => {});
  return NextResponse.json({ ok: true, result: { ...outcome, at: new Date().toISOString() }, unsaved });
}
