import { cache } from "react";
import { prisma } from "./prisma";
import { QUOTA_PROVIDERS, type ProviderId, type QuotaPeriod } from "./quota-providers";

/**
 * Usage allowance for every external API, so a free or paid plan running out switches the
 * affected tools off on its own and switches them back on when the plan renews.
 *
 * Periods are rolling and anchored at `periodStart` (the day the plan started or was last
 * reset by an admin), which matches how RapidAPI and most providers bill. A tool is blocked when
 *   - the counted calls reached the limit, or
 *   - the upstream itself reported the allowance is gone (`exhaustedUntil` in the future),
 * unless an admin has force-enabled the provider.
 */

export type QuotaState = {
  id: ProviderId;
  label: string;
  tier: "free-api" | "paid";
  limit: number | null;
  used: number;
  remaining: number | null;
  period: QuotaPeriod;
  periodStart: Date;
  resetsAt: Date;
  exhaustedUntil: Date | null;
  forceEnabled: boolean;
  /** limit reached / upstream exhausted, regardless of force-enable */
  exhausted: boolean;
  /** what the site actually does: exhausted && !forceEnabled means the tools are off */
  available: boolean;
  lastError: string | null;
  lastCallAt: Date | null;
  configured: boolean;
};

export class QuotaExceededError extends Error {
  code = "QUOTA_EXCEEDED";
  resetsAt: Date;
  constructor(label: string, resetsAt: Date) {
    super(`${label} has reached its usage limit. It will be back on ${formatRenewal(resetsAt)}.`);
    this.resetsAt = resetsAt;
  }
}

