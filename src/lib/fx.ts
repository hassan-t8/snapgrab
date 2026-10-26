import { prisma } from "./prisma";
import { assertQuota, formatRenewal, recordQuotaCall, QuotaExceededError } from "./quota";

/** Open-access endpoint: free, no key, updates once a day. Attribution is shown on the tool. */
const SOURCE = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "rates:USD";
const FRESH_MS = 6 * 60 * 60_000;

export type Rates = { base: "USD"; updatedAt: string; nextUpdateAt: string | null; rates: Record<string, number> };

// one process keeps a warm copy; the DB copy survives restarts and serves as the stale fallback
let memo: { data: Rates; fetchedAt: number } | null = null;

async function readStored(): Promise<{ data: Rates; fetchedAt: number } | null> {
  const row = await prisma.resolveCache.findUnique({ where: { key: CACHE_KEY } }).catch(() => null);
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as { data: Rates; fetchedAt: number };
  } catch {
    return null;
  }
}

async function fetchUpstream(): Promise<Rates> {
  await assertQuota("exchange-rates");
  let res: Response;
  try {
    res = await fetch(SOURCE, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    await recordQuotaCall("exchange-rates", { ok: false, error: err instanceof Error ? err.message : "network" });
    throw new Error("network");
  }
  const json = (await res.json().catch(() => null)) as
    | { result?: string; rates?: Record<string, number>; time_last_update_unix?: number; time_next_update_unix?: number; "error-type"?: string }
    | null;

  if (!res.ok || json?.result !== "success" || !json.rates) {
    const reason = json?.["error-type"] ?? `HTTP ${res.status}`;
    // the open endpoint answers 429 when an IP is rate limited; it lifts after ~20 minutes
    await recordQuotaCall("exchange-rates", { ok: false, error: reason, exhausted: res.status === 429 });
    throw new Error(reason);
  }

  await recordQuotaCall("exchange-rates", { ok: true });
  const data: Rates = {
    base: "USD",
    updatedAt: new Date((json.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString(),
    nextUpdateAt: json.time_next_update_unix ? new Date(json.time_next_update_unix * 1000).toISOString() : null,
    rates: json.rates,
  };
  await prisma.resolveCache
    .upsert({
      where: { key: CACHE_KEY },
      create: { key: CACHE_KEY, platform: "rates", payload: JSON.stringify({ data, fetchedAt: Date.now() }), expiresAt: new Date(Date.now() + FRESH_MS) },
      update: { payload: JSON.stringify({ data, fetchedAt: Date.now() }), expiresAt: new Date(Date.now() + FRESH_MS) },
    })
    .catch(() => {});
  return data;
}

/**
 * Daily USD-based rates for the currency converter and the dollar-rate page: warm in-process copy,
 * refreshed every 6 hours, last good copy served (stale) if the upstream is down.
 */
export async function getUsdRates(): Promise<{ data: Rates; stale: boolean }> {
  const now = Date.now();
  if (!memo) memo = await readStored();
  if (memo && now - memo.fetchedAt < FRESH_MS) return { data: memo.data, stale: false };
  try {
    const data = await fetchUpstream();
    memo = { data, fetchedAt: now };
    return { data, stale: false };
  } catch (err) {
    if (memo) return { data: memo.data, stale: true };
    throw new Error(
      err instanceof QuotaExceededError
        ? `Exchange rates are paused until ${formatRenewal(err.resetsAt)} because the free API limit was reached.`
        : "Could not load exchange rates right now. Please try again in a few minutes.",
    );
  }
}
