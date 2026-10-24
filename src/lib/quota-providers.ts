/**
 * External APIs the site depends on, and what they cost. Kept free of server imports so
 * both the admin UI and the tool registry can read it.
 *
 * Tools without a provider run entirely in the browser and are always free ("free").
 */

export type CostTier = "free" | "free-api" | "paid";

export type QuotaPeriod = "day" | "month";

export type QuotaProvider = {
  label: string;
  tier: Exclude<CostTier, "free">;
  /** what the provider is used for, shown in the admin panel */
  purpose: string;
  /** Admin → Integrations group holding the key, if the service needs one */
  integration?: "rapidapi";
  /** default allowance per period; null = counted but never enforced until an admin sets one */
  defaultLimit: number | null;
  period: QuotaPeriod;
  /** where to check the plan / renew it */
  dashboardUrl: string;
  note: string;
};

export const QUOTA_PROVIDERS = {
  "exchange-rates": {
    label: "ExchangeRate-API (open access)",
    tier: "free-api",
    purpose: "Currency converter rates",
    defaultLimit: 100,
    period: "day",
    dashboardUrl: "https://www.exchangerate-api.com/docs/free",
    note: "Free, no key. Rates refresh once a day and we cache them for 6 hours, so real usage is a handful of calls a day. Attribution link is required and shown on the tool.",
  },
  "rapidapi-downloader": {
    label: "RapidAPI social media downloader",
    tier: "paid",
    purpose: "Video downloader, audio downloader, video to MP3",
    integration: "rapidapi",
    defaultLimit: null,
    period: "month",
    dashboardUrl: "https://rapidapi.com/developer/billing",
    note: "Paid subscription (free plans exist with very small limits). Remaining calls are read from RapidAPI's rate-limit headers; when they hit zero the downloader tools switch off until the plan renews.",
  },
} as const satisfies Record<string, QuotaProvider>;

export type ProviderId = keyof typeof QUOTA_PROVIDERS;

export const COST_TIER_LABEL: Record<CostTier, { title: string; short: string; description: string }> = {
  free: {
    title: "Totally free",
    short: "Free",
    description: "Runs in the visitor's browser. No server, no API, no key, no cost — ever.",
  },
  "free-api": {
    title: "Free API (limits apply)",
    short: "Free API",
    description: "Uses a free external API. No bill, but the provider limits how many calls you can make per day or month.",
  },
  paid: {
    title: "Paid API",
    short: "Paid",
    description: "Needs a paid subscription / API key. Stops working when the plan's allowance runs out until it renews.",
  },
};
