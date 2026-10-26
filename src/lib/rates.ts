import { cache } from "react";
import { prisma } from "./prisma";

/**
 * Daily market prices that have no free reliable API in Pakistan (gold, fuel, open-market dollar).
 * The admin enters them in Admin → Daily rates; public rate pages show the latest value, the
 * change since the previous entry and a short history.
 */
export const RATE_DEFS = {
  gold_24k_tola: { label: "Gold 24K", unit: "per tola", page: "gold" },
  gold_22k_tola: { label: "Gold 22K", unit: "per tola", page: "gold" },
  gold_21k_tola: { label: "Gold 21K", unit: "per tola", page: "gold" },
  silver_tola: { label: "Silver", unit: "per tola", page: "gold" },
  petrol: { label: "Petrol", unit: "per litre", page: "petrol" },
  diesel: { label: "High-speed diesel", unit: "per litre", page: "petrol" },
  lpg_kg: { label: "LPG", unit: "per kg", page: "petrol" },
  usd_open_buy: { label: "US dollar (open market, buying)", unit: "per USD", page: "dollar" },
  usd_open_sell: { label: "US dollar (open market, selling)", unit: "per USD", page: "dollar" },
} as const;

export type RateKey = keyof typeof RATE_DEFS;
export const RATE_KEYS = Object.keys(RATE_DEFS) as RateKey[];

export type RatePageId = "gold" | "petrol" | "dollar";

/** Public rate pages: slug → content. */
export const RATE_PAGES: Record<RatePageId, { slug: string; title: string; h1: string; description: string; keywords: string[] }> = {
  dollar: {
    slug: "dollar-rate-in-pakistan",
    title: "Dollar Rate in Pakistan Today — USD to PKR",
    h1: "Dollar rate in Pakistan today",
    description:
      "Today's US dollar rate in Pakistan: interbank USD to PKR from daily market data, plus the open-market buying and selling rate, with recent history.",
    keywords: ["dollar rate in pakistan", "usd to pkr today", "dollar rate today open market", "interbank dollar rate", "1 dollar in pakistani rupees"],
  },
  gold: {
    slug: "gold-rate-in-pakistan",
    title: "Gold Rate in Pakistan Today — Per Tola 24K & 22K",
    h1: "Gold rate in Pakistan today",
    description:
      "Today's gold price in Pakistan per tola for 24K, 22K and 21K gold, plus silver, with the change since yesterday and recent history.",
    keywords: ["gold rate in pakistan today", "gold price per tola", "24k gold rate", "22k gold rate pakistan", "sona rate today", "silver rate in pakistan"],
  },
  petrol: {
    slug: "petrol-price-in-pakistan",
    title: "Petrol Price in Pakistan Today — Per Litre",
    h1: "Petrol price in Pakistan today",
    description:
      "Current petrol, high-speed diesel and LPG prices in Pakistan per litre and per kg, with the latest change and recent history.",
    keywords: ["petrol price in pakistan today", "petrol rate per litre", "diesel price pakistan", "new petrol price", "lpg price per kg pakistan"],
  },
};

export const ratePageBySlug = (slug: string) =>
  (Object.entries(RATE_PAGES) as [RatePageId, (typeof RATE_PAGES)[RatePageId]][]).find(([, p]) => p.slug === slug);

/** UTC midnight of the calendar date in Pakistan time, used as the "day" of an entry. */
export function rateDay(d = new Date()) {
  const pk = new Date(d.getTime() + 5 * 3_600_000);
  return new Date(Date.UTC(pk.getUTCFullYear(), pk.getUTCMonth(), pk.getUTCDate()));
}

export type RatePoint = { date: string; value: number };
export type RateSummary = { key: RateKey; label: string; unit: string; value: number; date: string; previous: number | null; history: RatePoint[] };

/** Latest value, previous value and up to `days` entries for each key on a page. */
export const getRateSummaries = cache(async (page: RatePageId, days = 30): Promise<RateSummary[]> => {
  const keys = RATE_KEYS.filter((k) => RATE_DEFS[k].page === page);
  const rows = await prisma.rateEntry
    .findMany({ where: { key: { in: keys } }, orderBy: { date: "desc" }, take: keys.length * days })
    .catch(() => []);
  return keys.flatMap((key) => {
    const list = rows.filter((r) => r.key === key);
    if (!list.length) return [];
    return [
      {
        key,
        label: RATE_DEFS[key].label,
        unit: RATE_DEFS[key].unit,
        value: list[0].value,
        date: list[0].date.toISOString(),
        previous: list[1]?.value ?? null,
        history: list
          .slice(0, days)
          .reverse()
          .map((r) => ({ date: r.date.toISOString().slice(0, 10), value: r.value })),
      },
    ];
  });
});