export function formatRenewal(d: Date) {
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

function addPeriod(d: Date, period: QuotaPeriod) {
  const next = new Date(d);
  if (period === "day") next.setUTCDate(next.getUTCDate() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function asPeriod(v: string | null | undefined, fallback: QuotaPeriod): QuotaPeriod {
  return v === "day" || v === "month" ? v : fallback;
}

type Row = {
  provider: string;
  limitPerPeriod: number | null;
  period: string;
  used: number;
  periodStart: Date;
  exhaustedUntil: Date | null;
  forceEnabled: boolean;
  lastError: string | null;
  lastCallAt: Date | null;
};

/** Walk the period forward to the one containing `now`; returns null when nothing changed. */
function rollover(row: Row, now: Date): Pick<Row, "periodStart" | "used" | "exhaustedUntil"> | null {
  const period = asPeriod(row.period, "month");
  let start = row.periodStart;
  let next = addPeriod(start, period);
  if (next > now) return null;
  while (next <= now) {
    start = next;
    next = addPeriod(start, period);
  }
  // a new period means a fresh allowance: auto re-enable
  return {
    periodStart: start,
    used: 0,
    exhaustedUntil: row.exhaustedUntil && row.exhaustedUntil > now ? row.exhaustedUntil : null,
  };
}

function defaultRow(id: ProviderId): Row {
  const p = QUOTA_PROVIDERS[id];
  return {
    provider: id,
    limitPerPeriod: p.defaultLimit,
    period: p.period,
    used: 0,
    periodStart: new Date(),
    exhaustedUntil: null,
    forceEnabled: false,
    lastError: null,
    lastCallAt: null,
  };
}

function toState(id: ProviderId, raw: Row, now = new Date()): QuotaState {
  const p = QUOTA_PROVIDERS[id];
  const row = { ...raw, ...(rollover(raw, now) ?? {}) };
  const period = asPeriod(row.period, p.period);
  const resetsAt = addPeriod(row.periodStart, period);
  const limit = row.limitPerPeriod;
  const overLimit = limit != null && row.used >= limit;
  const upstreamOut = !!row.exhaustedUntil && row.exhaustedUntil > now;
  const exhausted = overLimit || upstreamOut;
  const keyEnv = "keyEnv" in p ? p.keyEnv : undefined;
  return {
    id,
    label: p.label,
    tier: p.tier,
    limit,
    used: row.used,
    remaining: limit == null ? null : Math.max(0, limit - row.used),
    period,
    periodStart: row.periodStart,
    // when the upstream told us a later date, that is the real renewal
    resetsAt: upstreamOut && row.exhaustedUntil! > resetsAt ? row.exhaustedUntil! : resetsAt,
    exhaustedUntil: upstreamOut ? row.exhaustedUntil : null,
    forceEnabled: row.forceEnabled,
    exhausted,
    available: !exhausted || row.forceEnabled,
    lastError: row.lastError,
    lastCallAt: row.lastCallAt,
    configured: !keyEnv || !!process.env[keyEnv],
  };
}

const PROVIDER_IDS = Object.keys(QUOTA_PROVIDERS) as ProviderId[];

/** All providers' current state; de-duplicated per render. Never throws. */
export const getQuotaStates = cache(async (): Promise<Record<ProviderId, QuotaState>> => {
  const rows = await prisma.apiQuota.findMany().catch(() => [] as Row[]);
  const byId = new Map(rows.map((r) => [r.provider, r]));
  const now = new Date();
  return Object.fromEntries(
    PROVIDER_IDS.map((id) => [id, toState(id, byId.get(id) ?? defaultRow(id), now)]),
  ) as Record<ProviderId, QuotaState>;
});

export async function getQuotaState(id: ProviderId) {
  return (await getQuotaStates())[id];
}

/** Uncached read used right before an upstream call. */
async function loadRow(id: ProviderId): Promise<Row> {
  const now = new Date();
  const row = (await prisma.apiQuota.findUnique({ where: { provider: id } }).catch(() => null)) ?? null;
  if (!row) {
    const fresh = defaultRow(id);
    await prisma.apiQuota.create({ data: fresh }).catch(() => {});
    return fresh;
  }
  const rolled = rollover(row, now);
  if (rolled) {
    await prisma.apiQuota.update({ where: { provider: id }, data: rolled }).catch(() => {});
    return { ...row, ...rolled };
  }
  return row;
}

/** Throws QuotaExceededError when the provider is switched off by its limit. */
export async function assertQuota(id: ProviderId) {
  const state = toState(id, await loadRow(id));
  if (!state.available) throw new QuotaExceededError(QUOTA_PROVIDERS[id].label, state.resetsAt);
  return state;
}

/**
 * Record one upstream call. Pass what the provider reported, when it does:
 *   remaining/limit — from rate-limit headers; they override our own count
 *   exhausted       — the upstream said the allowance is gone (e.g. 429 with 0 remaining)
 */
export async function recordQuotaCall(
  id: ProviderId,
  result: { ok: boolean; error?: string; remaining?: number | null; limit?: number | null; exhausted?: boolean },
) {
  try {
    const row = await loadRow(id);
    const period = asPeriod(row.period, QUOTA_PROVIDERS[id].period);
    const hasHeaders = Number.isFinite(result.remaining) && Number.isFinite(result.limit) && (result.limit as number) > 0;
    const out = result.exhausted || (Number.isFinite(result.remaining) && (result.remaining as number) <= 0);

    await prisma.apiQuota.update({
      where: { provider: id },
      data: {
        lastCallAt: new Date(),
        lastError: result.ok ? null : (result.error ?? "error").slice(0, 300),
        ...(hasHeaders
          ? { limitPerPeriod: result.limit as number, used: (result.limit as number) - (result.remaining as number) }
          : { used: { increment: 1 } }),
        ...(out ? { exhaustedUntil: addPeriod(row.periodStart, period) } : {}),
      },
    });
  } catch {
    // bookkeeping must never fail the request that triggered it
  }
}

/* ---------------------------- admin actions ---------------------------- */

export async function updateQuota(
  id: ProviderId,
  patch: { limit?: number | null; period?: QuotaPeriod; forceEnabled?: boolean; reset?: boolean; renewsAt?: Date | null },
) {
  const row = await loadRow(id);
  const data: Partial<Row> = {};
  if (patch.limit !== undefined) data.limitPerPeriod = patch.limit;
  if (patch.period) data.period = patch.period;
  if (patch.forceEnabled !== undefined) data.forceEnabled = patch.forceEnabled;
  if (patch.reset) {
    // "my plan renewed today": new period starts now, counter and block cleared
    Object.assign(data, { periodStart: new Date(), used: 0, exhaustedUntil: null, lastError: null });
  }
  if (patch.renewsAt !== undefined) {
    // admin knows the exact renewal date: anchor the period so it ends then
    if (patch.renewsAt) {
      const period = patch.period ?? asPeriod(row.period, QUOTA_PROVIDERS[id].period);
      const start = new Date(patch.renewsAt);
      if (period === "day") start.setUTCDate(start.getUTCDate() - 1);
      else start.setUTCMonth(start.getUTCMonth() - 1);
      data.periodStart = start;
      if (row.exhaustedUntil) data.exhaustedUntil = new Date(patch.renewsAt);
    }
  }
  await prisma.apiQuota.update({ where: { provider: id }, data });
  return toState(id, { ...row, ...data });
}
